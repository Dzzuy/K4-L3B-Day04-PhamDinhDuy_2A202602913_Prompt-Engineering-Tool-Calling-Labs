from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from threading import Lock
from typing import Any


FIXTURES_DIR = Path(__file__).parent
SESSION_TTL = timedelta(hours=2)


@dataclass
class Dataset:
    dataset_id: str
    filename: str
    columns: list[str]
    rows: list[dict[str, str]]
    masked: bool = False
    confirmation_token: str | None = None
    pending_columns: list[str] = field(default_factory=list)
    last_preview: dict[str, Any] | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    raw_rows: list[dict[str, str]] = field(default_factory=list)
    versions: dict[str, list[dict[str, str]]] = field(default_factory=dict)
    status: str = "Analyzed"
    risk: str = "MEDIUM"
    pii_count: int = 0
    policy: dict[str, str] = field(default_factory=dict)
    virtual_record_count: int | None = None


class DatasetStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._items: dict[str, Dataset] = {}

    def put(self, dataset: Dataset) -> Dataset:
        with self._lock:
            self.expire_unlocked()
            if not dataset.raw_rows:
                dataset.raw_rows = [dict(row) for row in dataset.rows]
                dataset.versions.setdefault("raw", [dict(row) for row in dataset.rows])
            self._items[dataset.dataset_id] = dataset
            return dataset

    def get(self, dataset_id: str) -> Dataset | None:
        with self._lock:
            self.expire_unlocked()
            return self._items.get(dataset_id)

    def list_all(self) -> list[Dataset]:
        with self._lock:
            self.expire_unlocked()
            return list(self._items.values())

    def expire_unlocked(self) -> None:
        now = datetime.utcnow()
        stale = [
            key
            for key, item in self._items.items()
            if not key.startswith("ds_") and now - item.created_at > SESSION_TTL
        ]
        for key in stale:
            self._items.pop(key, None)


def _rows_from_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = [name.strip() for name in (reader.fieldnames or []) if name and name.strip()]
        rows = [{col: str(item.get(col, "") or "") for col in columns} for item in reader]
    return columns, rows


def _seed_fixtures(store: DatasetStore) -> None:
    # customer.csv (10,000 records, 6 PII, HIGH, Protected)
    customer_cols = ["id", "name", "phone", "email", "cccd", "dob", "address", "tier"]
    customer_rows = [
        {"id": "101", "name": "Nguyen Van A", "phone": "+84912345678", "email": "nguyen.a@example.com", "cccd": "001099012345", "dob": "1992-05-14", "address": "123 Le Loi, HCMC", "tier": "Gold"},
        {"id": "102", "name": "Tran Thi B", "phone": "+84988123456", "email": "tran.b@example.com", "cccd": "001095067890", "dob": "1995-11-20", "address": "45 Tran Phu, Da Nang", "tier": "Silver"},
    ]
    store.put(Dataset(
        dataset_id="ds_customer",
        filename="customer.csv",
        columns=customer_cols,
        rows=customer_rows,
        masked=True,
        status="Protected",
        risk="HIGH",
        pii_count=6,
        virtual_record_count=10000,
        policy={"name": "PARTIAL_MASK", "phone": "PARTIAL_MASK", "email": "PARTIAL_MASK", "cccd": "FULL_MASK", "dob": "GENERALIZE", "address": "PARTIAL_MASK"}
    ))

    # users.csv (5,200 records, 4 PII, MEDIUM, Analyzed)
    users_cols = ["user_id", "username", "email", "phone_number", "ip_address", "created_date"]
    users_rows = [
        {"user_id": "U1", "username": "alex_miller", "email": "alex.miller@corp.net", "phone_number": "+1-555-0144", "ip_address": "192.168.1.45", "created_date": "2026-01-10"},
        {"user_id": "U2", "username": "sara_connor", "email": "sara.c@corp.net", "phone_number": "+1-555-0182", "ip_address": "10.12.4.91", "created_date": "2026-02-14"},
    ]
    store.put(Dataset(
        dataset_id="ds_users",
        filename="users.csv",
        columns=users_cols,
        rows=users_rows,
        masked=False,
        status="Analyzed",
        risk="MEDIUM",
        pii_count=4,
        virtual_record_count=5200,
        policy={"username": "PARTIAL_MASK", "email": "PARTIAL_MASK", "phone_number": "PARTIAL_MASK", "ip_address": "PARTIAL_MASK"}
    ))

    # employee.csv (2,100 records, 7 PII, HIGH, Pending)
    employee_cols = ["emp_id", "full_name", "work_email", "mobile", "ssn", "birth_date", "home_address", "bank_account", "dept"]
    employee_rows = [
        {"emp_id": "E201", "full_name": "Hana Vo", "work_email": "hana.vo@company.org", "mobile": "0909123456", "ssn": "987-65-4321", "birth_date": "1987-04-12", "home_address": "45 Elm St, District 3", "bank_account": "4111111111111111", "dept": "HR"},
    ]
    store.put(Dataset(
        dataset_id="ds_employee",
        filename="employee.csv",
        columns=employee_cols,
        rows=employee_rows,
        masked=False,
        status="Pending",
        risk="HIGH",
        pii_count=7,
        virtual_record_count=2100,
        policy={"full_name": "PARTIAL_MASK", "work_email": "PARTIAL_MASK", "mobile": "PARTIAL_MASK", "ssn": "FULL_MASK", "birth_date": "GENERALIZE", "home_address": "PARTIAL_MASK", "bank_account": "FULL_MASK"}
    ))

    # Existing lab fixtures
    contacts = FIXTURES_DIR / "sample_contacts.csv"
    if contacts.exists():
        columns, rows = _rows_from_csv(contacts)
        store.put(Dataset(dataset_id="ds_eval", filename=contacts.name, columns=columns, rows=rows, status="Analyzed", risk="HIGH", pii_count=5))


STORE = DatasetStore()
_seed_fixtures(STORE)
