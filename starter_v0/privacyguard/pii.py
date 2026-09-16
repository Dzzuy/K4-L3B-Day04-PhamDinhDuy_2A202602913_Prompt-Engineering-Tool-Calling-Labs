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
