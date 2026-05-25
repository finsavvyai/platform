#!/usr/bin/env python3
"""Run local quality gates and fail fast."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from typing import NamedTuple


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class CheckResult(NamedTuple):
    name: str
    passed: bool
    detail: str


def run_cmd(command: list[str], env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, env=env, check=False)
    except FileNotFoundError:
        return subprocess.CompletedProcess(command, 127, "", f"{command[0]} not found")


def file_size_check(max_lines: int = 100) -> CheckResult:
    roots = ("src", "tests", "cloudflare-api/src")
    ext = (".py", ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs")
    ignored = {".git", "__pycache__", ".pytest_cache", "node_modules"}
    violations = 0
    scanned = 0
    for root in roots:
        abs_root = os.path.join(ROOT, root)
        if not os.path.exists(abs_root):
            continue
        for dirpath, dirnames, filenames in os.walk(abs_root):
            dirnames[:] = [d for d in dirnames if d not in ignored]
            for name in filenames:
                if not name.endswith(ext):
                    continue
                scanned += 1
                path = os.path.join(dirpath, name)
                with open(path, "r", encoding="utf-8", errors="ignore") as handle:
                    lines = sum(1 for _ in handle)
                if lines > max_lines:
                    violations += 1
    ok = violations == 0
    return CheckResult("files.max_lines <= 100", ok, f"{violations} violations across {scanned} files")


def test_coverage_check(min_cov: int = 90) -> CheckResult:
    env = os.environ.copy()
    env["PYTHONPATH"] = "." if not env.get("PYTHONPATH") else f".:{env['PYTHONPATH']}"
    proc = run_cmd(
        ["pytest", "tests/", "-q", "--maxfail=1", "--cov=src", "--cov-report=term", f"--cov-fail-under={min_cov}"],
        env=env,
    )
    ok = proc.returncode == 0
    first_line = next((line for line in (proc.stdout + "\n" + proc.stderr).splitlines() if line.strip()), "")
    return CheckResult("test.pass && coverage >= 90", ok, first_line or f"pytest exit {proc.returncode}")


def deps_vulnerable_check() -> CheckResult:
    proc = run_cmd(["pip-audit"])
    text = f"{proc.stdout}\n{proc.stderr}"
    match = re.search(r"Found (\d+) known vulnerabilities", text)
    count = int(match.group(1)) if match else (0 if proc.returncode == 0 else -1)
    ok = proc.returncode == 0 and count == 0
    detail = f"{count} vulnerabilities" if count >= 0 else f"pip-audit exit {proc.returncode}"
    return CheckResult("deps.vulnerable == 0", ok, detail)


def deps_outdated_check(max_outdated: int = 5) -> CheckResult:
    proc = run_cmd([sys.executable, "-m", "pip", "list", "--outdated", "--format=json"])
    if proc.returncode != 0:
        return CheckResult("deps.outdated <= 5", False, f"pip list exit {proc.returncode}")
    outdated = len(json.loads(proc.stdout))
    return CheckResult("deps.outdated <= 5", outdated <= max_outdated, f"{outdated} outdated packages")


def bandit_check() -> CheckResult:
    proc = run_cmd(["bandit", "-r", "src/", "-ll", "-q"])
    if proc.returncode == 127:
        return CheckResult("security.high/critical == 0", False, "bandit not installed")
    return CheckResult("security.high/critical == 0", proc.returncode == 0, f"bandit exit {proc.returncode}")


def main() -> int:
    checks = [file_size_check(), test_coverage_check(), bandit_check(), deps_vulnerable_check(), deps_outdated_check()]
    print("Luna Assert Results")
    print("=" * 70)
    failed = 0
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        failed += 0 if check.passed else 1
        print(f"[{status}] {check.name} :: {check.detail}")
    print("=" * 70)
    print(f"Final: {'PASS' if failed == 0 else 'FAIL'} ({failed} failing checks)")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
