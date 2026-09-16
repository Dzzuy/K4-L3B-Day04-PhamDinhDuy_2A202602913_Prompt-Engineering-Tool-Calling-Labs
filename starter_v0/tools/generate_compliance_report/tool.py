from __future__ import annotations

import random
from typing import Any


def generate_compliance_report(dataset_name: str, proposal_id: str) -> dict[str, Any]:
    report_id = f"REP_{random.randint(1000, 9999)}"
    markdown_content = f"""# BÁO CÁO RÀ SOÁT TUÂN THỦ BẢO VỆ DỮ LIỆU CÁ NHÂN (NGHỊ ĐỊNH 13/2023/NĐ-CP)
- **Mã báo cáo:** {report_id}
- **Tên Dataset:** {dataset_name}
- **Mã chính sách đề xuất:** {proposal_id}
- **Đánh giá rủi ro chung:** HIGH RISK (Chứa dữ liệu y tế & CCCD)

## 1. Kết quả Rà soát PII
- Đã phát hiện các cột PII: `so_cccd` (HIGH), `so_dienthoai` (MEDIUM), `chan_doan` (HIGH).
- Trạng thái phê duyệt DPO: Đã được DPO thẩm định quy tắc che dữ liệu.

## 2. Phương án bảo vệ áp dụng
- `so_cccd`: Áp dụng Hashing SHA-256.
- `so_dienthoai`: Áp dụng MASK_MIDDLE (`0987***321`).
- `chan_doan`: Gom nhóm danh mục chung.

## 3. Khuyến nghị Tuân thủ
Tạo SQL View `v_{dataset_name.split('.')[0]}_masked` cho đội khai thác dữ liệu và phân quyền truy cập theo vai trò (RBAC).
"""

    return {
        "tool": "generate_compliance_report",
        "report_id": report_id,
        "dataset_name": dataset_name,
        "proposal_id": proposal_id,
        "status": "GENERATED",
        "markdown_report": markdown_content,
    }
