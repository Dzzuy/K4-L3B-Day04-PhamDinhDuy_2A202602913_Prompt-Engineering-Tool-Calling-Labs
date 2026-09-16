from __future__ import annotations

import re
from collections import defaultdict
from typing import Any


PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I),
    "phone": re.compile(r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    "ip_address": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
}

COLUMN_HINTS: dict[str, tuple[str, ...]] = {
    "email": ("email", "e-mail", "mail"),
    "phone": ("phone", "mobile", "tel", "cellphone"),
    "ssn": ("ssn", "social_security", "national_id"),
    "credit_card": ("card", "cc", "credit"),
    "name": ("name", "full_name", "firstname", "first_name", "lastname", "last_name"),
    "address": ("address", "street", "city"),
    "ip_address": ("ip", "ip_address"),
}


def _column_hint_type(column: str) -> str | None:
    lowered = column.strip().lower().replace(" ", "_")
    for pii_type, hints in COLUMN_HINTS.items():
        if any(hint in lowered for hint in hints):
            return pii_type
    return None


def classify_value(value: str) -> list[str]:
    text = (value or "").strip()
    if not text:
        return []
    found: list[str] = []
    for pii_type, pattern in PII_PATTERNS.items():
        if pattern.search(text):
            found.append(pii_type)
    return found


def mask_value(value: str, pii_type: str) -> str:
    text = value or ""
    if pii_type == "email" and "@" in text:
        local, _, domain = text.partition("@")
        keep = local[:1] if local else "*"
        return f"{keep}***@{domain}"
    if pii_type == "phone":
        digits = re.sub(r"\D", "", text)
        if len(digits) >= 4:
            return f"***-***-{digits[-4:]}"
        return "***-****"
    if pii_type == "ssn":
        return "***-**-" + re.sub(r"\D", "", text)[-4:] if len(re.sub(r"\D", "", text)) >= 4 else "***-**-****"
    if pii_type == "credit_card":
        digits = re.sub(r"\D", "", text)
        return f"**** **** **** {digits[-4:]}" if len(digits) >= 4 else "**** **** **** ****"
    if pii_type in {"name", "address"}:
        if not text:
            return "[REDACTED]"
        return text[0] + "***"
    if pii_type == "ip_address":
        parts = text.split(".")
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.***.***"
        return "***.***.***.***"
    return "[REDACTED]"


def detect_columns(rows: list[dict[str, str]], columns: list[str]) -> dict[str, dict[str, Any]]:
    hits: dict[str, dict[str, int]] = {col: defaultdict(int) for col in columns}
    examples: dict[str, dict[str, str]] = {col: {} for col in columns}

    for row in rows:
        for col in columns:
            value = str(row.get(col, ""))
            types = classify_value(value)
            hinted = _column_hint_type(col)
            if hinted == "name" and value and not types:
                types = ["name"]
            if hinted == "address" and value and not types:
                types = ["address"]
            if hinted and hinted not in types and value:
                if hinted in PII_PATTERNS or hinted in {"name", "address"}:
                    types.append(hinted)
            for pii_type in types:
                hits[col][pii_type] += 1
                examples[col].setdefault(pii_type, value)

    report: dict[str, dict[str, Any]] = {}
    for col in columns:
        if not hits[col]:
            continue
        top_type = max(hits[col].items(), key=lambda item: item[1])[0]
        report[col] = {
            "pii_types": dict(hits[col]),
            "primary_type": top_type,
            "hit_count": sum(hits[col].values()),
            "example": mask_value(examples[col].get(top_type, ""), top_type),
        }
    return report


def apply_mask_to_rows(
    rows: list[dict[str, str]],
    columns: list[str],
    column_types: dict[str, str],
) -> list[dict[str, str]]:
    masked: list[dict[str, str]] = []
    for row in rows:
        next_row = dict(row)
        for col in columns:
            pii_type = column_types.get(col, "name")
            next_row[col] = mask_value(str(row.get(col, "")), pii_type)
        masked.append(next_row)
    return masked

# ---------------------------------------------------------------------------
# NGHỊ ĐỊNH 13/2023/NĐ-CP: PHÂN LOẠI DỮ LIỆU CÁ NHÂN VIỆT NAM
# ---------------------------------------------------------------------------
DECREE_13_SENSITIVE_TYPES = {"national_id", "ssn", "credit_card", "financial", "bank_account", "salary"}
DECREE_13_BASIC_TYPES = {"name", "full_name", "phone", "email", "address", "dob", "date", "ip_address"}

def classify_decree_13(pii_type: str) -> dict[str, str]:
    normalized = (pii_type or "").lower().replace("-", "_")
    if normalized in DECREE_13_SENSITIVE_TYPES:
        return {
            "legal_category": "DỮ LIỆU CÁ NHÂN NHẠY CẢM",
            "decree_ref": "Điều 2, Khoản 4, Nghị định 13/2023/NĐ-CP",
            "compliance_requirement": "Bắt buộc đánh giá tác động xử lý (DPIA) & mã hóa/che mờ nghiêm ngặt",
            "badge_color": "critical",
        }
    return {
        "legal_category": "DỮ LIỆU CÁ NHÂN CƠ BẢN",
        "decree_ref": "Điều 2, Khoản 3, Nghị định 13/2023/NĐ-CP",
        "compliance_requirement": "Cần biện pháp bảo vệ và giới hạn quyền truy cập",
        "badge_color": "medium",
    }


# ---------------------------------------------------------------------------
# SYNTHETIC DATA GENERATOR: DỮ LIỆU GIẢ LẬP VIỆT NAM CHUẨN THỰC TẾ
# ---------------------------------------------------------------------------
import random

VN_HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ"]
VN_DEM = ["Văn", "Thị", "Quốc", "Đình", "Hải", "Minh", "Thu", "Ngọc", "Gia", "Thanh", "Hoàng"]
VN_TEN = ["Bảo", "Dũng", "Hương", "Khánh", "Linh", "Nam", "Phúc", "Thảo", "Tuấn", "Vy", "Trí", "Quân"]
VN_STREETS = ["Lê Lợi", "Nguyễn Huệ", "Trần Phú", "Ba Triệu", "Hai Bà Trưng", "Nguyễn Trãi", "Điện Biên Phủ"]
VN_CITIES = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Hải Phòng", "Huế"]
VN_CARRIERS = ["091", "098", "090", "093", "088", "086", "077"]

def generate_synthetic_value(pii_type: str, original_val: str = "") -> str:
    norm = (pii_type or "").lower().replace("-", "_")
    seed = abs(hash(original_val)) if original_val else random.randint(1000, 9999)
    rng = random.Random(seed)

    if norm in ("name", "full_name"):
        return f"{rng.choice(VN_HO)} {rng.choice(VN_DEM)} {rng.choice(VN_TEN)}"
    if norm == "phone":
        return f"+84 {rng.choice(VN_CARRIERS)} {rng.randint(100, 999)} {rng.randint(1000, 9999)}"
    if norm == "email":
        ho = rng.choice(VN_HO).lower()
        ten = rng.choice(VN_TEN).lower()
        return f"{ho}.{ten}{rng.randint(10, 99)}@synthetic-domain.vn"
    if norm in ("national_id", "ssn", "cccd"):
        province_code = rng.choice(["001", "079", "048", "031", "092"])
        century_gender = rng.choice(["0", "1"])  # Thế kỷ 20: 0=Nam, 1=Nữ
        birth_year = rng.randint(80, 99)
        random_num = rng.randint(100000, 999999)
        return f"{province_code}{century_gender}{birth_year:02d}{random_num}"
    if norm in ("financial", "salary", "bank_account"):
        return f"{rng.randint(15, 60)},000,000 VND"
    if norm == "address":
        return f"Số {rng.randint(10, 299)} {rng.choice(VN_STREETS)}, {rng.choice(VN_CITIES)}"
    if norm in ("date", "dob"):
        return f"{rng.randint(1985, 2002)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}"
    return f"[SYNTHETIC_{norm.upper()}_{rng.randint(100, 999)}]"
