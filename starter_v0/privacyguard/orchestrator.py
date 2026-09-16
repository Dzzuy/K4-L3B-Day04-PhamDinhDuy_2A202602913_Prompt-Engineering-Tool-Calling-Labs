from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from chat import run_model_tool_loop
from env_loader import load_lab_env
from privacyguard.privacy_tools import detect_pii, preview_masking, scan_dataset
from tools import TOOL_FUNCTIONS, load_tool_declarations, to_openai_tools
from versioning import artifact_version_dict, build_artifact_version


ROOT = Path(__file__).resolve().parent.parent
load_lab_env(ROOT)

FINAL_ARTIFACTS = ROOT / "artifacts" / "versions" / "v3"
PRIVACY_PROMPT = FINAL_ARTIFACTS / "system_prompt.md"
PRIVACY_TOOLS = FINAL_ARTIFACTS / "tools.yaml"
FINAL_MODEL = "openai/gpt-4.1-mini"


def _trace_event(name: str, args: dict[str, Any], result: Any, status: str = "success") -> dict[str, Any]:
    if isinstance(result, dict) and result.get("error"):
        status = "warning"
    return {
        "step": name,
        "status": status,
        "args": args,
        "result": result,
        "detail": _detail_for(name, result, status),
    }


def _detail_for(name: str, result: Any, status: str) -> str:
    if status == "warning" and isinstance(result, dict):
        return str(result.get("message") or result.get("error") or "warning")
    if name == "scan_dataset" and isinstance(result, dict):
        return f"{result.get('row_count', 0)} rows · {result.get('col_count', 0)} columns"
    if name == "detect_pii" and isinstance(result, dict):
        return f"{result.get('pii_column_count', 0)} PII column(s)"
    if name == "preview_masking" and isinstance(result, dict):
        cols = result.get("masked_columns") or []
        return f"Preview ready for {', '.join(cols) if cols else 'no columns'}"
    return status


def deterministic_pipeline(dataset_id: str) -> dict[str, Any]:
    scan = scan_dataset(dataset_id)
    detect = detect_pii(dataset_id)
    preview = preview_masking(dataset_id, detect.get("recommended_columns"))
    trace = [
        _trace_event("scan_dataset", {"dataset_id": dataset_id}, scan),
        _trace_event("detect_pii", {"dataset_id": dataset_id}, detect),
        _trace_event("preview_masking", {"dataset_id": dataset_id, "columns": detect.get("recommended_columns")}, preview),
    ]
    columns = detect.get("recommended_columns") or []
    response_text = (
        f"Scan complete. I found PII in {len(columns)} column(s): {', '.join(columns) or 'none'}. "
        "Review the masked preview, then click Confirm Masking to write the redaction."
    )
    return {
        "response_text": response_text,
        "agent_trace": trace,
        "preview_data": preview if preview.get("masked_columns") else None,
        "confirmation_token": preview.get("confirmation_token"),
        "mode": "deterministic",
    }


def _provider_name() -> str | None:
    if os.getenv("OPENROUTER_API_KEY"):
        return "openrouter"
    return None


def llm_pipeline(dataset_id: str, message: str, history: list[dict[str, str]]) -> dict[str, Any] | None:
    provider_name = _provider_name()
    if not provider_name:
        return None
    try:
        from providers import make_provider
    except Exception:
        return None

    try:
        provider = make_provider(provider_name)
        tools = to_openai_tools(load_tool_declarations(PRIVACY_TOOLS))
        system_prompt = PRIVACY_PROMPT.read_text(encoding="utf-8")
        user_text = (
            f"dataset_id={dataset_id}\n"
            f"{message.strip()}\n"
            "Use only the declared PrivacyGuard tools when a tool is needed. Preserve identifiers exactly."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            *history[-8:],
            {"role": "user", "content": user_text},
        ]
        result = run_model_tool_loop(
            provider=provider,
            messages=messages,
            tools=tools,
            model=FINAL_MODEL,
            max_tool_rounds=4,
        )
    except Exception:
        return None

    trace = []
    preview = None
    token = None
    for event in result.get("tool_events") or []:
        name = event.get("tool") or "unknown"
        args = event.get("args") or {}
        tool_result = event.get("result")
        status = "warning" if isinstance(tool_result, dict) and tool_result.get("error") else "success"
        trace.append(_trace_event(name, args, tool_result, status))
        if name == "preview_masking" and isinstance(tool_result, dict):
            preview = tool_result
            token = tool_result.get("confirmation_token")

    if not trace:
        return None

    return {
        "response_text": result.get("assistant_text") or "Review the tool trace and masking preview.",
        "agent_trace": trace,
        "preview_data": preview,
        "confirmation_token": token,
        "mode": "llm",
        "status": result.get("status"),
    }


def run_privacy_chat(dataset_id: str, message: str, history: list[dict[str, str]]) -> dict[str, Any]:
    lowered = message.lower()
    if any(word in lowered for word in ("scan", "detect", "pii", "mask", "preview", "redact")):
        llm = llm_pipeline(dataset_id, message, history)
        if llm:
            if not llm.get("preview_data"):
                fallback = deterministic_pipeline(dataset_id)
                llm["preview_data"] = fallback["preview_data"]
                llm["confirmation_token"] = fallback["confirmation_token"]
                existing_steps = {item["step"] for item in llm["agent_trace"]}
                for event in fallback["agent_trace"]:
                    if event["step"] not in existing_steps:
                        llm["agent_trace"].append(event)
            return llm
        return deterministic_pipeline(dataset_id)

    llm = llm_pipeline(dataset_id, message, history)
    if llm:
        return llm

    return {
        "response_text": (
            "I can scan the uploaded CSV for PII and prepare a masking preview. "
            "Ask me to scan the dataset, or name columns you want redacted."
        ),
        "agent_trace": [
            {
                "step": "awaiting_intent",
                "status": "pending",
                "args": {"dataset_id": dataset_id},
                "result": {},
                "detail": "No tool call yet",
            }
        ],
        "preview_data": None,
        "confirmation_token": None,
        "mode": "deterministic",
    }


def current_version() -> dict[str, str]:
    version = os.getenv("PRIVACYGUARD_VERSION", "v3")
    artifact = build_artifact_version(version, PRIVACY_PROMPT, PRIVACY_TOOLS)
    return artifact_version_dict(artifact)


# Ensure privacy tools are importable through the shared registry for chat.py execution.
TOOL_FUNCTIONS.update(
    {
        "scan_dataset": scan_dataset,
        "detect_pii": detect_pii,
        "preview_masking": preview_masking,
    }
)
