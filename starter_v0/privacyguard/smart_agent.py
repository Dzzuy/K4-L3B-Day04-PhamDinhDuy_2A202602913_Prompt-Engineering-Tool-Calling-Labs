from __future__ import annotations

import re
from typing import Any
from .store import Dataset
from .privacy_tools import (
    inspect_csv,
    detect_pii,
    analyze_risk,
    create_masking_policy,
    mask_csv,
    generate_report,
)


def answer_dataset_query(dataset: Dataset, query: str) -> str | None:
    """Analyze the actual rows in dataset and answer conversational/deep analytical questions."""
    q = query.lower().strip()
    rows = dataset.rows
    columns = dataset.columns

    # 1. Email domain queries (e.g. "có bao nhiêu email đuôi @gmail.com", "email @northstar.example")
    if "email" in q and ("bao nhiêu" in q or "đuôi" in q or "@" in q or "domain" in q):
        email_col = next((c for c in columns if "email" in c.lower() or "mail" in c.lower()), None)
        if not email_col:
            return "File này không có cột chứa định dạng Email."

        # check specific domain if mentioned
        domain_match = re.search(r"@([a-z0-9.-]+\.[a-z]{2,})", q)
        if domain_match:
            target_domain = domain_match.group(1).lower()
            matching = [r for r in rows if f"@{target_domain}" in str(r.get(email_col, "")).lower()]
            total = len(matching)
            examples = [str(r.get(email_col, "")) for r in matching[:3]]
            ex_str = f" (ví dụ: {', '.join(examples)})" if examples else ""
            return (
                f"Trong file '{dataset.filename}', có **{total:,}** địa chỉ email thuộc tên miền `@{target_domain}`{ex_str}.\n"
                f"Tổng số bản ghi email hợp lệ là {len(rows):,}."
            )
        else:
            domains: dict[str, int] = {}
            for r in rows:
                val = str(r.get(email_col, "")).lower()
                if "@" in val:
                    dom = val.split("@")[-1]
                    domains[dom] = domains.get(dom, 0) + 1
            sorted_doms = sorted(domains.items(), key=lambda x: x[1], reverse=True)
            dom_lines = "\n".join([f"• `@{d}`: {cnt} địa chỉ" for d, cnt in sorted_doms[:5]])
            return (
                f"Thống kê các tên miền email trong file '{dataset.filename}':\n"
                f"{dom_lines}\n"
                f"Tổng cộng: {len(rows):,} email."
            )

    # 2. Highest risk / sensitive persons (e.g. "ai là người có rủi ro cao nhất?", "ai có CCCD")
    if ("ai" in q or "người" in q) and ("rủi ro" in q or "cao nhất" in q or "nguy cơ" in q or "nhạy cảm" in q):
        name_col = next((c for c in columns if any(k in c.lower() for k in ("name", "tên", "ho_ten", "full_name"))), None)
        cccd_col = next((c for c in columns if any(k in c.lower() for k in ("cccd", "cmnd", "ssn", "national_id"))), None)
        salary_col = next((c for c in columns if any(k in c.lower() for k in ("salary", "lương", "thu_nhap"))), None)

        if not name_col:
            name_col = columns[0]

        high_risk_rows = []
        for r in rows:
            risk_score = 0
            reasons = []
            if cccd_col and str(r.get(cccd_col, "")):
                risk_score += 3
                reasons.append("lộ CCCD/SSN")
            if salary_col and str(r.get(salary_col, "")):
                risk_score += 2
                reasons.append("lộ thông tin lương")
            if risk_score >= 3:
                high_risk_rows.append((r.get(name_col, "Unknown"), reasons))

        if high_risk_rows:
            sample_list = "\n".join([f"• **{name}**: Bị {', '.join(reasons)}" for name, reasons in high_risk_rows[:4]])
            return (
                f"Phân tích rủi ro cá nhân trong file '{dataset.filename}':\n"
                f"Có **{len(high_risk_rows):,} cá nhân** ở mức rủi ro **CRITICAL** do đồng thời bị lộ số định danh công dân và thông tin tài chính.\n\n"
                f"Một số trường hợp tiêu biểu:\n{sample_list}\n\n"
                f"👉 Khuyến nghị: Cần thực thi tool `mask_csv` ngay để che mờ các trường CCCD và Lương."
            )

    # 3. Salary / Financial summary
    if "lương" in q or "salary" in q or "tiền" in q or "thu nhập" in q:
        sal_col = next((c for c in columns if any(k in c.lower() for k in ("salary", "lương", "thu_nhap"))), None)
        if sal_col:
            vals = []
            for r in rows:
                raw_v = re.sub(r"[^\d]", "", str(r.get(sal_col, "")))
                if raw_v:
                    try:
                        vals.append(int(raw_v))
                    except ValueError:
                        pass
            if vals:
                avg_sal = sum(vals) // len(vals)
                max_sal = max(vals)
                min_sal = min(vals)
                return (
                    f"Thống kê thông tin lương/tài chính (cột `{sal_col}`):\n"
                    f"• Mức lương cao nhất: **{max_sal:,}**\n"
                    f"• Mức lương thấp nhất: **{min_sal:,}**\n"
                    f"• Trung bình: **{avg_sal:,}**\n\n"
                    f"⚠️ Đây là Dữ liệu cá nhân nhạy cảm theo Điều 2 Khoản 4 Nghị định 13/2023/NĐ-CP. Agent đề xuất áp dụng policy `FULL_MASK` hoặc `SYNTHETIC`."
                )

    # 4. Count / General records
    if "bao nhiêu" in q and ("dòng" in q or "hàng" in q or "bản ghi" in q or "cột" in q or "record" in q):
        return (
            f"File '{dataset.filename}' hiện có:\n"
            f"• **{dataset.virtual_record_count or len(rows):,}** bản ghi (records/hàng)\n"
            f"• **{len(columns)}** cột: `{', '.join(columns)}`"
        )

    return None
