from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from agent import HelpdeskAgent
from env_loader import load_lab_env
from providers import make_provider
from tools import TOOL_FUNCTIONS, load_tool_declarations, to_openai_tools
from versioning import artifact_version_dict, build_artifact_version


ROOT = Path(__file__).parent
PROJECT_ROOT = ROOT.parent
ARTIFACTS_DIR = ROOT / "artifacts"
DEFAULT_EVAL_FILES = [
    PROJECT_ROOT / "eval" / "eval_base.json",
    PROJECT_ROOT / "eval" / "eval_adversarial.json",
    PROJECT_ROOT / "eval" / "eval_group.json",
]
load_lab_env(ROOT)


def safe_slug(value: str) -> str:
    return "".join(char if char.isalnum() or char in "_.-" else "_" for char in value).strip("_") or "run"


def normalized(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip().casefold()
    if isinstance(value, dict):
        return {key: normalized(item) for key, item in value.items()}
    if isinstance(value, list):
        return sorted((normalized(item) for item in value), key=lambda item: json.dumps(item, sort_keys=True))
    return value


def arguments_match(
    expected: dict[str, Any], actual: dict[str, Any], *, ignored_keys: set[str] | None = None
) -> tuple[bool, list[str]]:
    failures: list[str] = []
    for key, expected_value in expected.items():
        if key in (ignored_keys or set()):
            continue
        if normalized(actual.get(key)) != normalized(expected_value):
            failures.append(f"{key}: expected {expected_value!r}, got {actual.get(key)!r}")
    return not failures, failures


def evaluate_calls(expect: dict[str, Any], actual_calls: list[dict[str, Any]]) -> dict[str, Any]:
    if expect.get("no_tool"):
        passed = not actual_calls
        return {
            "passed": passed,
            "routing_correct": passed,
            "args_correct": passed,
            "failure_type": None if passed else "unnecessary_tool",
            "failures": [] if passed else ["expected no tool call"],
        }

    expected_calls = expect.get("tool_calls", [])
    unmatched = list(actual_calls)
    failures: list[str] = []
    routing_correct = True
    args_correct = True
    failure_type: str | None = None

    for expected_call in expected_calls:
        same_name = [call for call in unmatched if call["name"] == expected_call["name"]]
        if not same_name:
            routing_correct = False
            args_correct = False
            failure_type = failure_type or "wrong_tool"
            failures.append(f"missing tool call {expected_call['name']}")
            continue

        best_call = same_name[0]
        best_failures: list[str] | None = None
        for candidate in same_name:
            ignored_keys = {"question"} if expected_call["name"] == "clarify" else set()
            _, candidate_failures = arguments_match(
                expected_call.get("args", {}), candidate.get("args", {}), ignored_keys=ignored_keys
            )
            if best_failures is None or len(candidate_failures) < len(best_failures):
                best_call, best_failures = candidate, candidate_failures

        unmatched.remove(best_call)
        if best_failures:
            args_correct = False
            failure_type = failure_type or "wrong_arg_value"
            failures.extend(best_failures)

    if unmatched:
        routing_correct = False
        args_correct = False
        failure_type = failure_type or "unnecessary_tool"
        failures.extend(f"extra tool call {call['name']}" for call in unmatched)

    return {
        "passed": routing_correct and args_correct and not failures,
        "routing_correct": routing_correct,
        "args_correct": args_correct,
        "failure_type": failure_type,
        "failures": failures,
    }


def load_cases(paths: list[Path]) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError(f"{path} must contain a JSON array of PrivacyGuard scenarios")
        cases.extend(data)
    return cases


def validate_tool_contract(cases: list[dict[str, Any]], declarations: list[dict[str, Any]]) -> None:
    declared = {item["name"] for item in declarations}
    implemented = set(TOOL_FUNCTIONS)
    expected = set()
    for case in cases:
        turns = case.get("turns") or [case]
        for turn in turns:
            expected.update(call["name"] for call in turn.get("expect", {}).get("tool_calls", []))
    missing_declarations = sorted(expected - declared)
    missing_implementations = sorted(expected - implemented)
    if missing_declarations or missing_implementations:
        raise ValueError(
            f"Tool contract mismatch: undeclared={missing_declarations}, unimplemented={missing_implementations}"
        )


def case_messages(case: dict[str, Any]) -> list[dict[str, str]]:
    if "turns" not in case:
        return [{"role": "user", "content": case["prompt"]}]

    turns = case["turns"]
    previous = turns[:-1]
    latest = turns[-1]["content"]
    previous_text = "\n".join(
        f"- Earlier {item.get('role', 'user')} turn {index + 1}: {item['content']}"
        for index, item in enumerate(previous)
    )
    content = (
        "Conversation context for a multi-turn eval.\n"
        "Use earlier turns only as context. Do not answer earlier turns and do not call tools for them.\n\n"
        f"{previous_text}\n\n"
        f"Latest user turn to answer now: {latest}"
    )
    return [{"role": "user", "content": content}]


def case_expect(case: dict[str, Any]) -> dict[str, Any]:
    return case["turns"][-1]["expect"] if "turns" in case else case["expect"]


def evaluate_case(
    case: dict[str, Any],
    *,
    provider: Any,
    system_prompt: str,
    tools: list[dict[str, Any]],
    model: str | None,
) -> dict[str, Any]:
    expect = case_expect(case)
    messages = case_messages(case)
    try:
        agent = HelpdeskAgent(provider, system_prompt=system_prompt, tools=tools, model=model)
        tool_choice = None if expect.get("no_tool") else "required"
        run = agent.run(messages, tool_choice=tool_choice)
        actual_calls = [{"name": call.name, "args": call.args} for call in run.tool_calls]
        scored = evaluate_calls(expect, actual_calls)
        return {
            "id": case["id"],
            "category": case["category"],
            "title": case["title"],
            "is_multiturn": "turns" in case,
            "result": scored,
            "messages": messages,
            "expect": expect,
            "actual_tool_calls": actual_calls,
            "tool_results": run.tool_results,
            "assistant_text": run.text,
        }
    except Exception as exc:
        return {
            "id": case["id"],
            "category": case["category"],
            "title": case["title"],
            "is_multiturn": "turns" in case,
            "result": {
                "passed": False,
                "routing_correct": False,
                "args_correct": False,
                "failure_type": "provider_error",
                "failures": [f"{type(exc).__name__}: {exc}"],
            },
            "messages": messages,
            "expect": expect,
            "actual_tool_calls": [],
            "tool_results": [],
            "assistant_text": None,
        }


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    measured = [item for item in results if item["result"]["failure_type"] != "provider_error"]
    multi = [item for item in measured if item["is_multiturn"]]
    base_multi = [item for item in multi if item["category"] == "base_multi"]
    adversarial = [item for item in measured if item["category"] == "adversarial"]
    failures = Counter(item["result"]["failure_type"] for item in measured if item["result"]["failure_type"])
    return {
        "total_cases": len(results),
        "measured_cases": len(measured),
        "provider_error_cases": len(results) - len(measured),
        "passed_cases": sum(item["result"]["passed"] for item in measured),
        "case_accuracy": round(sum(item["result"]["passed"] for item in measured) / len(measured), 4) if measured else 0.0,
        "tool_routing_accuracy": round(sum(item["result"]["routing_correct"] for item in measured) / len(measured), 4) if measured else 0.0,
        "argument_accuracy": round(sum(item["result"]["args_correct"] for item in measured) / len(measured), 4) if measured else 0.0,
        "multiturn_accuracy": round(sum(item["result"]["passed"] for item in multi) / len(multi), 4) if multi else None,
        "base_multiturn_accuracy": round(sum(item["result"]["passed"] for item in base_multi) / len(base_multi), 4) if base_multi else None,
        "adversarial_passed_cases": sum(item["result"]["passed"] for item in adversarial),
        "adversarial_total_cases": len(adversarial),
        "cases_evaluated": len(measured),
        "failure_counts": dict(sorted(failures.items())),
    }


def short_error(case_result: dict[str, Any], limit: int = 160) -> str:
    result = case_result["result"]
    if result["failure_type"] == "provider_error" and result["failures"]:
        return " ".join(result["failures"][0].split())[:limit]
    return "unknown provider error"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run PrivacyGuard v0 scenarios without changing the fixed eval cases.")
    parser.add_argument("--provider", choices=["openai", "openrouter", "groq", "anthropic", "gemini"], required=True)
    parser.add_argument("--model", default=None)
    parser.add_argument("--version", default="v0")
    parser.add_argument("--system-prompt", type=Path, default=ARTIFACTS_DIR / "system_prompt.md")
    parser.add_argument("--tools", type=Path, default=ARTIFACTS_DIR / "tools.yaml")
    parser.add_argument("--eval-files", type=Path, nargs="+", default=DEFAULT_EVAL_FILES)
    parser.add_argument("--runs-dir", type=Path, default=ROOT / "runs")
    args = parser.parse_args()

    cases = load_cases(args.eval_files)
    declarations = load_tool_declarations(args.tools)
    validate_tool_contract(cases, declarations)
    provider = make_provider(args.provider)
    system_prompt = args.system_prompt.read_text(encoding="utf-8")
    artifact_version = build_artifact_version(args.version, args.system_prompt, args.tools)
    results: list[dict[str, Any]] = []
    total_cases = len(cases)
    for index, case in enumerate(cases, start=1):
        case_id = case["id"]
        print(f"Running {case_id} ({index}/{total_cases})...", flush=True)
        result = evaluate_case(
            case,
            provider=provider,
            system_prompt=system_prompt,
            tools=to_openai_tools(declarations),
            model=args.model,
        )
        results.append(result)
        outcome = result["result"]
        if outcome["failure_type"] == "provider_error":
            print(f"PROVIDER ERROR {case_id} — {short_error(result)}", flush=True)
        elif outcome["passed"]:
            print(f"PASS {case_id}", flush=True)
        else:
            print(f"FAIL {case_id} — {outcome['failure_type']}", flush=True)
    summary = summarize(results)
    now = datetime.now()
    run_id = "_".join([safe_slug(args.version), "privacyguard", safe_slug(args.provider), now.strftime("%Y%m%dT%H%M%S%f")])
    payload = {
        "run_id": run_id,
        "version": args.version,
        **artifact_version_dict(artifact_version),
        "provider": args.provider,
        "model": args.model or getattr(provider, "default_model", None),
        "system_prompt": str(args.system_prompt),
        "tools": str(args.tools),
        "eval_files": [str(path) for path in args.eval_files],
        "generated_at": now.isoformat(timespec="seconds"),
        "summary": summary,
        "results": results,
    }
    args.runs_dir.mkdir(parents=True, exist_ok=True)
    output = args.runs_dir / f"{run_id}.json"
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Saved: {output}")


if __name__ == "__main__":
    main()
