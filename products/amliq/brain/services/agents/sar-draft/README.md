# `sar-draft` — AMLIQ Brain SAR Draft Agent (skeleton, M2 W6)

First Python code in the FinsavvyAI platform. Establishes the pattern for
the rest of the agent runtime (`regulatory_change/`, `alert_triage/` to
follow in M3).

## What this is

A skeleton orchestrator that turns an `AlertInput` (produced by AMLIQ
Investigate when `/v1/aml/decision` returns `decision="review"|"block"`)
into a `SarDraft` — a populated US FinCEN SAR template wrapped with
provenance, confidence, and an audit trail.

**This is a SKELETON.** The template bodies are placeholder content. Real
FinCEN narrative requirements land in M3 alongside the regulatory-change
agent. What matters today is the **structure and substitution mechanism**.

## Safety posture

- `human_review_required` is **always `True`** in v0. SAR drafts are never
  auto-filed. A human compliance officer signs every submission.
- Jinja2 `autoescape=True` is mandatory. Template content NEVER receives
  raw user-controlled HTML/markdown without escaping.
- Audit records emitted from this agent carry **stable reason codes
  only** (`ok`, `missing_template`, `retrieval_failed`, …) and PII-redacted
  metadata. No transaction amounts, party names, or account numbers ever
  reach the audit sink from this layer.
- See `DESIGN.md` for the full safety invariants table.

## Contracts (see `src/sar_draft/types.py`)

| Type | Purpose |
|---|---|
| `AlertInput` | Triggering alert payload (alert_id, tenant_id, txn refs, parties) |
| `Citation` | `{doc_id, span_start, span_end, source}` — mirrors `SearchResult.citations` from SEARCH-UI |
| `SarDraft` | Output: `{alert_id, template_id, filled_text, citations, confidence, human_review_required, audit_event_id}` (mesh §4) |
| `RetrievalAdapter` | Injected protocol: `search(query, tenant_id, top_k) -> list[SearchResult]` |
| `AuditEmitter` | Injected protocol: `emit(record) -> None` (matches TS audit shape) |

No `@finsavvyai/*` imports (Python cannot import TS anyway — the contract
shape is documented and mirrored in `types.py`).

## Layout

```
sar-draft/
├── pyproject.toml
├── README.md
├── DESIGN.md
├── src/sar_draft/
│   ├── __init__.py
│   ├── types.py
│   ├── template_registry.py
│   ├── context_fill.py
│   ├── draft_agent.py
│   └── templates/
│       ├── _index.yaml
│       ├── structuring.j2
│       ├── unusual_activity.j2
│       ├── insider_trading.j2
│       └── sanctions_evasion.j2
└── tests/
    ├── test_template_registry.py
    ├── test_context_fill.py
    └── test_draft_agent.py
```

## How to test

From this directory:

```bash
# install dev deps (uses a fresh venv recommended)
python -m pip install -e ".[dev]"

# unit tests + coverage report
pytest tests/

# lint
ruff check src tests

# type-check
mypy src
```

Coverage gates (enforced in CI once wired):

- `context_fill.py` → 100 % (template-injection safety lives here)
- `draft_agent.py` audit-emit + `human_review_required` invariant → 100 %
- everything else → ≥ 90 % line / ≥ 85 % branch (portfolio baseline)

## Status (M2 W6)

Skeleton only. Placeholder template content. End-to-end happy path with
mocked `RetrievalAdapter` + `AuditEmitter` passes. Real FinCEN narratives,
PII redaction integration with the TS audit sink, and the human-review UI
land in subsequent weeks.
