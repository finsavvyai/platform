# QA Report — finsavvyai
**Date:** 2026-03-29
**Wave:** 1

## Validation Summary
- Full suite command: `./.venv/bin/python -m pytest -q`
- Result: **2923 passed**, **53 skipped**, **0 failed**
- Coverage: **96.29%**
- Warnings: **265**

## File Size Check (≤200 lines)
- Python source files in `src/`: 257
- Files over 200 lines: 0
- Largest files observed:
  - `src/core/deferred_items.py` — 200 lines
  - `src/cli/finsavvyai_cli.py` — 200 lines
- Status: **PASS**

## Test Results
- Python test files found: 242
- Suite runtime: 162.35s
- Coverage gate: `--cov=src --cov-fail-under=95`
- Status: **PASS**

## Warning Summary
- Python 3.14 deprecation warnings remain in several modules.
- Multiple tests emit unawaited coroutine warnings from mocked async flows.
- These warnings do not currently fail the suite, but they should be cleaned up before treating the test output as release-grade.

## Security Check
- Not rerun in this validation pass.
- Previous report noted no hardcoded secrets in tracked source.
- Status: **NOT VERIFIED**

## Overall: **PASS WITH WARNINGS**
*Reason: The full pytest suite passes and coverage exceeds the 95% gate, but the warning backlog and unverified security scan remain open follow-up items.*
