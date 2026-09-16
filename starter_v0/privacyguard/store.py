from __future__ import annotations

import secrets
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

def _seed_data_directory(store: DatasetStore) -> None:
    root_dir = Path(__file__).resolve().parent.parent.parent
    data_candidates = [
        root_dir / "data",
        root_dir / "starter_v0" / "data",
    ]

    for data_dir in data_candidates:
        if not data_dir.exists():
            continue
        for csv_path in data_dir.glob("*.csv"):
            ds_id = f"ds_{csv_path.stem}"
            if store.get(ds_id) is None:
                try:
                    # Read sample rows for fast memory loading
                    with csv_path.open(encoding="utf-8-sig", newline="", errors="ignore") as h:
                        reader = csv.DictReader(h)
                        cols = [c.strip() for c in (reader.fieldnames or []) if c and c.strip()]
                        rows = []
                        total_count = 0
                        for row in reader:
                            total_count += 1
                            if len(rows) < 100:  # store sample rows
                                rows.append({c: str(row.get(c, "") or "") for c in cols})
                    
                    store.put(Dataset(
                        dataset_id=ds_id,
                        filename=csv_path.name,
                        columns=cols,
                        rows=rows,
                        status="Analyzed",
                        risk="HIGH",
                        pii_count=len([c for c in cols if any(k in c.lower() for k in ("name", "email", "phone", "address", "user", "cccd", "id"))]),
                        virtual_record_count=total_count,
                    ))
                except Exception as e:
                    pass

_seed_data_directory(STORE)

# ---------------------------------------------------------------------------
# CONVERSATION & MESSAGE PERSISTENCE (THEO YÊU CẦU MỤC 3, 4, 7)
# ---------------------------------------------------------------------------
import json

CONVERSATIONS_FILE = FIXTURES_DIR / "conversations_data.json"


@dataclass
class ConversationMessage:
    id: str
    conversation_id: str
    sender: str  # "user" | "agent"
    text: str
    time: str
    tools: list[dict[str, Any]] = field(default_factory=list)
    requires_approval: bool = False
    policy: dict[str, str] = field(default_factory=dict)
    mask_result: dict[str, Any] | None = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "sender": self.sender,
            "text": self.text,
            "time": self.time,
            "tools": self.tools,
            "requiresApproval": self.requires_approval,
            "policy": self.policy,
            "maskResult": self.mask_result,
            "created_at": self.created_at,
        }


@dataclass
class Conversation:
    id: str
    title: str
    file_id: str
    created_at: str
    updated_at: str
    messages: list[ConversationMessage] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "file_id": self.file_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "message_count": len(self.messages),
            "messages": [m.to_dict() for m in self.messages],
        }


class ConversationStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._items: dict[str, Conversation] = {}
        self._load()

    def _load(self) -> None:
        if CONVERSATIONS_FILE.exists():
            try:
                data = json.loads(CONVERSATIONS_FILE.read_text(encoding="utf-8"))
                for item in data:
                    msgs = [
                        ConversationMessage(
                            id=m["id"],
                            conversation_id=m.get("conversation_id", item["id"]),
                            sender=m["sender"],
                            text=m["text"],
                            time=m.get("time", "12:00"),
                            tools=m.get("tools", []),
                            requires_approval=m.get("requiresApproval", False),
                            policy=m.get("policy", {}),
                            mask_result=m.get("maskResult"),
                            created_at=m.get("created_at", datetime.utcnow().isoformat()),
                        )
                        for m in item.get("messages", [])
                    ]
                    self._items[item["id"]] = Conversation(
                        id=item["id"],
                        title=item["title"],
                        file_id=item.get("file_id", "ds_sample_pii"),
                        created_at=item.get("created_at", datetime.utcnow().isoformat()),
                        updated_at=item.get("updated_at", datetime.utcnow().isoformat()),
                        messages=msgs,
                    )
                return
            except Exception:
                pass
        self._seed_default()

    def _save(self) -> None:
        try:
            raw = [c.to_dict() for c in self._items.values()]
            CONVERSATIONS_FILE.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    def _seed_default(self) -> None:
        c1 = Conversation(
            id="conv_sample_pii",
            title="Phân tích sample_pii.csv",
            file_id="ds_sample_pii",
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            messages=[
                ConversationMessage(
                    id="m_c1_1",
                    conversation_id="conv_sample_pii",
                    sender="agent",
                    text="Xin chào! Tôi là PrivacyGuard AI Agent. Tôi đang làm việc trên file sample_pii.csv từ thư mục data/.",
                    time="12:00",
                )
            ]
        )
        self._items[c1.id] = c1
        self._save()

    def list_all(self) -> list[Conversation]:
        with self._lock:
            return sorted(self._items.values(), key=lambda c: c.updated_at, reverse=True)

    def get(self, conv_id: str) -> Conversation | None:
        with self._lock:
            return self._items.get(conv_id)

    def create(self, file_id: str = "ds_sample_pii", title: str = "Cuộc trò chuyện mới") -> Conversation:
        with self._lock:
            now_iso = datetime.utcnow().isoformat()
            cid = f"conv_{secrets.token_hex(6)}"
            conv = Conversation(
                id=cid,
                title=title,
                file_id=file_id,
                created_at=now_iso,
                updated_at=now_iso,
                messages=[
                    ConversationMessage(
                        id=f"m_{secrets.token_hex(4)}",
                        conversation_id=cid,
                        sender="agent",
                        text=f"Xin chào! Phiên trò chuyện mới cho file '{file_id}' đã bắt đầu. Hãy ra lệnh cho tôi kiểm tra PII hoặc hỏi câu hỏi phân tích dữ liệu!",
                        time=datetime.now().strftime("%H:%M"),
                    )
                ],
            )
            self._items[cid] = conv
            self._save()
            return conv

    def add_message(
        self,
        conv_id: str,
        sender: str,
        text: str,
        time_str: str,
        tools: list[dict[str, Any]] | None = None,
        requires_approval: bool = False,
        policy: dict[str, str] | None = None,
        mask_result: dict[str, Any] | None = None,
    ) -> ConversationMessage:
        with self._lock:
            conv = self._items.get(conv_id)
            if not conv:
                conv = self.create(title=text[:35] or "Hội thoại")
                conv_id = conv.id

            now_iso = datetime.utcnow().isoformat()
            msg = ConversationMessage(
                id=f"m_{secrets.token_hex(5)}",
                conversation_id=conv_id,
                sender=sender,
                text=text,
                time=time_str,
                tools=tools or [],
                requires_approval=requires_approval,
                policy=policy or {},
                mask_result=mask_result,
                created_at=now_iso,
            )
            conv.messages.append(msg)
            conv.updated_at = now_iso

            # Auto-title on first user message
            if sender == "user" and conv.title in ("Cuộc trò chuyện mới", "New Chat", "Đoạn chat mới"):
                clean_title = text.replace("\n", " ").strip()
                conv.title = (clean_title[:35] + "...") if len(clean_title) > 35 else clean_title

            self._save()
            return msg


CONV_STORE = ConversationStore()
