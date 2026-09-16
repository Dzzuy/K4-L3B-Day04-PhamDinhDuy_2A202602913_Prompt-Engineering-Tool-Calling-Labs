from __future__ import annotations

import secrets
from typing import Any

from .pii import apply_mask_to_rows, detect_columns
from .store import STORE, Dataset


def _require(dataset_id: str) -> Dataset:
    dataset = STORE.get(dataset_id)
    if dataset is None:
        raise ValueError(f"Unknown dataset_id: {dataset_id}")
    return dataset


def scan_dataset(dataset_id: str = "ds_eval") -> dict[str, Any]:
    dataset = _require(dataset_id)
    return {
        "dataset_id": dataset.dataset_id,
        "filename": dataset.filename,
        "row_count": len(dataset.rows),
        "col_count": len(dataset.columns),
        "columns": dataset.columns,
        "masked": dataset.masked,
        "versions": list(dataset.versions.keys()),
    }


def detect_pii(dataset_id: str = "ds_eval", columns: list[str] | None = None) -> dict[str, Any]:
    dataset = _require(dataset_id)
    target = columns or dataset.columns
    target = [col for col in target if col in dataset.columns]
    findings = detect_columns(dataset.rows, target)
    return {
        "dataset_id": dataset.dataset_id,
        "pii_column_count": len(findings),
        "findings": findings,
        "recommended_columns": list(findings.keys()),
    }


def preview_masking(dataset_id: str = "ds_eval", columns: list[str] | None = None) -> dict[str, Any]:
    dataset = _require(dataset_id)
    findings = detect_columns(dataset.rows, dataset.columns)
    selected = list(columns or findings.keys())
    selected = [col for col in selected if col in dataset.columns]
    if not selected:
        return {
            "dataset_id": dataset.dataset_id,
            "warning": "No PII columns selected for preview.",
            "columns": [],
            "rows": dataset.rows[:5],
            "masked_columns": [],
            "confirmation_token": None,
        }

    column_types = {
        col: str(findings.get(col, {}).get("primary_type") or "name") for col in selected
    }
    preview_source = dataset.rows[:5]
    masked_rows = apply_mask_to_rows(preview_source, selected, column_types)
    token = secrets.token_urlsafe(18)
    dataset.confirmation_token = token
    dataset.pending_columns = selected
    preview = {
        "dataset_id": dataset.dataset_id,
        "format": "table",
        "columns": dataset.columns,
        "rows": masked_rows,
        "masked_columns": selected,
        "column_types": column_types,
        "confirmation_token": token,
        "original_rows": preview_source,
    }
    dataset.last_preview = preview
    STORE.put(dataset)
    return preview


def apply_masking(
    dataset_id: str = "ds_eval",
    columns: list[str] | None = None,
    confirmation_token: str = "",
    confirmed: bool = False,
) -> dict[str, Any]:
    dataset = _require(dataset_id)
    token_ok = bool(confirmation_token) and confirmation_token == dataset.confirmation_token
    if not confirmed and not token_ok:
        return {
            "error": "confirmation_required",
            "message": "Masking is a write action. Preview first, then confirm. Do not set confirmed=true yourself.",
        }
    if confirmation_token and not token_ok:
        return {"error": "invalid_confirmation_token", "message": "Confirm the current masking preview first."}

    selected = [col for col in (columns or dataset.pending_columns) if col in dataset.columns]
    if not selected:
        findings = detect_columns(dataset.rows, dataset.columns)
        selected = list(findings.keys())
    if not selected:
        return {"error": "no_columns", "message": "No columns available to mask."}

    findings = detect_columns(dataset.rows, dataset.columns)
    column_types = {
        col: str(findings.get(col, {}).get("primary_type") or "name") for col in selected
    }
    dataset.versions["raw"] = [dict(row) for row in dataset.raw_rows] or [dict(row) for row in dataset.rows]
    dataset.rows = apply_mask_to_rows(dataset.rows, selected, column_types)
    dataset.versions["masked"] = [dict(row) for row in dataset.rows]
    dataset.masked = True
    dataset.confirmation_token = None
    dataset.pending_columns = []
    dataset.last_preview = {
        "dataset_id": dataset.dataset_id,
        "format": "table",
        "columns": dataset.columns,
        "rows": dataset.rows[:5],
        "masked_columns": selected,
        "column_types": column_types,
        "confirmation_token": None,
    }
    STORE.put(dataset)
    return {
        "status": "masked",
        "dataset_id": dataset.dataset_id,
        "columns": selected,
        "row_count": len(dataset.rows),
        "preview": dataset.last_preview,
        "version": "masked",
    }
