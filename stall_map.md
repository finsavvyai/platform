# Stall Map — What Pauses So Brain Can Ship

Companion to `decisive_plan_90day.md`. The plan focuses 4 streams on AMLIQ Brain + Series A. Everything else needs an explicit status — otherwise these projects will quietly consume attention, eng cycles, domain costs, and cognitive load over the next 6 months.

**Five buckets:**

| Status | Meaning | Action this week |
|---|---|---|
| 🟢 **ACTIVE** | Inside the decisive plan's 4 streams | Per the plan |
| 🟡 **BACKGROUND** | Stays alive, monthly status check-in only, no acceleration | Assign owner, set monthly cadence |
| 🟠 **STALL** | Pause active dev. Keep production running if live. No new features, no new commits beyond critical fixes. | Public statement to team / customers if relevant |
| 🔵 **EXTERNALIZE** | Move out of FinsavvyAI ownership. Spin out, sell, or transfer. | Tagged separately from FinsavvyAI work |
| 🔴 **SHUT DOWN** | Take site down, redirect domain, snapshot + delete | Execute in week 1 |

---

## 🟢 ACTIVE — the 4 streams of the plan

These get the team's focus for 6 months. Already covered in the decisive plan, listed here for completeness.

| Project | Stream | Why active |
|---|---|---|
| AMLIQ Brain | A · Brain Build | Primary product launch |
| AMLIQ Investigate | B · Investigate Migration | Addendum Weeks 4-6; ships alongside Brain |
| `oss/finsavvy-rag/` | A · OSS support | OSS wedge for Brain; replaces the parked OSS RAG attempt |
| `oss/a2a-framework/` | A · OSS support | Licensed + minimal maintenance |
| `oss/mcp-tooling/` | A · Brain connectors | Connector library for Brain |
| `platform/auth + billing + telemetry + ai-gateway + policy-engine` | A + B · Platform | Brain + Investigate both depend on these |
| `websites/finsavvyai.com/` | A · Marketing | Refresh in M5; receives Brain product pages |
| Sprint harness (`_harness/`, `sprint_daemon.py`, etc.) | Cross-cutting | Continuous infra; do not touch |

**Eng resource estimate:** ~3 engineers + founder time, fully loaded on the above for 6 months.

---

## 🟡 BACKGROUND — alive but not accelerated

Already in the decisive plan's "Background workstreams" section. Listed here with explicit rules.

| Project | Owner | Cadence | Hard rule |
|---|---|---|---|
| **TenantIQ** | TenantIQ owner | Monthly status to founder | **No new features.** Only customer support + sales conversations from existing inbound. Production stays up. The market validation is real (51% MSP barrier) — pick this back up at M7 with Series A money. |
| **PushCI** | PushCI owner | Monthly status to founder | OSS PipeWarden landing page can stay; **no GA launch push** until M7. Single eng owner maintains, no team allocation. |
| **PipeWarden OSS** | PipeWarden owner | Monthly contributor cadence | Accept community PRs, do not feature-build. The Brain OSS wedge (`finsavvy-rag`) takes the M1-6 OSS spotlight. |
| **Qestro** | Qestro owner | Monthly status | Was Tier 2; no investment until Brain ships. |
| **SDLC.cc** | SDLC owner | Monthly status | Was Tier 2; regulatory tailwind still real. Keep marketing site warm, no product investment. |

**Trap to avoid:** "background" is not "freedom to keep shipping quietly." Each background project must accept that **zero engineering acceleration happens for 6 months.** If an owner can't accept that, the project moves to STALL.

---

## 🟠 STALL — pause active development

These have shipped code or active development that needs to stop. Production stays up; features freeze; engineering reallocates to Brain.

| Project | Current state | Stall scope | Why stall (not background) |
|---|---|---|---|
| **OpenSyber** | `products/opensyber/` (3.3K files); planned Tier 2 | Pause all dev. Keep marketing page live. Strategic decision (compete / partner / sell) deferred to M7. | Window is closing (Check Point bought Lakera); a half-built OpenSyber is worse than a paused one. Decide direction once Brain has Series A funds to back the choice. |
| **LunaOS** | `products/lunaos/` (22K files, harvested lunaforge) | Pause all dev. Maintain CI green. Repositioning workstream deferred to M7. | Market is crowded (LangGraph, CrewAI, Microsoft Agent Framework). Positioning fix is bigger than 90 days. |
| **QueryFlux** *(if promoted to 8th product per default)* | `products/queryflux/` planned | Keep code in monorepo so it doesn't bitrot, but **no new features, no GTM push.** Pick up M7+. | Active team work would compete for the same eng with Brain. Founder-led one-off conversations OK; no roadmap commitment. |
| **02_AI_AGENTS/llm** | `02_AI_AGENTS/llm/` (top-ranked Feb '26, but defaulted to fold into Brain) | Stop separate dev. Migrate distributed-cluster code into Brain's self-hosted inference path. No standalone product. | Folding makes Brain stronger; standalone competes with Ollama/vLLM (brutal). |
| **automationhub** | `oss/automationhub/` (11K files) | Maintain OSS, no feature push | Useful primitives for LunaOS — but LunaOS itself is paused. |
| **clawpipe** + server + benchmark | `oss/clawpipe/` (10.9K files) | Maintain OSS, no feature push | LunaOS runtime support — same logic. |
| **tokenforge** | `oss/tokenforge/` | Maintain OSS, no feature push | Telemetry SDK; absorb into `platform/telemetry` if time allows in M7. |
| **design-system / packages (F8 UI)** | `oss/design-system/` (240 files) | Available for Brain to use, no feature push | Brain UI uses it but doesn't extend it. |
| **homebrew-pipewarden** | `oss/homebrew-pipewarden/` | Maintain tap, no new releases | Distribution channel for PipeWarden, which is itself in background. |
| **javascript-package-manager (jpm)** | `02_AI_AGENTS/mcp-servers/javascript-package-manager/` | Maintain, no feature push | Useful MCP server but not a Brain dependency. |
| **npmplus-core** | `02_AI_AGENTS/mcp-servers/npmplus-core/` | Stale (Aug '25). No further work. | Already not in active development. |
| **coderailflow / coderail-dev** | `coderailflow/`, `coderail-dev/` | Park pending decision (LunaOS module vs archive) | Decision blocked on LunaOS, which is stalled. |
| **sprint-city** | `infrastructure/sprint-tooling/sprint-city/` | Maintain as infra | Internal tool; runs on existing maintenance. |

**Counter-rule:** if a stalled product's customer/user pings with a critical bug, fix it. Do not turn maintenance into stealth feature work.

---

## 🔵 EXTERNALIZE — move out of FinsavvyAI

Real value, off-thesis. These should not consume FinsavvyAI engineering, marketing, or fundraise narrative. Spin out cleanly.

| Project | Why externalize | Move to | Action |
|---|---|---|---|
| **looma-sh** | Live production (looma.sh, relay.looma.sh), investor brief, paid pricing, V2V automotive — wrong vertical | `/Users/shaharsolomon/dev/projects/looma/` (sibling, not under portfolio/) | Founder-personal entity. Halt FinsavvyAI archive sweep. Update inventory: EXTERNALIZED, not ARCHIVED. |
| **pixel-pets** | Last commit 2 days ago (active!), full brief, AI creature franchise — off-thesis AI product | `/Users/shaharsolomon/dev/projects/pixel-pets/` (sibling) | Founder-personal or partner with co-founder. Halt archive. |
| **looma_sh_full_fun** | Looma sibling/export | Merge with externalized looma | Decide if duplicate or canonical |
| **standalone yallabye** at root | Travel app — off-thesis | Founder-personal or sell | Already known, just confirm out-of-scope for FinsavvyAI |
| **bsl** monitor | Abandoned 2021 — not externalize, see SHUT DOWN | n/a | See below |

**Rule:** externalized projects do not appear in FinsavvyAI investor materials, do not consume FinsavvyAI eng cycles, do not show up in the consolidation monorepo.

---

## 🔴 SHUT DOWN — execute in week 1

These cost something (domain, hosting, cognitive load) and have no recovery value. Pull the plug.

| Project / Asset | Cost source | Shutdown action | Done when |
|---|---|---|---|
| **autoboot / FastPM** | `fastpm.dev` domain + Netlify hosting + Supabase + LemonSqueezy account | Take site down OR redirect to finsavvyai.com. Cancel LemonSqueezy product. Snapshot code per archive manifest. | Domain redirects, billing accounts closed |
| **subsforge / subsforge.dev** | Parked domain, residual hosting | Confirm domain parked, no active billing | Confirmed |
| **viralsplit / viralsplit.io** | Parked domain, residual mobile app store presence | Pull from App Store/Play Store if listed. Domain stays parked. | App store delisted |
| **smartreply-ai / smartrepli.ai** | Parked domain | Confirm parked | Confirmed |
| **devwrapped** | GitHub Year-in-Review site | Take site down if live, snapshot code | Site offline |
| **scangenie / scan-genie variants** | Multiple repos, no live deployment | Snapshot + delete duplicates (keep 1 archive) | One archive, others gone |
| **moneh-hacham** | Smart meter project, off-thesis | Snapshot + delete | Snapshotted |
| **hashmal** | No signal, no README | Snapshot + delete | Snapshotted |
| **immortal-fc** | "first commit" — never developed | Snapshot + delete | Snapshotted |
| **codebridge** | Unclear scope | Snapshot + delete | Snapshotted |
| **flujo** | Last commit 14 months stale | Snapshot + delete | Snapshotted |
| **windsu-credit-manager** | Architecture incompatible with PushCI per earlier audit | Snapshot + delete | Snapshotted |
| **focusvault-server** | Last commit July 2025, activation-code API for unknown product | Snapshot + delete | Snapshotted |
| **02_AI_AGENTS/a2a/{a2a-server, a2a-cli, a2a-agent-record}** | All last commit April 2025; superseded by `oss/a2a-framework/` | Snapshot + delete | Snapshotted |
| **02_AI_AGENTS/mcp-servers/mcp-servers** | Stale feature branch | Snapshot + delete | Snapshotted |
| **02_AI_AGENTS/lunaos-repos/lunaos-mobile** | Never started | Delete | Gone |
| **04_chrome_extensions/extensions/vibepulse** | 4178 uncommitted changes, off-thesis games | Snapshot + delete | Snapshotted |
| **05_mobile_apps/nippy** | No signal, single-line README | Snapshot + delete | Snapshotted |
| **06_websites/Immortal-FC** | Football club site, off-thesis | Snapshot + delete | Snapshotted |
| **06_websites/finsavvyai-website × 2** | Old static sites, superseded by Astro `websites/finsavvyai.com/` | Snapshot + delete both | Snapshotted |
| **06_websites/npmplus-website** | NPM Plus marketing — npmplus-core is stale | Snapshot + delete | Snapshotted |
| **06_websites/websites/code-safety-suite/shield-ai** | Marketing site for retired code-safety-suite | Snapshot + delete | Snapshotted |
| **bsl/monitor** | Last commit Dec 2021 — 4.5 years dead | Snapshot + delete | Snapshotted |
| **09_global_remit/*** (GRapp, mobile, remit-app-basic-with-reg, remit-simple-base, remittance-app-extended, remit2, clojure-api-test) | Remittance fintech, off-thesis (and AMLIQ scope is investigations, not remittance) | Snapshot + delete each | All snapshotted |
| **All `*.agent1`, `*.agent2` worktree variants** | Sprint-loop artifacts | Snapshot + delete (per inventory) | All gone |
| **Multiple parallel queryflux/querylens dirs** | After QueryFlux promoted to `products/queryflux/`, the originals are duplicates | Snapshot + delete originals | Gone |
| **notebooklm-py** | Third-party (teng-lin) — not yours to maintain | Remove from portfolio, do not migrate | Removed |
| **all of `08_open_source/*`** | Third-party vendored code per founder note | Move to `infrastructure/vendored/opensource/`; do not migrate as products | Moved |

**Cost recovery estimate:** ~30 GitHub repos retired, 6-8 domain registrations let lapse, 4-6 SaaS subscriptions cancelled (Netlify, Vercel, Supabase, LemonSqueezy products), ~50GB local disk recovered.

---

## DO NOT TOUCH

| Project | Reason |
|---|---|
| `06_websites/hava-solomon` | **Memorial site for the user's mother.** Keep online. No FinsavvyAI category, no migration, no archive. Personal. |

---

## Summary

| Bucket | Count (approx) | Eng time committed |
|---|---|---|
| 🟢 ACTIVE | ~8 components (Brain + Investigate + platform + OSS support) | 3 eng + founder, 6 months |
| 🟡 BACKGROUND | 5 products (TenantIQ, PushCI, PipeWarden OSS, Qestro, SDLC.cc) | <0.25 eng each, monthly status |
| 🟠 STALL | ~13 components (OpenSyber, LunaOS, QueryFlux, 02-llm, OSS supports, coderailflow, etc.) | Zero feature dev. Critical fixes only. |
| 🔵 EXTERNALIZE | 3 (looma-sh, pixel-pets, yallabye standalone) | Zero FinsavvyAI eng |
| 🔴 SHUT DOWN | ~25-30 repos / sites / domains | Week 1 sweep, then zero |
| DO NOT TOUCH | 1 (hava-solomon) | n/a |

**Net effect:** 6 months from now you have one launched product (AMLIQ Brain), one migrated product (AMLIQ Investigate), Series A closed, the platform stack consolidated, and ~25 retired side projects no longer pulling on attention. Everything else is alive in maintenance, ready to be picked back up after the raise with money + clarity.

---

## What you give up by stalling

Honest accounting of the trade-offs:

- **TenantIQ stalling** is the most expensive trade. The market validation was the strongest in the portfolio (51% of MSPs flagged governance as #1 AI barrier). Risk: a competitor (AvePoint Elements expanding downmarket, CoreView pricing more aggressively) takes the segment in 6 months. Mitigation: Brain ships, Series A closes, TenantIQ gets dedicated eng + GTM in M7-12 with fresh capital and proven execution credibility.

- **PushCI/PipeWarden OSS** as background means the developer wedge isn't your headline for the next 6 months. Risk: CodeRabbit, Greptile, Snyk continue their lead. Mitigation: Brain is a *compounding* wedge — once Series A funds GTM, PushCI re-emerges with the integrated-platform story (Brain + PushCI + everything = "the AI ops stack for regulated dev orgs").

- **02_AI_AGENTS/llm** folding into Brain means losing the optionality of "FinSavvy Distributed Cluster" as a standalone brand. Risk: someone else builds the home-cluster category. Mitigation: that category is brutal (Ollama at 169K stars). Folding inward is the right call.

- **LunaOS pause** means leaving the agent-orchestration category to LangGraph / CrewAI / Microsoft Agent Framework uncontested for 6 more months. Risk: by M7 the category is locked. Mitigation: LunaOS's positioning was unclear anyway — better to come back with a sharper angle.

- **OpenSyber pause** means the runtime-AI-security category gets fully consolidated (Check Point + Lakera, Lasso growing). Risk: the window closes. Mitigation: pause forces the strategic decision (compete/partner/sell) instead of half-building forever.

**The trade is real, and it's the right one.** A single shipped product with revenue and SOC 2 unlocks more strategic options at M7 than 8 half-built ones do today.

---

## Stall communication script (for design partners + team)

If anyone asks "why aren't we shipping X anymore," say this:

> "We're consolidating around AMLIQ Brain through end of Q4 — shipping a single category-defining product, closing Series A, and proving the compounding-platform thesis with one named customer cohort. Every other product is in maintenance or background, owned but not accelerated. Once Brain GA's and the round closes, we have funded paths back into TenantIQ, PushCI, LunaOS, OpenSyber, SDLC.cc on a roadmap that's defensible because Brain proved the model."

That's the line to use, internally and externally.
