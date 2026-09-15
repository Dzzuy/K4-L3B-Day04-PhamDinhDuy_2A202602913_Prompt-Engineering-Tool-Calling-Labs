from __future__ import annotations

import random
from typing import Any


def propose_masking_policy(dataset_name: str, rules: list[dict[str, str]]) -> dict[str, Any]:
    proposal_id = f"PROP_{random.randint(1000, 9999)}"
    formatted_rules = []
    for rule in rules:
        col = rule.get("column", "")
        action = rule.get("action", "HASH")
        formatted_rules.append({
            "column": col,
            "proposed_action": action,
            "transformation_sample": f"{action}({col})",
        })

    return {
        "tool": "propose_masking_policy",
        "proposal_id": proposal_id,
        "dataset_name": dataset_name,
        "status": "DRAFT_PENDING_DPO_APPROVAL",
        "proposed_rules": formatted_rules,
        "requires_dpo_approval": True,
    }
