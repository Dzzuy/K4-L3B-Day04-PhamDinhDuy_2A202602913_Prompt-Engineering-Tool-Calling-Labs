from __future__ import annotations

from typing import Any


def generate_masked_view(dataset_name: str, proposal_id: str, view_name: str) -> dict[str, Any]:
    base_table = dataset_name.split(".")[0]
    sql_ddl = f"""CREATE VIEW {view_name} AS
SELECT
    patient_id,
    full_name,
    SHA256(so_cccd) AS so_cccd_hashed,
    CONCAT(SUBSTR(so_dienthoai, 1, 4), '***', SUBSTR(so_dienthoai, 8)) AS so_dienthoai_masked,
    email,
    ngay_sinh,
    nhom_mau,
    chan_doan,
    ma_bhyt
FROM {base_table};"""

    return {
        "tool": "generate_masked_view",
        "dataset_name": dataset_name,
        "proposal_id": proposal_id,
        "view_name": view_name,
        "status": "CREATED_SUCCESSFULLY",
        "sql_ddl": sql_ddl,
    }
