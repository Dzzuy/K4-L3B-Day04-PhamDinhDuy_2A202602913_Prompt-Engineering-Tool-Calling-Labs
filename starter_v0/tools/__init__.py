from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from .clarify.tool import ask_user
from .scan_dataset_pii.tool import scan_dataset_pii
from .classify_pii_sensitivity.tool import classify_pii_sensitivity
from .propose_masking_policy.tool import propose_masking_policy
from .search_legal_compliance.tool import search_legal_compliance
from .audit_data_access.tool import audit_data_access
from .generate_compliance_report.tool import generate_compliance_report
from .generate_masked_view.tool import generate_masked_view

# Registry mapping tool names defined in tools.yaml to Python functions
TOOL_FUNCTIONS = {
    "clarify": ask_user,
    "scan_dataset_pii": scan_dataset_pii,
    "classify_pii_sensitivity": classify_pii_sensitivity,
    "propose_masking_policy": propose_masking_policy,
    "search_legal_compliance": search_legal_compliance,
    "audit_data_access": audit_data_access,
    "generate_compliance_report": generate_compliance_report,
    "generate_masked_view": generate_masked_view,
}


def load_tool_declarations(path: Path) -> list[dict[str, Any]]:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))["tools"]


def to_openai_tools(declarations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{
        "type": "function",
        "function": {
            "name": item["name"],
            "description": item.get("description", ""),
            "parameters": item.get("parameters", {"type": "object", "properties": {}}),
        },
    } for item in declarations]
