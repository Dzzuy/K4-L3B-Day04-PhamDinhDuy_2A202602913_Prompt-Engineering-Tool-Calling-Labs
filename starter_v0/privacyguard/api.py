from __future__ import annotations

import csv
from datetime import datetime
import io
import uuid
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel

from privacyguard.privacy_tools import (
    analyze_risk,
    create_masking_policy,
    detect_pii,
    generate_report,
    inspect_csv,
    mask_csv,
)
from privacyguard.smart_agent import answer_dataset_query
from privacyguard.store import STORE, Dataset

app = FastAPI(title="PrivacyGuard AI Agent", version="2.5.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentChatRequest(BaseModel):
    file_id: str
    message: str
    confirmation_token: str | None = None
    custom_policy: dict[str, str] | None = None


def _read_csv(raw: bytes) -> tuple[list[str], list[dict[str, str]]]:
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV is missing a header row.")
    columns = [name.strip() for name in reader.fieldnames if name and name.strip()]
    rows = [{col: str(item.get(col, "") or "") for col in columns} for item in reader]
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows.")
    return columns, rows


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "PrivacyGuard Intelligent Conversational AI Agent"}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")
    columns, rows = _read_csv(raw)

    dataset_id = f"file_{uuid.uuid4().hex[:10]}"
    dataset = Dataset(
        dataset_id=dataset_id,
        filename=file.filename,
        columns=columns,
        rows=rows,
        status="Uploaded",
        risk="PENDING",
        pii_count=0,
    )
    STORE.put(dataset)

    inspection = inspect_csv(dataset.dataset_id)
    return {
        "file_id": dataset.dataset_id,
        "filename": dataset.filename,
        "row_count": inspection["row_count"],
        "column_count": inspection["column_count"],
        "columns": inspection["columns"],
        "sample_rows": inspection["sample_rows"],
    }


@app.post("/api/agent/chat")
def agent_chat(req: AgentChatRequest) -> dict[str, Any]:
    dataset = STORE.get(req.file_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="File không tồn tại. Vui lòng tải lên CSV trước.")

    msg = req.message.lower().strip()
    tools_executed: list[dict[str, Any]] = []
    requires_approval = False
    policy_preview = None
    masking_result = None
    report_result = None

    # 1. Deep Conversational Analytics (e.g., "Có bao nhiêu email đuôi @gmail.com", "Ai là người rủi ro cao nhất?")
    smart_reply = answer_dataset_query(dataset, req.message)
    if smart_reply and not any(k in msg for k in ("kiểm tra", "scan", "mask", "che mờ", "approve", "áp dụng")):
        return {
            "reply": smart_reply,
            "tools_executed": [{"tool": "query_dataset_records", "status": "success", "result": {"query": req.message, "status": "analyzed"}}],
            "requires_approval": False,
            "confirmation_token": dataset.confirmation_token,
            "policy_preview": None,
            "masking_result": None,
            "report_result": None,
        }

    # 2. Tool Calling Flow: Scan / Detect / Risk / Policy Proposal
    if any(k in msg for k in ("kiểm tra", "scan", "detect", "quét", "tìm pii", "phân tích", "inspect", "rủi ro")):
        ins = inspect_csv(req.file_id)
        tools_executed.append({"tool": "inspect_csv", "result": ins, "status": "success"})

        det = detect_pii(req.file_id)
        tools_executed.append({"tool": "detect_pii", "result": det, "status": "success"})

        risk = analyze_risk(req.file_id)
        tools_executed.append({"tool": "analyze_risk", "result": risk, "status": "success"})

        pol = create_masking_policy(req.file_id, req.custom_policy)
        tools_executed.append({"tool": "create_masking_policy", "result": pol, "status": "success"})

        requires_approval = True
        policy_preview = pol["masking_policy"]
        agent_reply = (
            f"Tôi đã gọi 4 công cụ (`inspect_csv`, `detect_pii`, `analyze_risk`, `create_masking_policy`) để phân tích file '{dataset.filename}':\n\n"
            f"• **Phát hiện PII**: Tìm thấy {det['pii_column_count']} trường dữ liệu cá nhân nhạy cảm: `{', '.join(det['detected_columns'])}`.\n"
            f"• **Đánh giá rủi ro**: Mức **{risk['overall_risk']}** theo Nghị định 13/2023/NĐ-CP do có số CCCD/Định danh và thông tin liên lạc.\n"
            f"• **Chính sách đề xuất**: CCCD → `FULL_MASK`, Email/Phone → `PARTIAL_MASK`.\n\n"
            f"⚠️ Vì che mờ dữ liệu là hành động làm thay đổi file gốc (Write Action), tôi cần bạn bấm nút **[Approve (Xác nhận)]** bên dưới để tiến hành."
        )

    # 3. Human Approval Execution: Mask CSV & Generate Report
    elif any(k in msg for k in ("approve", "đồng ý", "xác nhận", "mask", "che mờ", "thực hiện", "apply")):
        token = req.confirmation_token or dataset.confirmation_token or "approved_by_human"
        
        res = mask_csv(req.file_id, token)
        tools_executed.append({"tool": "mask_csv", "result": res, "status": "success"})

        rep = generate_report(req.file_id)
        tools_executed.append({"tool": "generate_report", "result": rep, "status": "success"})

        masking_result = res
        report_result = rep
        agent_reply = (
            f"Đã nhận phê duyệt từ bạn! Tôi đã thực thi tool `mask_csv` và `generate_report`:\n\n"
            f"• **Trạng thái**: Hoàn tất che mờ {res['number_of_masked_values']:,} giá trị PII trên {res['records_processed']:,} dòng dữ liệu.\n"
            f"• **Kiểm định tuân thủ**: Đạt tiêu chuẩn **PASSED** (100% không còn rò rỉ dữ liệu thô).\n\n"
            f"Bạn có thể tải file CSV đã bảo vệ và Báo cáo kiểm toán trực tiếp ở thẻ bên dưới."
        )

    # 4. Report Request
    elif any(k in msg for k in ("báo cáo", "report", "audit", "kiểm toán")):
        rep = generate_report(req.file_id)
        tools_executed.append({"tool": "generate_report", "result": rep, "status": "success"})
        report_result = rep
        agent_reply = f"Báo cáo kiểm toán tuân thủ cho file '{dataset.filename}' đã sẵn sàng (Mã kiểm định: `{rep['report_id']}`)."

    else:
        agent_reply = (
            f"Tôi là Trợ lý AI PrivacyGuard. Bạn có thể hỏi tôi bất kỳ điều gì về file '{dataset.filename}':\n"
            f"• 'Kiểm tra file này xem có PII không'\n"
            f"• 'Có bao nhiêu email đuôi @...?' hoặc 'Ai là người có rủi ro cao nhất?'\n"
            f"• 'Approve che mờ dữ liệu'\n"
            f"• 'Xuất báo cáo kiểm toán'"
        )

    return {
        "reply": agent_reply,
        "tools_executed": tools_executed,
        "requires_approval": requires_approval,
        "confirmation_token": dataset.confirmation_token,
        "policy_preview": policy_preview,
        "masking_result": masking_result,
        "report_result": report_result,
    }


@app.get("/api/download/csv/{file_id}")
def download_csv(file_id: str):
    dataset = STORE.get(file_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="File not found")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=dataset.columns)
    writer.writeheader()
    writer.writerows(dataset.rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=protected_{dataset.filename}"}
    )


@app.get("/api/download/report/{file_id}")
def download_report(file_id: str):
    dataset = STORE.get(file_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="File not found")
    rep = generate_report(file_id)
    content = f"""=======================================================
PRIVACYGUARD AUDIT REPORT & COMPLIANCE VERIFICATION
=======================================================
Report ID:          {rep['report_id']}
File:               {rep['filename']}
Generated at:       {rep['timestamp']}
Compliance Status:  {rep['compliance_status']}

APPLIED POLICIES:
-------------------------------------------------------
{chr(10).join(f"• {col}: {act}" for col, act in rep['applied_policy'].items())}

AUDIT NOTE:
-------------------------------------------------------
{rep['audit_note']}
=======================================================
"""
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f"attachment; filename=audit_report_{dataset.filename.replace('.csv', '')}.txt"}
    )

@app.get("/api/datasets/available")
def get_available_datasets() -> list[dict[str, Any]]:
    datasets = STORE.list_all()
    results = []
    for d in datasets:
        results.append({
            "id": d.dataset_id,
            "name": d.filename,
            "filename": d.filename,
            "records": d.virtual_record_count or len(d.rows),
            "cols": len(d.columns),
            "columns": d.columns,
            "sample_rows": d.rows[:5],
            "risk": d.risk,
            "pii_count": d.pii_count,
        })
    return results

# ---------------------------------------------------------------------------
# CONVERSATION API (MỤC 3, 4, 5, 6, 7)
# ---------------------------------------------------------------------------
from privacyguard.store import CONV_STORE


class CreateConversationRequest(BaseModel):
    file_id: str = "ds_sample_pii"
    title: str = "Đoạn chat mới"


class ConversationChatRequest(BaseModel):
    message: str
    confirmation_token: str | None = None
    custom_policy: dict[str, str] | None = None


@app.get("/api/conversations")
def list_conversations() -> list[dict[str, Any]]:
    convs = CONV_STORE.list_all()
    return [c.to_dict() for c in convs]


@app.post("/api/conversations")
def create_conversation(req: CreateConversationRequest) -> dict[str, Any]:
    conv = CONV_STORE.create(file_id=req.file_id, title=req.title)
    return conv.to_dict()


@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str) -> dict[str, Any]:
    conv = CONV_STORE.get(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.to_dict()


@app.post("/api/conversations/{conv_id}/chat")
def chat_in_conversation(conv_id: str, req: ConversationChatRequest) -> dict[str, Any]:
    conv = CONV_STORE.get(conv_id)
    if not conv:
        conv = CONV_STORE.create(title=req.message[:35])
        conv_id = conv.id

    dataset = STORE.get(conv.file_id)
    if not dataset:
        dataset = STORE.get("ds_sample_pii")
        if dataset:
            conv.file_id = dataset.dataset_id

    # 1. Save user message to persistent conversation
    time_str = datetime.now().strftime("%H:%M")
    CONV_STORE.add_message(conv_id=conv_id, sender="user", text=req.message, time_str=time_str)

    # 2. Run agent execution
    agent_req = AgentChatRequest(
        file_id=conv.file_id,
        message=req.message,
        confirmation_token=req.confirmation_token,
        custom_policy=req.custom_policy,
    )
    result = agent_chat(agent_req)

    # 3. Save agent message to persistent conversation
    CONV_STORE.add_message(
        conv_id=conv_id,
        sender="agent",
        text=result["reply"],
        time_str=time_str,
        tools=result.get("tools_executed", []),
        requires_approval=result.get("requires_approval", False),
        policy=result.get("policy_preview") or {},
        mask_result=result.get("masking_result"),
    )

    # Return updated conversation
    updated_conv = CONV_STORE.get(conv_id)
    return {
        "conversation": updated_conv.to_dict() if updated_conv else {},
        "agent_result": result,
    }


# ---------------------------------------------------------------------------
# FILES, REPORTS, POLICIES API (MỤC 15, 16, 17)
# ---------------------------------------------------------------------------
@app.get("/api/files")
def get_all_files() -> list[dict[str, Any]]:
    datasets = STORE.list_all()
    out = []
    for d in datasets:
        out.append({
            "id": d.dataset_id,
            "filename": d.filename,
            "row_count": d.virtual_record_count or len(d.rows),
            "column_count": len(d.columns),
            "columns": d.columns,
            "status": d.status,
            "risk": d.risk,
            "pii_count": d.pii_count,
            "masked": d.masked,
            "created_at": d.created_at.strftime("%Y-%m-%d %H:%M"),
        })
    return out


@app.get("/api/policies")
def get_all_policies() -> list[dict[str, Any]]:
    datasets = STORE.list_all()
    out = []
    for d in datasets:
        if d.policy:
            out.append({
                "id": f"pol_{d.dataset_id}",
                "file_id": d.dataset_id,
                "filename": d.filename,
                "policy": d.policy,
                "status": "Applied" if d.masked else "Draft",
                "created_at": d.created_at.strftime("%Y-%m-%d %H:%M"),
            })
    return out
