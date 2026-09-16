from __future__ import annotations

from typing import Any


def classify_pii_sensitivity(dataset_name: str, columns: list[str]) -> dict[str, Any]:
    classification = []
    for col in columns:
        col_lower = col.lower()
        if any(keyword in col_lower for keyword in ["cccd", "cmnd", "chan_doan", "benh", "bhyt", "health"]):
            risk_level = "HIGH"
            legal_basis = "Điều 2 & Điều 28 Nghị định 13/2023/NĐ-CP (Dữ liệu y tế và định danh nhạy cảm)"
        elif any(keyword in col_lower for keyword in ["dienthoai", "phone", "email", "dia_chi"]):
            risk_level = "MEDIUM"
            legal_basis = "Điều 2 Nghị định 13/2023/NĐ-CP (Dữ liệu cá nhân cơ bản)"
        else:
            risk_level = "LOW"
            legal_basis = "Dữ liệu định danh chung"
            
        classification.append({
            "column": col,
            "risk_level": risk_level,
            "legal_basis": legal_basis,
        })

    return {
        "tool": "classify_pii_sensitivity",
        "dataset_name": dataset_name,
        "classification": classification,
        "overall_dataset_risk": "HIGH" if any(item["risk_level"] == "HIGH" for item in classification) else "MEDIUM",
    }
