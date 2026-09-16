"""Split the 52-scenario evaluation file into three validated suites."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVAL_DIR = ROOT / "eval"
SOURCE_PATH = EVAL_DIR / "test_scenarios_52.json"
OUTPUTS = {
    "base_single": EVAL_DIR / "eval_base.json",
    "base_multi": EVAL_DIR / "eval_base.json",
    "adversarial": EVAL_DIR / "eval_adversarial.json",
    "edge_domain": EVAL_DIR / "eval_group.json",
}
EXPECTED_COUNTS = {
    "base_single": 20,
    "base_multi": 10,
    "adversarial": 12,
    "edge_domain": 10,
}


class SplitError(Exception):
    """Raised when the source cannot be safely split."""


def load_source() -> list[dict]:
    if not SOURCE_PATH.is_file():
        raise SplitError(f"source file not found: {SOURCE_PATH}")
    try:
        data = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SplitError(f"cannot read UTF-8 JSON source: {error}") from error
    if not isinstance(data, list) or len(data) != 52:
        raise SplitError(f"source must contain exactly 52 scenarios, got {len(data) if isinstance(data, list) else 'non-list'}")
    for index, scenario in enumerate(data, start=1):
        if not isinstance(scenario, dict) or scenario.get("id") != f"SC_{index:02d}":
            raise SplitError(f"source IDs must be continuous from SC_01 to SC_52; invalid item {index}")
        if scenario.get("category") not in EXPECTED_COUNTS:
            raise SplitError(f"unsupported category at {scenario.get('id')}: {scenario.get('category')}")
    return data


def split_scenarios(data: list[dict]) -> dict[Path, list[dict]]:
    groups = {path: [] for path in set(OUTPUTS.values())}
    for scenario in data:
        groups[OUTPUTS[scenario["category"]]].append(scenario)
    expected_files = {
        EVAL_DIR / "eval_base.json": 30,
        EVAL_DIR / "eval_adversarial.json": 12,
        EVAL_DIR / "eval_group.json": 10,
    }
    for path, expected_count in expected_files.items():
        actual_count = len(groups[path])
        if actual_count != expected_count:
            raise SplitError(f"{path.name} must contain {expected_count} cases, got {actual_count}")
    if sum(len(items) for items in groups.values()) != 52:
        raise SplitError("split total must equal 52")
    return groups


def write_outputs(groups: dict[Path, list[dict]]) -> None:
    temporary_paths: list[Path] = []
    try:
        for output_path, scenarios in groups.items():
            temporary_path = output_path.with_suffix(output_path.suffix + ".tmp")
            temporary_path.write_text(
                json.dumps(scenarios, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            temporary_paths.append(temporary_path)
        for temporary_path in temporary_paths:
            target_path = temporary_path.with_suffix("")
            json.loads(temporary_path.read_text(encoding="utf-8"))
            temporary_path.replace(target_path)
        SOURCE_PATH.unlink()
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        for temporary_path in temporary_paths:
            temporary_path.unlink(missing_ok=True)
        raise SplitError(f"failed to write validated split files; source was preserved: {error}") from error


def main() -> int:
    try:
        data = load_source()
        groups = split_scenarios(data)
        write_outputs(groups)
    except SplitError as error:
        print(f"FAIL: {error}")
        return 1
    print("PASS: split 52 scenarios into eval_base.json (30), eval_adversarial.json (12), eval_group.json (10)")
    print("PASS: UTF-8, ensure_ascii=False, indent=2; source removed after successful writes")
    return 0


if __name__ == "__main__":
    sys.exit(main())