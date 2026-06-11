# `services/agents/` — Python agent layer

Python agent packages for AMLIQ Brain. The API service talks to agent
runtimes over HTTP so the TypeScript boundary stays runtime-agnostic and
does not import Python code in-process.

## Current packages

| Package | Status | Purpose |
|---|---|---|
| `sar-draft/` | skeleton + HTTP contract | Alert input to FinCEN SAR draft. |
| `regulatory-change/` | skeleton | Compliance document delta to Jira draft. |
| `alert-triage/` | skeleton | Alert to priority, category, and reasoning chain. |

Each package owns its own `pyproject.toml`, tests, lint, and type-check
config. Agent outputs keep `human_review_required` true in v0. Stable audit
reason codes are required; audit metadata must not carry PII.

## API integration state

- `sar-draft/src/sar_draft/http_runtime.py` exposes the `{ok, draft}`
  envelope consumed by the TypeScript `HttpSarDraftGenerator`.
- Brain API mounts `POST /v1/brain/sar-draft` when
  `BRAIN_SAR_DRAFT_ENDPOINT` is configured.
- Regulatory Change and Alert Triage are package-shaped but do not yet have
  TypeScript HTTP adapters or API routes.

## Remaining work

- Host the Python runtimes as separate services with explicit auth.
- Add API adapters/routes for Regulatory Change and Alert Triage.
- Wire agent test/coverage jobs into CI.
- Replace placeholder SAR template content with reviewed FinCEN narratives.
- Connect human-review UI links from agent outputs into the Brain web surface.
