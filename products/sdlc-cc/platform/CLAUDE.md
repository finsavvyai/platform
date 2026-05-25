# SDLC Platform — CLAUDE.md

> **STATUS (2026-05-20):** Active — **Privacy Gateway + 3-Product Trust
> Bundle**. `services/gateway` repositioned as a privacy gateway
> (PII/secrets scrub before any LLM call). Bundled with **AMLIQ** and
> **OpenSyber/Claw** under one Trust Center + one MSA. AGPL-3.0 +
> tiered commercial (Team $39/seat/mo · Business $79/seat/mo ·
> Enterprise $4K+/yr/seat).
> See [`docs/PIVOT-2026-05-20-PRIVACY-GATEWAY.md`](docs/PIVOT-2026-05-20-PRIVACY-GATEWAY.md)
> for the decision record and [`ROADMAP.md`](ROADMAP.md) for the task list.
>
> Prior direction-doc history:
> - 2026-05-16 legal-AI version — superseded; legal-AI now one DLP preset
> - 2026-05-14 sunset version — recoverable from git history
> - Enterprise-positioning archive at
>   [`docs/archive/2026-05-14-enterprise-pivot/`](docs/archive/2026-05-14-enterprise-pivot/)
>   — relevant again post yr-1 revenue / SOC 2 audit.

## Mission

Ship `services/gateway` as an open-source (AGPL-3.0) **privacy
gateway** that scrubs PII and secrets out of prompts before any LLM
call (Anthropic / OpenAI / Bedrock / Vertex / Azure / local).
Distribute via Docker + browser extensions (Chrome/Edge/Firefox/Safari)
+ IDE addins (VS Code/JetBrains/Cursor) + Office addins (Word/Outlook).
Monetise via tiered subs (Team $39/seat/mo · Business $79/seat/mo) plus
**$4K+/yr/seat commercial license** for closed-source embedders.

Bundle with **AMLIQ** (AML compliance dashboard) and **OpenSyber/Claw**
(multi-provider AI gateway) under **one Trust Center + one MSA** so an
enterprise buyer signs once and adopts any combination.

Legal-AI is now **one DLP preset** (`legal`) alongside `pii_default`,
`secrets`, `finance`, `healthcare` — not the headline.

Yr-1 goal: **$90-220K solo**, of which ~$30K funds the SOC 2 Type II
audit that re-opens the enterprise tier in yr 3.

Track 6 (AMLIQ port) is **load-bearing** for the bundle — it makes the
shared substrate real, not just marketing.

## Code map

```
sdlc-platform/
├── services/gateway/                # The product. AGPL-3.0 + commercial license.
│   ├── internal/infrastructure/audit/        # HMAC immutable audit log
│   ├── internal/domain/rbac/                 # RBAC evaluator
│   ├── internal/infrastructure/rbac/         # Pgx loader
│   ├── internal/infrastructure/middleware/dlp_*   # DLP + legal preset (NEW)
│   ├── internal/domain/spend/                # Per-tenant spend tracker
│   ├── internal/infrastructure/spend/        # Postgres-backed sink + pricing + usage
│   ├── internal/infrastructure/sso/          # SAML / OIDC / MFA / WebAuthn
│   ├── internal/infrastructure/scim/         # SCIM 2.0 user + group store
│   ├── internal/infrastructure/billing/      # LemonSqueezy webhook + Stripe (archived path)
│   └── cmd/server/                           # Chi router, OpenAPI3
├── services/rag/                    # Python FastAPI + pgvector (also AGPL)
├── services/document-processor/     # Node.js, OCR, queues (also AGPL)
├── services/admin-ui/               # Next.js admin (also AGPL)
├── landing-page/                    # Cloudflare Pages — sdlc.cc public face
├── database/migrations/             # Canonical migrations; CI applies in migrations.yml
├── LICENSE                          # AGPL-3.0
├── COMMERCIAL.md                    # How to buy the commercial license
├── ROADMAP.md                       # Current launch + revenue roadmap
└── docs/
    ├── PIVOT-2026-05-16-LEGAL-AI.md # Decision record (THIS direction)
    ├── PIVOT-2026-05-14.md          # Sunset direction (superseded)
    ├── adr/                         # Architecture decisions — still valid
    └── archive/2026-05-14-enterprise-pivot/   # Future use; funded by yr-1 revenue
```

## Engineering rules (unchanged)

These come from the portfolio `CLAUDE.md` and the pivot does not
weaken them.

- **Maximum source file size: 200 lines per file.**
- **Strict typing** at boundaries: Go structs, Python Pydantic,
  TypeScript interfaces, no `any`.
- **No TODO / FIXME** in release branches without a tracked issue.
- **Coverage targets:**
  - 100% on critical paths (auth, permissions, data writes,
    DLP, audit)
  - ≥90% line / ≥85% branch overall
- **Every bug fix:** failing test first, then fix.
- **No merge on red CI.**

## License model

- **AGPL-3.0** for the public OSS release. Anyone embedding the
  gateway in a non-OSS product must release their source under
  AGPL, or buy out.
- **Commercial license** at $4K/yr/seat lifts that obligation. See
  [`COMMERCIAL.md`](COMMERCIAL.md).
- **Contributor License Agreement (CLA)** required on every PR so
  we can grant commercial-license rights cleanly.
- **SPDX headers** required on every Go file: `// SPDX-License-Identifier: AGPL-3.0-or-later`.

## Stack

| Component | Stack |
|---|---|
| Gateway | Go 1.24, Chi router, OpenAPI3 |
| RAG | Python 3.11, FastAPI, pgvector |
| Document processor | Node.js, Bull, Tesseract |
| Database | PostgreSQL 16 + pgvector |
| LLM providers | Anthropic, OpenAI, Bedrock, Vertex, Azure, ClawPipe |
| Billing | LemonSqueezy (Stripe code stays for future enterprise tier) |
| Edge | Cloudflare Workers + Pages |

## Testing

Same matrix as before. The vertical positioning does not lower the
test bar — it raises the stakes (privilege-mishandling lawsuits).

- **Go:** `go test ./...` with `testcontainers-go` for DB/cache
- **Python:** `pytest` with real asyncpg
- **Node.js:** Jest + Supertest
- **E2E:** Playwright + the docker-compose stack in
  `.github/workflows/e2e.yml`
- **Migrations:** `.github/workflows/migrations.yml` applies the
  canonical set + gateway-internal 011/012/013 with the
  table-existence verification step

### Legal-DLP test bar

Every new DLP pattern in `internal/infrastructure/middleware/dlp_*`
must ship with:
- A behaviour test proving redaction on a positive sample
- A behaviour test proving zero false-positive on a representative
  negative sample
- A docstring noting which legal-ethics rule the pattern is meant
  to protect (e.g., "ABA Model Rule 1.6 confidentiality")

## Code review checklist

- [ ] No file exceeds 200 lines
- [ ] All public functions have docstrings
- [ ] SPDX header present on new Go files
- [ ] No `any` types; all params typed
- [ ] Error cases handled explicitly
- [ ] No hardcoded secrets
- [ ] Test coverage targets met
- [ ] If touching DLP: positive + negative behaviour tests added
- [ ] If touching billing or auth: critical-path test refreshed

## Commands

```bash
# Development
docker-compose up
cd services/gateway && go run cmd/server/main.go
cd services/rag && python -m uvicorn main:app --reload

# Path 6 (AMLIQ port) work happens in the peer aegis/ repo
cd ../aegis && ...

# Testing
cd services/gateway && go test ./...
cd services/rag && pytest

# Migrations (CI runs this on every PR via .github/workflows/migrations.yml)
psql ... -f database/migrations/000_schema_migrations_table.sql
```

## Apple HIG (portfolio rule, still applies)

Anything user-facing (landing page, admin UI, the eventual customer
dashboard for license-buyers):

- Clear, calm, content-first
- Respect platform spacing + typography
- Motion supports comprehension, not decoration
- Accessibility: contrast, keyboard, screen-reader labels

## Apply rules from memory

- **No false completion** — never claim "done" / push phase-N-complete
  tags without verifying the Done-when criteria in ROADMAP.md.
- **No Co-Authored-By trailer** in commits.
- **Pivot 2026-05-16** is the active direction; the 2026-05-14
  sunset is superseded. Don't propose enterprise-tier work or revive
  the killed Paths 4/5 without first checking that the funding /
  market picture changed.

## Definition of done

The launch-sprint definition of done is in `ROADMAP.md`. Headline:
**one paid commercial license (Track A + B) or one paid consulting
contract (Track C) clears the bank.**

After that the work shifts to "keep selling, fund SOC 2 audit, then
re-open the enterprise tier."
