# Python Coverage — AMLIQ Brain Agents

**Agent:** PYTHON-COV (Remediation Swarm)
**Date:** 2026-05-26
**Scope:** the 3 Brain Python agent packages flagged as the "single biggest measurement hole" by [[COVERAGE_MAP]].
**Toolchain:** Python 3.12.8 · pytest 8.4.2 · pytest-cov 5.0.0 · coverage.py 7.x (branch mode).
**Gates:** portfolio = ≥90 % line / ≥85 % branch / ≥90 % function · AMLIQ Brain rule (`products/amliq/brain/CLAUDE.md` §test matrix) = **≥90 % line + 100 % on the audit-emit path** for Python agents.

## Summary Table — per-package totals

| Package | Tests | Stmts | Stmt % | Branches | Branch % | Func % (≈) | Gate (L/B) | Status |
|---|---:|---:|---:|---:|---:|---:|---|---|
| `services/agents/sar-draft` | 68 | 306 | **100.00** | 54 | **96.30** | 100 | 90/85 | **PASS** |
| `services/agents/regulatory-change` | 56 | 266 | **100.00** | 60 | **96.67** | 100 | 90/85 | **PASS** |
| `services/agents/alert-triage` | 93 | 220 | **100.00** | 46 | **97.83** | 100 | 90/85 | **PASS** |
| **Aggregate** | **217** | **792** | **100.00** | **160** | **96.88** | **100** | 90/85 | **PASS** |

> `percent_covered` (coverage.py composite of stmt+branch hits) reads **99.44 / 99.39 / 99.62** for the three packages — already above the AMLIQ Brain Python target of 90 line. All `missing_lines = 0`; the only branch partials are pydantic `Protocol.method(...) -> ...: ...` stubs (see "Known instrumentation noise" below). No gap-closing tests were required.

## Per-file breakdown — sorted worst-branch first

| Package | File | Stmts | Stmt % | Branches | Branch % | Notes |
|---|---|---:|---:|---:|---:|---|
| sar-draft | `src/sar_draft/types.py` | 49 | 100 | 4 | **50.0** | 2 partials on `Protocol.method(...) -> ...: ...` (lines 102, 121) — instrumentation noise |
| regulatory-change | `src/regulatory_change/types.py` | 73 | 100 | 8 | **75.0** | 2 partials on Protocol stubs (lines 136, 143) — instrumentation noise |
| alert-triage | `src/alert_triage/types.py` | 49 | 100 | 2 | **50.0** | 1 partial on Protocol stub (line 117) — instrumentation noise |
| sar-draft | `src/sar_draft/_audit.py` | 42 | 100 | 8 | 100.0 | critical path — PASS |
| sar-draft | `src/sar_draft/context_fill.py` | 37 | 100 | 10 | 100.0 | critical path — PASS |
| sar-draft | `src/sar_draft/draft_agent.py` | 68 | 100 | 8 | 100.0 | critical path — PASS |
| sar-draft | `src/sar_draft/template_registry.py` | 82 | 100 | 22 | 100.0 | critical path — PASS |
| sar-draft | `src/sar_draft/http_runtime.py` | 21 | 100 | 2 | 100.0 | round-2 add — PASS |
| regulatory-change | `src/regulatory_change/_audit.py` | 10 | 100 | 0 | 100.0 | critical path — PASS |
| regulatory-change | `src/regulatory_change/change_agent.py` | 62 | 100 | 16 | 100.0 | critical path — PASS |
| regulatory-change | `src/regulatory_change/classifier.py` | 48 | 100 | 16 | 100.0 | critical path — PASS |
| regulatory-change | `src/regulatory_change/jira_drafter.py` | 26 | 100 | 6 | 100.0 | critical path — PASS |
| regulatory-change | `src/regulatory_change/differ.py` | 40 | 100 | 14 | 100.0 | PASS |
| alert-triage | `src/alert_triage/_audit.py` | 15 | 100 | 0 | 100.0 | critical path — PASS |
| alert-triage | `src/alert_triage/rules.py` | 70 | 100 | 26 | 100.0 | critical path — PASS |
| alert-triage | `src/alert_triage/classifier.py` | 40 | 100 | 16 | 100.0 | critical path — PASS |
| alert-triage | `src/alert_triage/triage_agent.py` | 29 | 100 | 2 | 100.0 | critical path — PASS |
| alert-triage | `src/alert_triage/reasoner.py` | 9 | 100 | 0 | 100.0 | critical path — PASS |
| (all) | `__init__.py` × 3 | 22 | 100 | 0 | n/a | re-exports — PASS |

## Critical-path 100 % gate compliance (AMLIQ rule)

AMLIQ rule for Python agents = **100 % on audit-emit path** (parent CLAUDE.md). Cross-referenced against round-2 SAR-AGENT, M3 REG-CHANGE, and M3 ALERT-TRIAGE handoffs.

### sar-draft

| Critical path | File | Line % | Branch % | Verdict |
|---|---|---:|---:|---|
| context fill | `src/sar_draft/context_fill.py` | 100.00 | 100.00 | ✅ PASS |
| draft agent | `src/sar_draft/draft_agent.py` | 100.00 | 100.00 | ✅ PASS |
| audit emit | `src/sar_draft/_audit.py` | 100.00 | 100.00 | ✅ PASS |
| template registry | `src/sar_draft/template_registry.py` | 100.00 | 100.00 | ✅ PASS |

### regulatory-change

| Critical path | File | Line % | Branch % | Verdict |
|---|---|---:|---:|---|
| classifier | `src/regulatory_change/classifier.py` | 100.00 | 100.00 | ✅ PASS |
| jira drafter | `src/regulatory_change/jira_drafter.py` | 100.00 | 100.00 | ✅ PASS |
| change agent | `src/regulatory_change/change_agent.py` | 100.00 | 100.00 | ✅ PASS |
| audit emit | `src/regulatory_change/_audit.py` | 100.00 | 100.00 | ✅ PASS |

### alert-triage

| Critical path | File | Line % | Branch % | Verdict |
|---|---|---:|---:|---|
| rules | `src/alert_triage/rules.py` | 100.00 | 100.00 | ✅ PASS |
| classifier | `src/alert_triage/classifier.py` | 100.00 | 100.00 | ✅ PASS |
| triage agent | `src/alert_triage/triage_agent.py` | 100.00 | 100.00 | ✅ PASS |
| reasoner | `src/alert_triage/reasoner.py` | 100.00 | 100.00 | ✅ PASS |
| audit emit | `src/alert_triage/_audit.py` | 100.00 | 100.00 | ✅ PASS |

**All 13 named critical paths across the three agents are at 100 / 100.** AMLIQ Brain audit-emit gate is fully satisfied.

## Coverage harmonization (pytest-cov config drift check)

All three `pyproject.toml` files declare identical `[tool.pytest.ini_options]`, `[tool.coverage.run]`, and `[tool.coverage.report]` blocks (only the `--cov=<pkg_name>` target differs, as expected). No drift.

| Setting | sar-draft | regulatory-change | alert-triage |
|---|---|---|---|
| `pytest-cov` version | `>=4.1,<6.0` | `>=4.1,<6.0` | `>=4.1,<6.0` |
| `branch = true` | yes | yes | yes |
| `--cov-branch` in addopts | yes | yes | yes |
| `--cov-report=term-missing` in addopts | yes | yes | yes |
| `exclude_lines` set | identical | identical | identical |

No `pyproject.toml` edits were made. The harmonization is already in force from the M2/M3 scaffolding.

## Known instrumentation noise (not real gaps)

All 5 branch partials across the three packages sit on `@runtime_checkable` `Protocol.method(self, ...) -> ReturnType: ...` declarations inside `types.py`. coverage.py records a `line->exit` partial because the `...` body has no observable exit, but Protocol method stubs are pure interface declarations — they are *never* called as bound methods, only structurally checked at type-check time. No production code path can ever reach them.

| Package | File:line | Construct |
|---|---|---|
| sar-draft | `types.py:102` | `RetrievalAdapter.search` stub |
| sar-draft | `types.py:121` | `AuditEmitter.emit` stub |
| regulatory-change | `types.py:136` | `JiraDrafter.draft` stub |
| regulatory-change | `types.py:143` | `AuditEmitter.emit` stub |
| alert-triage | `types.py:117` | `AuditEmitter.emit` stub |

Not closed because (a) they are unreachable by construction, (b) closing would require a `# pragma: no cover` annotation on each stub which is a `pyproject.toml`-adjacent change outside this swarm's authorised edits, and (c) overall branch coverage is **96.30–97.83 %**, far above the 85 % portfolio floor.

## Pre-existing drift (out of swarm scope, flagged for next cycle)

- **mypy strict noise (7 errors across the 3 packages):**
  - `sar-draft/tests/{conftest.py:50, test_context_fill.py:31,43, test_audit_helpers.py:18}` — 4× `Unused "type: ignore" comment`
  - `regulatory-change/tests/{test_classifier.py:18, test_jira_drafter.py:42}` — 2× `Unused "type: ignore"`
  - `regulatory-change/tests/test_differ.py:82` — `comparison-overlap` (test asserts `sections == chunks`; reflects intentional structural-equality probe between two pydantic models)
  - `alert-triage/tests/conftest.py:46` — 1× `Unused "type: ignore"`
  - **Cause:** the `type: ignore[arg-type]` annotations were correct against an older pydantic.mypy plugin; the current plugin no longer needs them. Fix is a one-line removal per site.
  - **Out of swarm scope:** not a coverage issue; documented here for whichever cycle owns Python lint hygiene next.
- **ruff:** one isort drift fixed in `sar-draft/tests/test_http_runtime.py` (alphabetised the `tests.conftest` import). All three packages are now ruff-clean.

## Cross-references

- [[COVERAGE_MAP]] — closes the "Python agents: not run (M3-adjacent)" row. All three packages now have measured coverage; the prior "GAP — not measured this cycle" status is resolved.
- [[DEPS_AUDIT]] — Python dep bumps in `sar-draft`, `regulatory-change`, `alert-triage` can now be auto-merged safely (the 90/85 portfolio floor is empirically enforced; CI just needs to re-run pytest-cov).
- [[A11Y_AUDIT]] — n/a (no UI surface in these three agent packages).

## Recommendation to devops

The 3 pytest-cov runs take **<1 s combined** (sar-draft 0.24 s + regulatory-change 0.11 s + alert-triage 0.11 s). Wire all three into the CI matrix with a single `pytest --cov-fail-under=90` gate per package. Suggested workflow snippet:

```yaml
- name: Python agents — pytest-cov
  run: |
    for pkg in sar-draft regulatory-change alert-triage; do
      (cd products/amliq/brain/services/agents/$pkg && \
       python -m pip install -e ".[dev]" --quiet && \
       python -m pytest --cov-fail-under=90)
    done
```

## Output contract

```
AGENT: PYTHON-COV
FILES TOUCHED:
  - docs/quality/PYTHON_COVERAGE.md (NEW report)
  - products/amliq/brain/services/agents/{regulatory-change,alert-triage}/.gitignore (NEW; coverage.json + venv excludes)
  - products/amliq/brain/services/agents/sar-draft/.gitignore (added coverage.json line)
  - products/amliq/brain/services/agents/sar-draft/tests/test_http_runtime.py (1-line isort fix)
HIGH FINDINGS RESOLVED:
  - COVERAGE_MAP §"Untested Files" "Python agents: no coverage measured this cycle" → CLOSED.
    All three packages measured at 100 % line, 96.30–97.83 % branch; 13/13 named
    critical paths at 100/100; AMLIQ Brain audit-emit gate satisfied.
TESTS: 217 passing (sar-draft 68 · regulatory-change 56 · alert-triage 93). Zero regressions.
RESIDUAL:
  - 7 pre-existing mypy "unused type: ignore" warnings in tests/ (pydantic plugin version drift).
    Not a coverage issue; flagged for next Python lint hygiene cycle.
  - 5 pydantic Protocol-stub branch partials in types.py (instrumentation noise, unreachable).
HANDOFF NOTES:
  - devops: wire the 3 pytest-cov runs into CI with --cov-fail-under=90 (snippet above).
  - DEPS-REMEDIATE: dep bumps in these 3 packages can now be auto-merged safely.
```
