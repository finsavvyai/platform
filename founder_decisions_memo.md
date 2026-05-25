# Founder Decisions Memo

Re-examination of four repos flagged for action. **My earlier matrix was wrong on three of these.** Headline: only one of the four is a shutdown candidate, and even that one ships first.

---

## 1. `queryflux-git` — **NOT archive. Promote to CORE product (8th product line).**

### Evidence

| Signal | Reading |
|---|---|
| File count | 791 files (excluding node_modules/.git) |
| Last commit | "docs: map existing codebase" — commits within the last 7 days |
| Recent work | Tasks 9.x (Code Generation Engine), 11.x (Team Management, Subscriptions, SSO), 13.x (Security Hardening) — all merged |
| Surface area | web + desktop + electron + mobile + MCP server + vscode-extension + browser extension + openai-app + worker + d1 backend |
| Brand | "QueryFlux — The AI-native database workspace for builders shipping apps with agents" |
| LICENSE | Present |
| Sub-products consolidated | `querylens`, `querylens-api`, `queryflux-mcp-server`, `queryflux-desktop`, `queryflux-electron`, `queryflux-backend` |

This is not an "uncertain orphan." It is an actively shipping product with paying-customer infrastructure (subscriptions, SSO), recent security work, and a clear position in the ecosystem thesis: **the database layer for AI-coded applications.** That fills a real gap — the consolidation plan covers code validation (PushCI), QA (Qestro), orchestration (LunaOS), runtime security (OpenSyber), governance (SDLC.cc), and AML (AMLIQ), but has nothing for the data tier.

### Recommendation

Add **QueryFlux** as the 8th core product:

```
products/queryflux/
├── web/            (from queryflux-git/src + website)
├── desktop/        (from queryflux-desktop, queryflux-electron)
├── mobile/         (from mobile/)
├── mcp-server/     (from queryflux-mcp-server) — also OSS via oss/queryflux-mcp/
├── lens/           (from querylens, querylens-api)
└── backend/        (from queryflux-backend, queryflux-worker)
```

Update plan's product table:

| Product | Role |
|---|---|
| QueryFlux | AI-native database workspace + data layer for AI agents |

Update GTM flow:

> Developer uses Cursor → installs PushCI → adopts QueryFlux (for DB access from agent) → adopts Qestro → adopts OpenSyber → adopts SDLC.cc

QueryFlux is a natural early-stack adoption right after PushCI — every developer using AI for code-gen also needs a safe DB layer for the agent.

Folds in from old matrix:
- `queryflux/` (just contains `querylens-api`) → fold into `products/queryflux/lens/`
- `querylens/` → fold into `products/queryflux/lens/`

---

## 2. `autoboot` — **Two things, not one. Disentangle, then archive the product, keep the harness.**

### What's actually in there

`portfolio/autoboot/` is **the FastPM product, not the sprint harness.** I conflated them. Evidence:

| Signal | Reading |
|---|---|
| `package.json` name | `"fastpm"` |
| README title | "FastPM MCP Server" |
| Last commit subject | "Rebrand AutoBoot to FastPM - Complete implementation" |
| Surface | Full marketing site (login, register, dashboard, password reset, upgrade), LemonSqueezy payments, VSCode extension, IntelliJ plugin, Netlify functions |
| Last code change | 2026-05-16 (≈9 days ago) |
| Domain | `fastpm.dev` (marked for park in the plan) |

The **sprint harness** is at portfolio root level, not inside `autoboot/`:
- `harness.sh` (17KB executable)
- `_harness/` directory
- `sprint.py`, `sprint_daemon.py`, `apply_merge_schedule.py`, `parity_harness.py`, `merge_finsavvyai.py`
- `run_parallel_day.sh`, `monitor_parallel_day.sh`, `run_reviewers.sh`, `run_pr_auditor.sh`
- `_audits/`, `_briefs/`, `_drafts/`, `_merge_logs/`, `_reviews/`, `_reports/`

### Recommendation

**Disentangle as two separate decisions:**

**(a) The FastPM product (`portfolio/autoboot/`)** — *Archive.* Reasoning: domain already parked per plan; product is "MCP server for dev-server restart" which is a developer tool with low strategic fit to the AI-infra thesis (it doesn't validate, secure, or govern AI — it restarts dev servers); has full sales infrastructure but no traction signal in the docs; the rebrand to FastPM and recent payment integration suggests the founder already tried to commercialize and didn't get distribution. **Action:** snapshot to `_archive/fastpm-2026-05/`, take site down, redirect `fastpm.dev` to `finsavvyai.com`. Recover useful primitives (MCP server skeleton, payment integration boilerplate) into `oss/automationhub/` if not already there.

**(b) The sprint harness (root-level scripts + `_*` dirs)** — *Keep as INFRA.* Move under `infrastructure/sprint-harness/` in the monorepo. This is your internal automation; it's not a product, it's how you ship. The matrix already had this right, but the wording confused the two.

---

## 3. `looma-sh` — **NOT shutdown. Spin out (externalize), don't kill.**

### Evidence against shutdown

| Signal | Reading |
|---|---|
| Production status | Live: `looma.sh` (marketing) + `relay.looma.sh` (API). README dated 2026-05-08: "Phase 1 (auth + persistence) shipped to production. Signup → `lk_` API key flow live." |
| Investor materials | `INVESTOR_BRIEF.md`, `TRACTION.md`, `RISKS.md`, `ROADMAP.md`, `TEAM.md`, `TECH_DEEP_DIVE.md`, `OPENCLAW_COMPARISON.md` — full pitch package |
| IP protection | `IP_PROTECTION_STRATEGY.md` + `IP_PROTECTION_CHECKLIST.md` — active IP work |
| Commercial model | Free tier (3 vehicles, 10 msg/min) + paid tiers — already monetizable |
| Surface | Multi-tenant arch docs, Sentry instrumentation across app/api/relay, Playwright tests, Docker prod compose |
| Last code change | 2026-05-13 (≈12 days ago — recent but slowing) |

This is a shipped V2V (Vehicle-to-Vehicle) messaging product with live production endpoints, a paid pricing model, an investor brief, and IP-protection work underway. Killing it destroys real, demonstrable value.

### Why it doesn't belong in FinsavvyAI

The ecosystem thesis is **AI software infrastructure**. Looma is **automotive V2V messaging infrastructure**. Different vertical, different buyer, different regulatory landscape (DOT/NHTSA, not SOC 2/EU AI Act), different sales motion. Folding it into FinsavvyAI dilutes both stories.

### Recommendation

**Externalize, don't shutdown.** Three options ranked:

1. **(Recommended) Spin out as a separate entity.** Looma already has its own brand, domain, investor brief, and production deployment. Stand it up as a sibling company under your personal cap table. Maintain it on its own velocity. Cost: low — it's already organized as a standalone repo. Benefit: keeps optionality. If automotive V2V hits, you have a separate equity story; if it doesn't, you sunset cleanly without touching FinsavvyAI's narrative.

2. **Park as "maintenance-only".** Keep production running, stop active development, retain `INVESTOR_BRIEF.md` and IP work. Revisit in 6 months. Cost: ongoing Cloudflare bill + monitoring noise. Acceptable if Cloudflare costs are <$50/mo.

3. **Sell or transfer.** If you don't want to maintain it, the investor materials and live endpoints make it a credible micro-acquisition target for a Cloudflare-native automotive shop. Worth a 1-hour conversation with an automotive contact before doing option 1 or 2.

**Do not** archive into `_archive/`. That throws away the live deployment, the investor materials, and any traction signal accumulating in production.

---

## 4. `a2a-framework` — **Add LICENSE today, promote to OSS, position as A2A reference impl.**

### Evidence

| Signal | Reading |
|---|---|
| Stated intent | CLAUDE.md mission: "Open-source framework for agent-to-agent (A2A) communication" |
| LICENSE | **Missing.** Confirmed via `ls`. |
| Readiness self-rating | 55% / Category: BUILD (per CLAUDE.md) |
| Source files | 72 in main repo + 88 across 4 sub-projects (a2a-server Python, a2a-cli, a2a-agent-record, a2a-server TS) |
| Last activity | 2026-05-13 (≈12 days) |
| Protocol coverage | JSON-RPC over HTTP/WebSocket/SSE/stdio; Google ADK handler; agent-card generation |
| Strategic fit | A2A is Google's published agent-interop protocol. Having a working reference implementation is a real OSS position. |

### Why this matters

A2A (Agent-to-Agent) is a public protocol with active community interest. A working multi-transport reference implementation is the kind of OSS asset that creates inbound — devs searching "A2A framework Python" find your repo, install it, and become aware of FinsavvyAI. **It's a distribution channel for the broader ecosystem.**

It also feeds LunaOS directly: LunaOS orchestrates AI agents; A2A is how those agents talk. Position it as the wire protocol layer under LunaOS.

The missing LICENSE is the only thing blocking OSS distribution. **No license = legally unusable as OSS even if it's on GitHub.**

### Recommendation

Today (5 minutes):

1. Add `LICENSE` (MIT — same as PipeWarden per plan, keeps OSS license alignment consistent).
2. Add `LICENSE` header to a representative `.py` and `.ts` file as the canonical attribution example.

This week:

3. Move to `oss/a2a-framework/` per the matrix.
4. Add to plan's OSS list (alongside PipeWarden, telemetry SDK, MCP tooling).
5. Position in README as "A2A reference implementation by FinsavvyAI" with a one-line link to LunaOS as the production user of the protocol.

Next month:

6. Get the readiness from 55% → 80% (closing the BUILD category). The CLAUDE.md inside the repo should already have a punch list.

**Do not archive.** A standards-aligned protocol implementation is high-leverage OSS — much higher leverage than the raw line count suggests, because every install is also a marketing touchpoint for the broader stack.

---

## Net effect on the migration matrix

Three corrections to the addendum (`finsavvyai_consolidation_plan_addendum.md`):

| Repo | Old bucket | New bucket | Reason |
|---|---|---|---|
| `queryflux-git` | ARCHIVE → or fold | **CORE (8th product)** | Active, shipping, fills data-layer gap |
| `queryflux`, `querylens` | ARCHIVE → or fold | **CORE (fold into QueryFlux)** | Sub-components of QueryFlux |
| `autoboot` (the FastPM product) | ARCHIVE | **ARCHIVE** (unchanged) | But the matrix's "INFRA" line conflated this with the harness — clarify the harness is separate root-level scripts |
| `looma-sh` | ARCHIVE | **EXTERNALIZE (spin-out)** | Live production + investor materials → not a shutdown candidate |
| `a2a-framework` | OSS (keep if active) | **OSS (definitely keep)** | Standards-aligned, strategic positioning value; just needs LICENSE |

Updated counts after these corrections:

- **CORE**: 8 product lines (added QueryFlux)
- **OSS**: ~7 packages (a2a-framework upgraded from conditional to definite)
- **PLATFORM**: 5 services (unchanged)
- **INFRA**: ~9 internal-tooling repos + sprint harness clearly attributed
- **EXTERNALIZE**: 1 (looma-sh — new bucket, not previously enumerated)
- **ARCHIVE**: ~20 repos (down by 2 — queryflux + querylens moved to CORE)

---

## What I need from you to finalize

Four explicit yes/no decisions:

1. **QueryFlux as 8th product** — yes / no?
2. **FastPM archive sequence** — take site down + redirect immediately, or wait until quarterly cleanup?
3. **Looma-sh disposition** — spin-out / park / sell / archive?
4. **A2A-framework MIT license** — proceed with MIT, or use a different license (Apache 2.0, BSL)?

Reply with the four answers and I'll update the addendum and migration matrix in one pass.
