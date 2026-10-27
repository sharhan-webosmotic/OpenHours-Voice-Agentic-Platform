#!/usr/bin/env python3
"""Function-coverage gate for Python.

pytest-cov measures line and branch coverage but has no function-coverage
metric. This helper fills that gap so the framework's 98% floor on lines,
branches, AND functions is enforceable on Python (testing-rules Rule 7a).

A function counts as "covered" when at least one line of its body executed
during the test run (the same semantics as Jest's `functions` metric: the
function was called). The gate fails when the fraction of covered functions
falls below the threshold.

Usage (after pytest has produced a .coverage data file):
    coverage json -o coverage.json
    python check_func_coverage.py --coverage coverage.json --fail-under 98 \
        --include app --include src

Only stdlib is used (ast + json). Copy this file to your project's
`scripts/` directory, or run it in place.
"""
from __future__ import annotations

import argparse
import ast
import json
import sys
from pathlib import Path

DEFAULT_EXCLUDES = ("/tests/", "/test/", "__init__.py", "/migrations/", "conftest.py")


def _function_line_spans(source: str) -> list[tuple[int, int]]:
    """Return (first_body_line, last_line) for every function in the source."""
    spans: list[tuple[int, int]] = []
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if not node.body:
                continue
            start = node.body[0].lineno
            end = getattr(node, "end_lineno", None) or start
            spans.append((start, end))
    return spans


def _is_excluded(path: str, includes: list[str], excludes: tuple[str, ...]) -> bool:
    norm = path.replace("\\", "/")
    if any(token in norm for token in excludes):
        return True
    if includes:
        return not any(inc.replace("\\", "/") in norm for inc in includes)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Fail when function coverage is below the floor.")
    parser.add_argument("--coverage", default="coverage.json", help="coverage.py JSON report path")
    parser.add_argument("--fail-under", type=float, default=98.0, help="minimum function-coverage percent")
    parser.add_argument("--include", action="append", default=[], help="path fragment to include (repeatable)")
    args = parser.parse_args()

    report_path = Path(args.coverage)
    if not report_path.exists():
        print(f"ERROR: coverage report not found: {report_path}. Run `coverage json` first.", file=sys.stderr)
        return 2

    data = json.loads(report_path.read_text(encoding="utf-8"))
    files = data.get("files", {})

    total = 0
    covered = 0
    uncovered: list[str] = []

    for file_path, file_data in files.items():
        if _is_excluded(file_path, args.include, DEFAULT_EXCLUDES):
            continue
        src_path = Path(file_path)
        if not src_path.exists():
            continue
        try:
            spans = _function_line_spans(src_path.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        executed = set(file_data.get("executed_lines", []))
        for start, end in spans:
            total += 1
            if any(line in executed for line in range(start, end + 1)):
                covered += 1
            else:
                uncovered.append(f"{file_path}:{start}")

    if total == 0:
        print("Function coverage: no measurable functions found (nothing to gate).")
        return 0

    pct = covered / total * 100
    status = "PASS" if pct >= args.fail_under else "FAIL"
    print(f"Function coverage: {covered}/{total} = {pct:.2f}% (floor {args.fail_under:.0f}%) -> {status}")
    if status == "FAIL":
        print("Uncalled functions (need a test that exercises them):", file=sys.stderr)
        for loc in uncovered:
            print(f"  {loc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
