# `alert-triage` — AMLIQ Brain Alert Triage Agent (M3 W10)

Second Python agent in the FinsavvyAI Brain runtime. Mirrors the layout
established by `sar-draft` (M2 W6) and extends it with a pure-function
rules engine + deterministic classifier.

## What this is

A read-only classifier that turns an `Alert` (from AMLIQ Investigate
`/v1/aml/decision`, the analyst console, or the monitor) into a
`TriageResult` — a priority + category + ordered reasoning chain + a
recommended-actions checklist for the analyst.

The agent **never closes an alert**. It writes one audit record per
`triage()` call and surfaces a `TriageResult` whose
`human_review_required` is always `True` in v0.

## Safety posture

- `human_review_required` is **always `True`** in v0 (mesh §7). The agent
  recommends, the analyst decides.
- The agent is **read-only**: there is no API to mark an alert
  closed/dismissed from this code path.
- Audit records carry **stable reason codes only**
  (`triaged | no_match | data_missing | error`). The `meta` field holds
  rule-id list + counts only — no party names, no amounts, no transaction
  IDs.
- Defensive empty input: an `Alert` with `transaction_ids == []` short-
  circuits to `(category=other, priority=p4, reasoning_chain=[])` and is
  audited with reason `data_missing`. No rule body ever executes against
  a half-populated alert.
- See `DESIGN.md` for the full safety invariants table.

## Contracts (see `src/alert_triage/types.py`)

| Type | Purpose |
|---|---|
| `Alert` | Input shape (alert_id, tenant_id, subject_hash, txn refs, amount_minor, ...) |
| `ReasoningStep` | `{rule_id, matched, evidence, weight}` — one node in the chain |
| `Priority` | `p1 | p2 | p3 | p4` |
| `Category` | `sanctions | structuring | kyc | fraud | other` |
| `TriageResult` | Output: `{alert_id, priority, category, reasoning_chain, recommended_actions, confidence, human_review_required, audit_event_id}` |
| `AuditEmitter` | Injected protocol — same shape as `sar-draft` |

`amount_minor` is integer cents — never a float. Mirrors AMLIQ
`MoneyMinor`.

## Layout

```
alert-triage/
├── pyproject.toml
├── README.md
├── DESIGN.md
├── src/alert_triage/
│   ├── __init__.py
│   ├── types.py
│   ├── rules.py
│   ├── reasoner.py
│   ├── classifier.py
│   ├── triage_agent.py
│   └── _audit.py
└── tests/
    ├── conftest.py
    ├── test_rules.py
    ├── test_reasoner.py
    ├── test_classifier.py
    └── test_triage_agent.py
```

## How to test

From this directory:

```bash
python -m pip install -e ".[dev]"

pytest tests/

ruff check src tests

mypy src
```

Coverage gates (enforced in CI once wired):

- `rules.py` → 100 % (each predicate's positive/negative + missing-field path)
- `classifier.py` → 100 % (every priority + category mapping covered)
- `triage_agent.py` audit-emit path → 100 %
- everything else → ≥ 90 % line / ≥ 85 % branch (portfolio baseline)

## Status (M3 W10)

Production-shaped skeleton. Rule predicates use placeholder constants
(OFAC country list, high-risk MCC set). Real list ingestion + a feedback
loop with regulatory-change land in subsequent weeks.
