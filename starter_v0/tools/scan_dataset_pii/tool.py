from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PII_DATA_DIR = ROOT / "pii_data"


def scan_dataset_pii(dataset_name: str) -> dict[str, Any]:
    csv_path = PII_DATA_DIR / dataset_name
    detected_columns = []
    
    if csv_path.exists():
        with csv_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            for field in fieldnames:
                f_lower = field.lower()
                if "cccd" in f_lower or "cmnd" in f_lower:
                    detected_columns.append({"column": field, "pii_type": "NATIONAL_ID", "sample": "0123****8901"})
                elif "dienthoai" in f_lower or "phone" in f_lower:
                    detected_columns.append({"column": field, "pii_type": "PHONE_NUMBER", "sample": "0987***321"})
                elif "email" in f_lower:
                    detected_columns.append({"column": field, "pii_type": "EMAIL_ADDRESS", "sample": "a***@example.com"})
                elif "chan_doan" in f_lower or "benh" in f_lower or "health" in f_lower:
                    detected_columns.append({"column": field, "pii_type": "MEDICAL_DIAGNOSIS", "sample": "Chẩn đoán y tế nhạy cảm"})
                elif "bhyt" in f_lower:
                    detected_columns.append({"column": field, "pii_type": "HEALTH_INSURANCE_ID", "sample": "BHYT****5678"})
    else:
        # Fallback default simulated output for dataset name
        detected_columns = [
            {"column": "so_cccd", "pii_type": "NATIONAL_ID", "sample": "0123****8901"},
            {"column": "so_dienthoai", "pii_type": "PHONE_NUMBER", "sample": "0987***321"},
            {"column": "chan_doan", "pii_type": "MEDICAL_DIAGNOSIS", "sample": "Theo dõi bệnh lý"},
        ]

    return {
        "tool": "scan_dataset_pii",
        "dataset_name": dataset_name,
        "status": "SCANNED",
        "total_pii_columns_found": len(detected_columns),
        "detected_pii_columns": detected_columns,
    }
