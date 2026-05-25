## Learned User Preferences

- **No false completion.** Never claim "done"/"complete" or push `phase-N-complete` tags without verifying ROADMAP `Done-when` criteria. Tests passing ≠ feature working.
- **No `Co-Authored-By` trailer** in commits. Forward-only; do not rewrite history to strip.
- **Caveman mode default.** Terse, drop articles/filler. Code, commits, security warnings stay normal.
- **200-line file cap** (portfolio rule). Refactor on overflow.
- **SPDX headers** on every Go file: `// SPDX-License-Identifier: AGPL-3.0-or-later`.
- **Failing test first, then fix.** Every bug.
- **Mark `[x]`** on done task checkboxes in spec/roadmap files.
- **Ask before risky/irreversible actions** (force push, branch delete, secret commits).
- **Apple HIG** for any user-facing surface (landing, admin, dashboard).

## Learned Workspace Facts

### Repo
- `sdlc-platform` — Go gateway (`services/gateway`) + Python RAG + Node doc-processor + Next.js admin.
- License: **AGPL-3.0 + $4K/yr/seat commercial**. CLA required on PRs.
- Canonical migrations in `database/migrations/`; CI applies via `.github/workflows/migrations.yml`.
- Active branch: `main`. Recent: legal-AI pivot docs, DLP migration 032, landing pricing page.

### Active direction (2026-05-20)
- **Privacy gateway** — scrub PII/secrets before LLM prompts. Market hot: Lakera → Check Point ~$300M (May 2025).
- **Real Go backend** (`services/gateway`); multi-surface distribution: browser extensions (Chrome/Edge/Firefox/Safari) + IDE addins (VS Code/JetBrains/Cursor) + Office addins (Word/Outlook).
- **Bundle 3 portfolio products** as one Trust story — single Trust Center + single MSA:
  - `sdlc-platform` — privacy gateway (front door, DLP, audit, RBAC, SSO, SCIM)
  - `AMLIQ` — AML compliance dashboard (vertical proof point using gateway primitives)
  - `OpenSyber / Claw` — multi-provider AI gateway w/ provider fallback (routing layer)
- Pricing tiers: Free (self-host) · Team $39/seat/mo · Business $79/seat/mo · Enterprise contact (≥$4K/yr/seat commercial license).
- Supersedes 2026-05-16 legal-AI framing; legal-AI now one preset (`legal`) inside DLP alongside `pii_default`, `secrets`, `finance`, `healthcare`.
- Decision record: [`docs/PIVOT-2026-05-20-PRIVACY-GATEWAY.md`](docs/PIVOT-2026-05-20-PRIVACY-GATEWAY.md).

### Prior pivots (history)
- 2026-05-16 — Legal-AI OSS+commercial ($4K/yr/seat, US v. Heppner privilege hook).
- 2026-05-14 — Path 6 only (AMLIQ port); Paths 4 (MCP) + 5 (cost-ops) killed by competitor research.
- Enterprise-compliance docs archived in `docs/archive/2026-05-14-enterprise-pivot/` — revisit when yr-1 revenue funds SOC 2.

### Sibling repos
- `aegis/` — active monorepo with `cmd/sdlc-api`; legal/compliance code lives there.
- `AMLIQ` — production React AML dashboard; component port (Track 6) running in parallel.
- `OpenSyber` — AI gateway "Claw" with provider fallback.

### Stack
Go 1.24 (Chi, OpenAPI3) · Python 3.11 (FastAPI, pgvector) · Node (Bull, Tesseract) · Postgres 16 · LemonSqueezy billing · Cloudflare Workers+Pages edge.

### Coverage bar
100% critical paths (auth, DLP, billing, audit). ≥90% line / ≥85% branch overall. CI blocks merge on red.
