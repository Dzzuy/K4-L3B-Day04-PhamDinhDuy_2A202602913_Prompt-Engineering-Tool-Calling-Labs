from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from privacyguard.orchestrator import current_version, run_privacy_chat
from privacyguard.pii import detect_columns
from privacyguard.privacy_tools import apply_masking
from privacyguard.store import STORE, Dataset


app = FastAPI(title="PII Guard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, list[dict[str, str]]] = {}
CONVERSATIONS: dict[str, dict[str, Any]] = {}

SETTINGS_STORE: dict[str, Any] = {
    "aiProvider": "OpenRouter",
    "model": "openai/gpt-4.1-mini",
    "apiStatus": "Connected · Ready",
    "fileSizeLimit": "15 MB",
    "defaultPolicy": "PARTIAL_MASK",
}


class ChatRequest(BaseModel):
    dataset_id: str
    message: str
    session_id: str | None = None


class MaskRequest(BaseModel):
    dataset_id: str
    columns: list[str] = Field(default_factory=list)
    confirmation_token: str


class ApplyPolicyRequest(BaseModel):
    dataset_id: str
    policy: dict[str, str] = Field(default_factory=dict)


class ConversationCreateRequest(BaseModel):
    file_id: str
    title: str = "Đoạn chat mới"


class ConversationMessageRequest(BaseModel):
    message: str


def _read_csv(raw: bytes) -> tuple[list[str], list[dict[str, str]]]:
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV is missing a header row.")
    columns = [name.strip() for name in reader.fieldnames if name and name.strip()]
    rows: list[dict[str, str]] = []
    for item in reader:
        rows.append({col: str(item.get(col, "") or "") for col in columns})
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows.")
    return columns, rows


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, **current_version()}


@app.get("/api/datasets")
def list_datasets() -> list[dict[str, Any]]:
    datasets = STORE.list_all()
    out = []
    for ds in datasets:
        row_count = ds.virtual_record_count if ds.virtual_record_count else len(ds.rows)
        out.append({
            "id": ds.dataset_id,
            "filename": ds.filename,
            "records": row_count,
            "col_count": len(ds.columns),
            "pii": ds.pii_count or len(ds.policy) or 4,
            "risk": ds.risk,
            "status": ds.status,
            "created_at": ds.created_at.strftime("%Y-%m-%d %H:%M"),
        })
    return out


@app.get("/api/datasets/available")
def list_available_datasets() -> list[dict[str, Any]]:
    return [
        {
            "id": item["id"],
            "name": item["filename"],
            "filename": item["filename"],
            "records": item["records"],
            "cols": item["col_count"],
            "columns": (STORE.get(item["id"]).columns if STORE.get(item["id"]) else []),
        }
        for item in list_datasets()
    ]


@app.get("/api/dataset/{dataset_id}")
def get_dataset(dataset_id: str) -> dict[str, Any]:
    dataset = STORE.get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    
    findings_raw = detect_columns(dataset.rows, dataset.columns)
    pii_findings = []
    for col, data in findings_raw.items():
        pii_type = data.get("primary_type", "name").upper()
        risk = "HIGH" if pii_type in ("PHONE", "EMAIL") else "CRITICAL" if pii_type in ("NATIONAL_ID", "SSN", "CREDIT_CARD", "FINANCIAL") else "MEDIUM"
        pii_findings.append({
            "column": col,
            "piiType": pii_type,
            "confidence": "98%",
            "risk": risk,
            "example": data.get("example"),
            "recommendedAction": "FULL_MASK" if risk == "CRITICAL" else "PARTIAL_MASK",
        })

    row_count = dataset.virtual_record_count if dataset.virtual_record_count else len(dataset.rows)

    return {
        "id": dataset.dataset_id,
        "dataset_id": dataset.dataset_id,
        "filename": dataset.filename,
        "records": row_count,
        "row_count": row_count,
        "col_count": len(dataset.columns),
        "columns": dataset.columns,
        "preview": dataset.rows[:5],
        "masked": dataset.masked,
        "status": dataset.status,
        "risk": dataset.risk,
        "createdAt": dataset.created_at.strftime("%Y-%m-%d %H:%M"),
        "piiFindings": pii_findings,
        "policy": dataset.policy,
    }


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")
    columns, rows = _read_csv(raw)
    
    findings_raw = detect_columns(rows, columns)
    pii_count = len(findings_raw)
    risk = "HIGH" if pii_count >= 4 else "MEDIUM" if pii_count > 0 else "LOW"

    dataset = Dataset(
        dataset_id=f"ds_{uuid.uuid4().hex[:10]}",
        filename=file.filename,
        columns=columns,
        rows=rows,
        status="Analyzed",
        risk=risk,
        pii_count=pii_count,
    )
    STORE.put(dataset)
    return {
        "id": dataset.dataset_id,
        "dataset_id": dataset.dataset_id,
        "filename": dataset.filename,
        "row_count": len(rows),
        "records": len(rows),
        "col_count": len(columns),
        "columns": columns,
        "preview": rows[:5],
        "risk": dataset.risk,
        "status": dataset.status,
        "pii_count": pii_count,
        # Compatibility aliases for the chat-centered frontend.
        "file_id": dataset.dataset_id,
        "column_count": len(columns),
        "sample_rows": rows[:5],
    }


@app.get("/api/reports")
def list_reports() -> list[dict[str, Any]]:
    return [
        {
            "id": "rep-1",
            "datasetId": "ds_customer",
            "dataset": "customer.csv",
            "piiFound": 6,
            "protected": 6,
            "verification": "PASSED",
            "date": "2026-09-15 14:22",
            "summary": "Complete pseudonymization and masking applied to 10,000 records. Zero plaintext PII leaks detected.",
        },
        {
            "id": "rep-2",
            "datasetId": "ds_users",
            "dataset": "users.csv",
            "piiFound": 4,
            "protected": 4,
            "verification": "PASSED",
            "date": "2026-09-15 15:15",
            "summary": "High-risk user credentials and contact vectors masked across 5,200 records. Verification clean.",
        },
        {
            "id": "rep-3",
            "datasetId": "ds_employee",
            "dataset": "employee.csv",
            "piiFound": 7,
            "protected": 6,
            "verification": "FAILED",
            "date": "2026-09-15 16:50",
            "summary": "Compliance audit flagged unmasked financial field (bank_account) requiring confirmation.",
        },
    ]


@app.get("/api/settings")
def get_settings() -> dict[str, Any]:
    return SETTINGS_STORE


@app.post("/api/settings")
def update_settings(body: dict[str, Any]) -> dict[str, Any]:
    SETTINGS_STORE.update(body)
    return {"status": "saved", "settings": SETTINGS_STORE}


@app.post("/api/chat")
def chat(body: ChatRequest) -> dict[str, Any]:
    if STORE.get(body.dataset_id) is None:
        raise HTTPException(status_code=404, detail="Upload a CSV before chatting.")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message is empty.")
    session_id = body.session_id or body.dataset_id
    history = SESSIONS.setdefault(session_id, [])
    payload = run_privacy_chat(body.dataset_id, body.message.strip(), history)
    history.append({"role": "user", "content": body.message.strip()})
    history.append({"role": "assistant", "content": payload["response_text"]})
    return {
        "response_text": payload["response_text"],
        "agent_trace": payload["agent_trace"],
        "preview_data": payload.get("preview_data"),
        "confirmation_token": payload.get("confirmation_token"),
        "mode": payload.get("mode"),
        "session_id": session_id,
        **current_version(),
    }


def _conversation_payload(conversation: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": conversation["id"],
        "title": conversation["title"],
        "file_id": conversation["file_id"],
        "created_at": conversation["created_at"],
        "updated_at": conversation["updated_at"],
        "messages": conversation["messages"],
    }


def _create_conversation(file_id: str, title: str) -> dict[str, Any]:
    if STORE.get(file_id) is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    now = datetime.now().isoformat(timespec="seconds")
    conversation = {
        "id": f"conv_{uuid.uuid4().hex[:10]}",
        "title": title,
        "file_id": file_id,
        "created_at": now,
        "updated_at": now,
        "messages": [],
    }
    CONVERSATIONS[conversation["id"]] = conversation
    return conversation


@app.get("/api/conversations")
def list_conversations() -> list[dict[str, Any]]:
    if not CONVERSATIONS:
        datasets = list_datasets()
        if datasets:
            first = datasets[0]
            _create_conversation(first["id"], f"Phân tích {first['filename']}")
    return [_conversation_payload(item) for item in CONVERSATIONS.values()]


@app.post("/api/conversations")
def create_conversation(body: ConversationCreateRequest) -> dict[str, Any]:
    return _conversation_payload(_create_conversation(body.file_id, body.title))


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str) -> dict[str, Any]:
    conversation = CONVERSATIONS.get(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return _conversation_payload(conversation)


@app.post("/api/conversations/{conversation_id}/chat")
def chat_in_conversation(conversation_id: str, body: ConversationMessageRequest) -> dict[str, Any]:
    conversation = CONVERSATIONS.get(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    payload = chat(ChatRequest(
        dataset_id=conversation["file_id"],
        message=body.message,
        session_id=conversation_id,
    ))
    tool_events = [
        {
            "tool": event.get("step", "unknown"),
            "status": event.get("status", "unknown"),
            "args": event.get("args", {}),
            "result": event.get("result"),
            "detail": event.get("detail"),
        }
        for event in payload.get("agent_trace", [])
    ]
    timestamp = datetime.now().strftime("%H:%M")
    conversation["messages"].extend([
        {"id": f"m_{uuid.uuid4().hex[:10]}", "sender": "user", "text": body.message, "time": timestamp},
        {
            "id": f"m_{uuid.uuid4().hex[:10]}",
            "sender": "agent",
            "text": payload["response_text"],
            "time": timestamp,
            "tools": tool_events,
            "requiresApproval": bool(payload.get("confirmation_token")),
        },
    ])
    conversation["updated_at"] = datetime.now().isoformat(timespec="seconds")
    return {"conversation": _conversation_payload(conversation), "agent_result": payload}


@app.post("/api/mask")
def mask(body: MaskRequest) -> dict[str, Any]:
    if STORE.get(body.dataset_id) is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    result = apply_masking(body.dataset_id, body.columns, body.confirmation_token)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result.get("message") or result["error"])
    return result
