# `regulatory-change` — AMLIQ Brain Regulatory Change Agent (M3 W9)

Second Python agent in the FinsavvyAI Brain runtime. Mirrors the
`sar-draft` pattern established in M2 W6.

## What this is

A change-detection orchestrator that compares two versions of a
`ComplianceDoc` (e.g. a FinCEN RSS-sourced regulatory notice, current vs
prior snapshot) and, when the change is **material**, drafts a Jira
ticket payload for a human compliance officer to review and file.

It is the upstream half of the regulatory-change loop:

```
FinCEN RSS fetcher (TS, corpus/)  ──► ComplianceDoc (current + prior)
                                            │
                                            ▼
                            RegulatoryChangeAgent  (this package)
                                            │
                                            ▼
                              RegulatoryUpdate { jira_draft? }
                                            │
                                            ▼
                              human review → ticket creation (NOT here)
```

## Safety posture (release-blocking invariants)

- `human_review_required` is **always `True`** on every `JiraDraft`. The
  agent NEVER auto-creates a Jira ticket — it only drafts.
- **No outbound HTTP.** This package does not depend on any HTTP client.
  Jira API integration ships as a separate ticket in a later milestone.
- Audit `reason` is a stable code only (`ok`, `no_change`, `typo_only`,
  `missing_prior`, `diff_failed`, `unknown_error`). PII-free by design.
- Classifier defaults to `"material"` on ambiguous diffs — conservative:
  better to flag a non-issue than miss a real regulatory change.
- Differ handles missing prior gracefully (returns empty delta + audit
  reason `missing_prior`; does NOT crash).
- Audit emit failure does NOT crash the agent — best-effort post-
  classification, so the `RegulatoryUpdate` still returns. The SAR agent
  hard-fails on audit; this one soft-fails because the agent's
  side-effects (the Jira draft) are themselves human-gated.

See `DESIGN.md` for the full invariant table.

## Contracts (see `src/regulatory_change/types.py`)

| Type | Purpose |
|---|---|
| `Section` | Logical chunk inside a `ComplianceDoc.body` (heading + text). |
| `ChangeChunk` | One section that changed between versions (prior + current text). |
| `PolicyDelta` | Aggregate diff: added / removed / changed sections + materiality. |
| `JiraDraft` | Draft ticket: `{title, body, labels, severity, source_doc_id, materiality, audit_event_id, human_review_required}`. |
| `RegulatoryUpdate` | Output: `{doc_id, delta, jira_draft?, audit_event_id, audit_reason}`. |
| `ChangeReason` | `Enum` of stable audit reason codes. |
| `AuditEmitter` | Injected protocol: `emit(record) -> str` (returns event id). |
| `JiraClient` | Injected protocol: `draft(payload) -> str` (returns draft id). MUST NOT make HTTP calls — fakes only in tests. |

Cross-package contract: `ComplianceDoc` mirrors the TS shape from
`products/amliq/brain/corpus/src/types.ts`. Python cannot import TS; the
shape is replicated and version-pinned by code review.

## Layout

```
regulatory-change/
├── pyproject.toml
├── README.md
├── DESIGN.md
├── src/regulatory_change/
│   ├── __init__.py
│   ├── types.py
│   ├── differ.py
│   ├── classifier.py
│   ├── jira_drafter.py
│   ├── change_agent.py
│   └── _audit.py
└── tests/
    ├── conftest.py
    ├── test_differ.py
    ├── test_classifier.py
    ├── test_jira_drafter.py
    └── test_change_agent.py
```

## How to test

```bash
# from this directory
python -m pip install -e ".[dev]"

pytest tests/
ruff check src tests
mypy src
```

Coverage gates:

- `classifier.py` → **100 %** line + branch (safety-critical).
- `jira_drafter.py` → **100 %** line + branch (safety-critical;
  the "never auto-creates" invariant lives here).
- `change_agent.py` audit-emit + "never auto-create" paths → **100 %**.
- everything else → ≥ 90 % line / ≥ 85 % branch (portfolio baseline).

## Status (M3 W9)

Skeleton + classifier heuristics + Jira draft shape. Real Jira API
integration ships later. Mesh §7-§11 contracts honoured: every output
type carries `human_review_required: bool` defaulting to True; no
outbound HTTP; stable audit reason codes only.
