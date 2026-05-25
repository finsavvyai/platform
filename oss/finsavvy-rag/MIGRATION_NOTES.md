# MIGRATION NOTES — finsavvy-rag

Authoritative record of what was moved from the original repo into this OSS
package, what was changed, and what remains open for follow-up.

## Source

- **From:** `/Users/shaharsolomon/dev/projects/FinSavvyAI_Distributed_RAG/`
  (private repo, ~80K total, 14 tracked files)
- **To:** `/oss/finsavvy-rag/` (this directory)
- **Method:** `rsync -av` with standard build-artifact excludes:
  `.DS_Store`, `.git`, `node_modules`, `__pycache__`, `*.pyc`, `.venv`, `venv`,
  `dist`, `build`, `.env`, `*.log`, `logs`.
- **Date:** 2026-05-25
- **Plan reference:** `decisive_plan_90day.md` Week 4 Stream A (started early).

## What was migrated (preserved as-is)

| Source path | Notes |
|---|---|
| `services/rag/app.py` | FastAPI RAG service. SQL is parameterised. Unchanged. |
| `services/rag/ingest.py` | CLI ingester. Parameterised SQL. Unchanged. |
| `services/rag/requirements.txt` | Python deps. Unchanged. |
| `services/rag/corpus/example.txt` | Sample doc. Unchanged. |
| `services/gateway/app.py` | OpenAI-style proxy. Unchanged. |
| `services/gateway/requirements.txt` | Python deps. Unchanged. |
| `docker/compose.yml` | Postgres 16 + pgvector. Unchanged. |
| `docker/init.sql` | Schema + indexes. Unchanged. |
| `scripts/start_all.sh` | Dev launcher. Unchanged. |
| `scripts/cleanup_logs.sh` | Dev helper. Unchanged. |

All preserved source files are under the 200-line cap (largest is
`services/rag/app.py` at 73 lines).

## What was hardened / sanitised

| Change | File | Why |
|---|---|---|
| Replaced `HF_TOKEN=hf_xxx` with explicit `REPLACE_WITH_...` placeholder | `.env.example` | Less ambiguous — `hf_xxx` could be mistaken for a real prefix. |
| Replaced `PGUSER=postgres` / `PGPASSWORD=postgres` defaults with `REPLACE_WITH_...` placeholders | `.env.example` | Avoid copy-paste-to-prod weak credentials. |
| Replaced `192.168.1.10` / `192.168.1.11` example IPs with `node-a.example.local` / `node-b.example.local` | `.env.example`, `configs/nginx/nginx.conf`, `configs/caddy/Caddyfile` | Generic placeholders — no implication of a real internal topology. |
| Added explicit `EMBED_MODEL`, `GATEWAY_UPSTREAM`, `LLM_LOCAL_URL`, `LLM_LB_URL` rows | `.env.example` | All env vars the code reads now documented. |
| Rewrote README header: dropped internal-product framing, added OSS posture, hardening notes, audit-port integration, ComplianceDoc shape | `README.md` | Public-facing, no internal-product leakage. |

## What was added

| File | Purpose |
|---|---|
| `LICENSE` | Apache License 2.0 full text (per decisive plan decision #4). |
| `README.md` | Replaced original. Public-OSS-friendly. |
| `CONTRIBUTING.md` | Contribution flow + style. |
| `MIGRATION_NOTES.md` | This file. |
| `src/types/compliance-doc.ts` | Public TS interface for the cross-agent `ComplianceDoc` contract (CORPUS-PIPELINE producer / RAG indexer consumer). |
| `src/types/audit-port.ts` | Public TS port mirroring AUDIT-TAMPER's `chainAppend` / `verifyChain` contract. Injected via DI; no runtime dep on `@finsavvyai/*`. |

## What was NOT changed (and the rationale)

- **Python source code (`app.py`, `ingest.py`, gateway).** Source preserved
  as-is per agent scope rules. Already uses parameterised SQL; no injection
  surface to fix in this pass.
- **`docker/compose.yml` does not enforce strong Postgres password.** It still
  pulls from `${PGPASSWORD:-postgres}`. Consumers must set a real password in
  their `.env`. Documented in README hardening notes.
- **Reference Caddy / Nginx configs leave CORS `*`** for dev convenience.
  Flagged in README; production deployments must tighten.

## Workspace integration

- Per OSS rule, `oss/finsavvy-rag/` is **NOT** added to `pnpm-workspace.yaml`.
- Per round-2 rule, no `@finsavvyai/*` imports were introduced.
- The TS interfaces in `src/types/` are pure type defs (no runtime), so they
  carry no dep weight.

## Open items (for HANDOFF / follow-up)

See `HANDOFF` block in agent return summary for the full list. Highlights:

- No SQL injection risks observed (all parameterised). Confirmed by grep.
- No hardcoded secrets remain in this tree.
- All source files <200 LOC.
- No formal request-body size limits or auth at the FastAPI edge — flagged as
  residual risk for downstream wiring.
- Pin `python` version (`python3.11+`) and add `pyproject.toml` in a follow-up.
