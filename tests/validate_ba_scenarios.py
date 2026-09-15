"""Validate the 52 scenarios against the PrivacyGuard AI 8-tool contract."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCENARIOS_PATH = ROOT / "eval" / "test_scenarios_52.json"
EXPECTED = {"base_single": 20, "base_multi": 10, "adversarial": 12, "edge_domain": 10}
TOOLS = {"scan_dataset_pii", "classify_pii_sensitivity", "propose_masking_policy", "search_legal_compliance", "audit_data_access", "generate_compliance_report", "generate_masked_view", "clarify"}
ACTIONS = {"HASH", "MASK_MIDDLE", "GENERALIZE", "ANONYMIZE"}
RESPONSES = {"yes_no", "text", "choice"}


class ValidationError(Exception):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def validate_call(call: object, scenario_id: str) -> None:
    require(isinstance(call, dict) and set(call) == {"name", "args"}, f"{scenario_id}: invalid tool call")
    name, args = call["name"], call["args"]
    require(name in TOOLS and isinstance(args, dict), f"{scenario_id}: invalid tool or args: {name}")
    required = {
        "scan_dataset_pii": {"dataset_name"},
        "classify_pii_sensitivity": {"dataset_name", "columns"},
        "propose_masking_policy": {"dataset_name", "rules"},
        "search_legal_compliance": {"query"},
        "audit_data_access": {"dataset_name"},
        "generate_compliance_report": {"dataset_name", "proposal_id"},
        "generate_masked_view": {"dataset_name", "proposal_id", "view_name"},
        "clarify": {"question", "response_type"},
    }[name]
    require(required <= set(args), f"{scenario_id}: missing args for {name}")
    if name == "classify_pii_sensitivity":
        require(isinstance(args["columns"], list) and all(isinstance(x, str) for x in args["columns"]), f"{scenario_id}: columns must be list[str]")
    if name == "propose_masking_policy":
        require(isinstance(args["rules"], list) and args["rules"], f"{scenario_id}: rules must be non-empty")
        for rule in args["rules"]:
            require(isinstance(rule, dict) and set(rule) == {"column", "action"} and isinstance(rule["column"], str) and rule["action"] in ACTIONS, f"{scenario_id}: invalid masking rule")
    if name == "clarify":
        require(args["response_type"] in RESPONSES, f"{scenario_id}: invalid response_type")
    for key in required:
        require(args[key] != "" and args[key] is not None, f"{scenario_id}: empty arg {key}")


def validate_expect(expect: object, scenario_id: str) -> None:
    require(isinstance(expect, dict), f"{scenario_id}: expect must be object")
    if expect.get("no_tool") is True:
        require(set(expect) == {"no_tool"}, f"{scenario_id}: no_tool must stand alone")
    else:
        require(set(expect) == {"tool_calls"} and isinstance(expect["tool_calls"], list), f"{scenario_id}: invalid expect")
        for call in expect["tool_calls"]:
            validate_call(call, scenario_id)


def validate_scenario(scenario: object, index: int) -> None:
    require(isinstance(scenario, dict), f"index {index}: scenario is not object")
    scenario_id = f"SC_{index + 1:02d}"
    require(scenario.get("id") == scenario_id, f"expected {scenario_id}, got {scenario.get('id')}")
    category = scenario.get("category")
    require(category in EXPECTED, f"{scenario_id}: invalid category")
    require(isinstance(scenario.get("title"), str) and scenario["title"], f"{scenario_id}: missing title")
    is_single = category in {"base_single", "adversarial"} or (category == "edge_domain" and index < 47)
    if is_single:
        require(set(scenario) == {"id", "category", "title", "prompt", "expect"}, f"{scenario_id}: invalid single schema")
        require(isinstance(scenario["prompt"], str) and scenario["prompt"], f"{scenario_id}: missing prompt")
        validate_expect(scenario["expect"], scenario_id)
        if category == "adversarial":
            require(scenario["expect"] == {"no_tool": True}, f"{scenario_id}: adversarial must expect no_tool")
    else:
        require(set(scenario) == {"id", "category", "title", "turns"}, f"{scenario_id}: invalid multi schema")
        turns = scenario["turns"]
        require(isinstance(turns, list) and len(turns) >= 3, f"{scenario_id}: too few turns")
        for turn in turns:
            require(isinstance(turn, dict) and set(turn) == {"role", "content", "expect"} and turn["role"] == "user" and turn["content"], f"{scenario_id}: invalid turn")
            validate_expect(turn["expect"], scenario_id)
        if category == "base_multi":
            first_calls = turns[0]["expect"].get("tool_calls", [])
            require(first_calls and first_calls[0]["name"] == "scan_dataset_pii", f"{scenario_id}: first turn must scan")


def validate() -> None:
    try:
        data = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValidationError(f"cannot read JSON: {error}") from error
    require(isinstance(data, list) and len(data) == 52, f"expected 52 scenarios, got {len(data) if isinstance(data, list) else 'non-list'}")
    for index, scenario in enumerate(data):
        validate_scenario(scenario, index)
    counts = Counter(item["category"] for item in data)
    require(dict(counts) == EXPECTED, f"wrong category counts: {dict(counts)}")
    print("\033[32mPASS\033[0m PrivacyGuard AI 8-tool validation")
    print(f"\033[36mINFO\033[0m scenarios: {len(data)}")
    for category, expected in EXPECTED.items():
        print(f"\033[32mPASS\033[0m {category}: {counts[category]}/{expected}")
    print("\033[32mPASS\033[0m schema, IDs, tools, args, masking actions, clarify types, and adversarial no_tool gates")


if __name__ == "__main__":
    try:
        validate()
    except ValidationError as error:
        print(f"\033[31mFAIL\033[0m {error}")
        sys.exit(1)
    sys.exit(0)
