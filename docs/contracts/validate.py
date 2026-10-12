#!/usr/bin/env python3
"""
docs/contracts/validate.py
==========================
Validates every JSON example file against its JSON Schema.

Usage
-----
  pip install jsonschema          # one-time
  python docs/contracts/validate.py

Exit codes
----------
  0  all examples valid
  1  one or more validation failures
"""

import json
import sys
from pathlib import Path

try:
    import jsonschema
    from jsonschema import Draft7Validator, FormatChecker
except ImportError:
    print("ERROR: jsonschema not installed.  Run:  pip install jsonschema")
    sys.exit(2)

BASE = Path(__file__).parent

# ---------------------------------------------------------------------------
# (schema_file, example_file) pairs to validate
# ---------------------------------------------------------------------------
PAIRS: list[tuple[str, str]] = [
    ("session_payload.schema.json",  "session_payload.example.json"),
    ("pose_config.schema.json",      "pose_config.heel_raise.example.json"),
    ("pose_config.schema.json",      "pose_config.ankle_pump.example.json"),
]

# Error codes declared in error_codes.md — checked against session example
KNOWN_ERROR_CODES: set[str] = {
    "too_fast",
    "low_height",
    "knee_valgus",
    "early_heel_lift",
    "hip_hike",
    "low_confidence",
}


def load_json(path: Path) -> dict:
    """Load JSON, stripping _comment keys (our annotation convention)."""
    raw = json.loads(path.read_text(encoding="utf-8-sig"))  # utf-8-sig strips Windows BOM
    return strip_comments(raw)


def strip_comments(obj):
    """Recursively remove keys starting with '_comment' (non-standard annotations)."""
    if isinstance(obj, dict):
        return {k: strip_comments(v) for k, v in obj.items() if not k.startswith("_comment")}
    if isinstance(obj, list):
        return [strip_comments(item) for item in obj]
    return obj


def validate_pair(schema_file: str, example_file: str) -> list[str]:
    """Return a list of error messages (empty = valid)."""
    schema_path  = BASE / schema_file
    example_path = BASE / example_file

    schema  = load_json(schema_path)
    example = load_json(example_path)

    validator = Draft7Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(example), key=lambda e: list(e.path))
    return [f"  {list(e.path)} -> {e.message}" for e in errors]


def validate_error_codes(example_file: str) -> list[str]:
    """Check that every error code id in the example is in KNOWN_ERROR_CODES."""
    example_path = BASE / example_file
    example = load_json(example_path)
    problems: list[str] = []

    for ex in example.get("exercises", []):
        for rep in ex.get("reps", []):
            for code in rep.get("errors", []):
                if code not in KNOWN_ERROR_CODES:
                    problems.append(
                        f"  Unknown error code '{code}' in set {rep['set_no']} rep {rep['rep_no']}"
                    )
    return problems


def main() -> int:
    all_passed = True

    for schema_file, example_file in PAIRS:
        print(f"\nValidating {example_file} against {schema_file} ...")
        errors = validate_pair(schema_file, example_file)
        if errors:
            all_passed = False
            print(f"  FAIL ({len(errors)} error(s))")
            for e in errors:
                print(e)
        else:
            print("  PASS")

    # Extra semantic check: error codes in session example
    print("\nChecking error codes in session_payload.example.json ...")
    code_errors = validate_error_codes("session_payload.example.json")
    if code_errors:
        all_passed = False
        print(f"  FAIL ({len(code_errors)} unknown code(s))")
        for e in code_errors:
            print(e)
    else:
        print("  PASS")

    print()
    if all_passed:
        print("All contracts valid.")
        return 0
    else:
        print("Validation FAILED — see errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
