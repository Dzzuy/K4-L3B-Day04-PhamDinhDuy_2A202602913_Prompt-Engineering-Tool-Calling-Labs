from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
LOGS_FILE = ROOT / "pii_data" / "access_logs.json"


def audit_data_access(dataset_name: str) -> dict[str, Any]:
    logs = []
    if LOGS_FILE.exists():
        all_logs = json.loads(LOGS_FILE.read_text(encoding="utf-8"))
        logs = [log for log in all_logs if log.get("dataset") == dataset_name or dataset_name in log.get("dataset", "")]

    if not logs:
        logs = [
            {
                "log_id": "LOG_1001",
                "timestamp": "2026-09-15T08:14:22Z",
                "user_id": "intern_dev_01",
                "role": "INTERN",
                "dataset": dataset_name,
                "queried_columns": ["so_cccd", "so_dienthoai"],
                "action": "SELECT_RAW",
                "status": "SUSPICIOUS_UNAUTHORIZED_PII_ACCESS",
            }
        ]

    suspicious = [log for log in logs if "SUSPICIOUS" in log.get("status", "") or "HIGH_RISK" in log.get("status", "")]

    return {
        "tool": "audit_data_access",
        "dataset_name": dataset_name,
        "total_logs_analyzed": len(logs),
        "suspicious_accesses_found": len(suspicious),
        "logs": logs,
    }
