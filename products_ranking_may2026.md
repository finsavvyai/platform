# Products Ranking — May 2026

Cross-folder assessment of every product across `/Users/shaharsolomon/dev/projects/` (portfolio/, 01-09 categorized folders, finsavvyai-platform monorepo, standalone). Scored on four dimensions, with web-verified market context for each major category.

**Scope discovered:** The user's Feb 2026 portfolio assessment (`project_potential_rank.tsv`, `project_readiness_report.md`, `projects_status_relevant.tsv`) already ranked 82 repos. This report refreshes that for May 2026, layers in market validation, and reconciles against the finsavvyai-platform migration in progress.

**One critical reframing up front.** The Feb assessment, the migration plan, and the addendum all assumed seven core products. Looking at the full folder reveals:

- `02_AI_AGENTS/llm` is the **top-ranked project in the entire portfolio (89/100 potential, 88/100 readiness)** and is NOT in the consolidation plan
- `03_Enterprize_application/products/devx-platform/upm` ranks #3 overall (86/88) and is NOT in the consolidation plan
- `pixel-pets` had a commit two days ago and is being archived
- `notebooklm-py` is third-party (teng-lin), correctly archive-bound for ownership reasons
- The numbered folders (`01_-09_`) contain a more mature version of the same work that's being re-migrated to finsavvyai-platform — there are now two parallel monorepo structures

This ranking is therefore not a tidy 7-product story.

---

## Scoring rubric

| Dim | What | How scored |
|---|---|---|
| **CODE** | Readiness — file count, test coverage, lint cleanliness, file-cap policy compliance, LICENSE present | 0-100, reusing Feb readiness scores updated for May |
| **DEPLOY** | Production status — live endpoints, payment infra, App Store submission, deployment manifests | 0-100; 100 = paying users today |
| **MAY-26 FIT** | Strategic relevance in May 2026 — fits AI-infra thesis, hot vs. cold category | 0-100 |
| **MARKET** | Real category exists, customers are buying, web-verified competitors named | 0-100; backed by web research per category |

---

## Tier 1 — SHIP NOW (high on all four)

These are the products that should be the focus of GTM in the next 60 days. They're built, the category is hot, and the competitive position is defensible.

| # | Product | Path | CODE | DEPLOY | MAY-26 | MARKET | Notes |
|---|---|---|---:|---:|---:|---:|---|
| 1 | **TenantIQ** | `products/tenantiq/` + standalone variant | 75 | 55 | 95 | 95 | **Strongest market validation in the portfolio.** AvePoint/Omdia: 51% of MSPs name governance as the #1 AI adoption barrier. CoreView and AvePoint are incumbents at enterprise pricing. TenantIQ's "AI remediation + OAuth governance + blast-radius simulation for MSPs" lands directly on that buyer pain. |
| 2 | **PushCI + PipeWarden OSS** | `products/pushci/` + `oss/pipewarden/` | 77 | 60 | 90 | 85 | AI code review market is $400-600M ARR narrow / $2-3B broad, growing 30-40% YoY. CodeRabbit dominates installs; Greptile owns codebase-graph differentiation; Snyk owns security. PushCI's "AI-PR specific" angle is real but needs sharper positioning vs. CodeRabbit. PipeWarden OSS as the wedge is correct. |
| 3 | **QueryFlux** *(needs explicit founder decision)* | `portfolio/queryflux-git/` → recommended `products/queryflux/` | 76 | 70 | 88 | 80 | Last commit 2 days ago. Tasks 11.x/13.x (SSO, Subscriptions, Security) merged within the week. Category: DBHub 100K downloads, Supabase MCP integrated, Bytebase Text-to-SQL — category is forming. QueryFlux's multi-surface play (web+desktop+mobile+MCP+extensions) is differentiated. **Currently slated for archive.** |
| 4 | **AMLIQ** *(once QuantumBeam folded in)* | `products/amliq/` | 65 | 50 | 90 | 80 | Market: Sardine + Unit21 are well-funded agentic AML platforms with full feature parity (KYT, sanctions screening, SAR filing). The "World-Check replacement at 1/10 cost" pitch is sound but crowded. AMLIQ's edge: combine fraud detection (QuantumBeam) + ML fraud (Go) + AML investigation in one product. Path: enterprise-first, regulated. |

---

## Tier 2 — STRETCH GOAL (good fit, needs more work)

Products with real potential but readiness gaps, or facing crowded markets where positioning needs sharpening.

| # | Product | Path | CODE | DEPLOY | MAY-26 | MARKET | Notes |
|---|---|---|---:|---:|---:|---:|---|
| 5 | **02_AI_AGENTS/llm** (FinSavvyAI Distributed Cluster) | `02_AI_AGENTS/llm/` | 88 | 60 | 75 | 60 | **Top-ranked in Feb assessment (89/88) but NOT in consolidation plan.** Distributed AI cluster for home computers + AWS-style CLI + intelligent model routing. Last commit 2026-05-13. Market crowded: Ollama 169K stars, 2.5B downloads, vLLM dominates production. Differentiator must be "AWS-CLI familiarity + multi-machine clustering for power users" — niche but plausible. **Decision: include in monorepo or spin out as separate "FinSavvy Cluster" product.** |
| 6 | **UPM (Universal Package Manager)** | `03_Enterprize_application/products/devx-platform/upm/` | 88 | 40 | 80 | 70 | **Ranked #3 overall (86/88) but NOT in consolidation plan.** Clean working tree (only "Add LICENSE" gap). Likely the developer-tooling complement to PushCI. **Decision needed: is this a product, an internal tool, or duplicative of mcp-tooling?** |
| 7 | **LunaOS** | `products/lunaos/` (22K files; lunaforge harvested) | 65 | 40 | 85 | 65 | Market: $50B by 2030 but extremely crowded — LangGraph 150K stars dominates enterprise, CrewAI 60% of Fortune 500, Microsoft Agent Framework absorbed AutoGen + Semantic Kernel. LunaOS needs a sharp differentiator — current materials don't articulate one. Possible angles: visual workflow builder + backend-as-a-service (per `lunaos-studio` README), or vertical-specific orchestration. |
| 8 | **Qestro** | `products/qestro/` (17K files) | 76 | 55 | 85 | 75 | Runtime QA category is younger and less crowded than orchestration. Mabl/Reflect/QA Wolf have human-test heritage; Qestro's "autonomous runtime QA against the surface AI just changed" is a real angle. Needs a named buyer persona and a 5-minute "first detection" demo. |
| 9 | **SDLC.cc** | `products/sdlc-cc/` | 88 (sdlc-platform) | 50 | 80 | 70 | Governance/compliance for AI software delivery. EU AI Act + US executive orders create a forcing function. Competitors (Credo AI, Holistic AI) target ML model governance, not the AI-coding-tool layer SDLC.cc targets. Differentiation exists; needs regulated-buyer GTM. |
| 10 | **OpenSyber** | `products/opensyber/` | 60 | 40 | 80 | 55 | **Category consolidating fast.** Check Point just acquired Lakera ($end-to-end enterprise AI security$). Lasso has MCP-specific gateway, partners with Portkey. OpenSyber's window is closing — needs to either (a) own MCP-specific runtime security (Lasso's lane), (b) go open source for grassroots, or (c) merge into a larger player. |

---

## Tier 3 — OSS / SUPPORTING (high strategic value, low independent revenue)

| # | Product | Path | Notes |
|---|---|---|---|
| 11 | **a2a-framework** | `oss/a2a-framework/` | Standards-aligned (Google A2A protocol). **MIGRATION_NOTES explicitly says "No LICENSE — TODO add MIT/Apache before public release."** Still not added. 5-minute fix unlocks OSS distribution. High inbound-marketing leverage relative to size. |
| 12 | **mcp-tooling** (from mcpoverflow) | `oss/mcp-tooling/` | 810 files. MCP connector platform. Useful both as standalone OSS and as feeder for `platform/ai-gateway`. |
| 13 | **automationhub** | `oss/automationhub/` | 11K files. Workflow primitives — natural base layer for LunaOS. Feb ranking: 82/76. |
| 14 | **clawpipe** (+ server, benchmark) | `oss/clawpipe/` | 11K files. LunaOS runtime support; integrates with the orchestration stack. |
| 15 | **tokenforge** | `oss/tokenforge/` | Telemetry SDK. Pairs with `platform/telemetry`. |
| 16 | **design-system** (F8 UI) | `oss/design-system/` | 240 files. Cross-product UI consistency. |
| 17 | **homebrew-pipewarden** | `oss/homebrew-pipewarden/` | 3 files. Distribution tap. |
| 18 | **javascript-package-manager** (jpm) | `02_AI_AGENTS/mcp-servers/javascript-package-manager/` | Feb 79/64, clean, production-ready. Not in monorepo. **Decision: fold under `oss/mcp-tooling/jpm/`.** |
| 19 | **npmplus-core** | `02_AI_AGENTS/mcp-servers/npmplus-core/` | Feb 79/76, last commit Aug 2025 (stale). MCP server for npm. **Decision: fold under `oss/mcp-tooling/` or archive if jpm supersedes.** |

---

## Tier 4 — EXTERNALIZE (real value, off-thesis)

Do **not** archive these. They have real production value or active development but don't fit the FinsavvyAI thesis.

| # | Product | Path | Why externalize | Recommendation |
|---|---|---|---|---|
| 20 | **looma-sh** | `portfolio/looma-sh/` + standalone `looma_sh_full_fun/` | Live: relay.looma.sh + looma.sh. Investor brief, IP protection in progress, paid pricing tiers. V2V automotive — wrong vertical. | Spin out as sibling entity. Do not delete portfolio/looma-sh/. |
| 21 | **pixel-pets** | `portfolio/pixel-pets/` | **Last commit 2 days ago (2026-05-23)** — phase 2 NFC/genome/safety. Full strategic brief (BRIEF.md, ROADMAP.md, ADRs). AI creature franchise (figures + cards + device + app). | Externalize or explicit deprioritize. Do not silently archive an active project. |
| 22 | **viralsplit** | `05_mobile_apps/viralsplit/` + `06_websites/viralsplit/` + `portfolio/viralsplit/` | Last commit Jan 2026, but earlier work has APP_STORE_SUBMISSION + APPLE_PAY infra. Off-thesis (viral content). | Decide: salvage code/IP, or full sunset. If sunset, snapshot the App Store submission materials before delete. |

---

## Tier 5 — RESCUE/PARK (Feb assessment, still valid)

Repos the Feb `projects_status_relevant.tsv` already classified as "Rescue/Park". Confirmed still in that state.

| Repo | Last commit | Status |
|---|---|---|
| `02_AI_AGENTS/lunaos-repos/lunaos-mobile` | 9999 days ago (no commits) | Park — never started |
| `04_chrome_extensions/extensions/vibepulse` | 2025-09-05 (8.5mo) | Park — 4178 uncommitted changes, off-thesis |
| `05_mobile_apps/scan-genie/scangenie-project` | 2025-09-06 (8.5mo) | Park — stale |
| `06_websites/Immortal-FC` | 2025-05-24 (1y) | Park — football club site, off-thesis |
| `06_websites/finsavvyai-website` | 2025-12-19 (5mo) | Superseded by `websites/finsavvyai.com/` Astro rebuild |
| `06_websites/hava-solomon` | 2025-03-16 (14mo) | **DO NOT RANK** — memorial site for the user's mother. Keep, do not touch. |
| `06_websites/npmplus-website` | 2025-08-21 (9mo) | Park — NPM Plus marketing site |
| `06_websites/websites/code-safety-suite/shield-ai` | 2025-10-24 (7mo) | Park or fold into PipeWarden |
| `06_websites/websites/finsavvyai-website` | 2025-11-07 (6mo) | Park — duplicate |
| `bsl/monitor` | 2021-12-16 (4.5y) | Archive — abandoned monitoring tool |
| `06_websites/devwrapped` | 2025-10-30 (7mo) | Park — GitHub Year-in-Review tool, off-thesis |

---

## Tier 6 — ARCHIVE (confirmed off-thesis or stale)

These are correctly archived. No rescue value identified.

| Repo | Reason |
|---|---|
| `portfolio/hashmal/` | No README signal, no recent commits |
| `portfolio/immortal-fc/` | "first commit" 2025-05-24, never developed |
| `portfolio/moneh-hacham/` | Smart meter project, off-thesis |
| `portfolio/yallabye/` + standalone | Israeli travel app, off-thesis |
| `portfolio/global-remit/` + `09_global_remit/*` | Remittance fintech, off-thesis (and outside AMLIQ scope) |
| `portfolio/subsforge/` | Domain parked (`subsforge.dev`); last commit Oct 2025 was "EMERGENCY cache-busting deployment" — abandoned mid-fire |
| `portfolio/smartreply-ai/` | Domain parked |
| `portfolio/scangenie/` + `05_mobile_apps/scan-genie*` | Last commit Nov 2025, off-thesis |
| `portfolio/codebridge/` | No README, no signal |
| `portfolio/flujo/` | Last commit 14 months stale |
| `portfolio/windsu-credit-manager/` | Architecture overlap incompatible with PushCI |
| `01_vs-code-extensions/focusvault-server/` | Last commit July 2025; activation-code API for unknown product |
| `02_AI_AGENTS/a2a/a2a-server/`, `a2a-cli/`, `a2a-agent-record/` | All last commit April 2025 — superseded by `oss/a2a-framework/` |
| `02_AI_AGENTS/mcp-servers/mcp-servers/` | Last commit Aug 2025, on a feature branch, stale |
| `notebooklm-py` | **Third-party (teng-lin/notebooklm-py on PyPI). Not user's work.** Archive correct on ownership grounds. |
| `08_open_source/*` | **Third-party code per user clarification ("open source is not mine").** Move to `infrastructure/vendored/opensource/`, do not migrate as products. |

---

## What's been archived too soon

Three repos where the archive decision destroys value or contradicts evidence:

### `pixel-pets` — wrongly archived
- **Last commit: 2026-05-23 (2 days before the archive sweep)**
- Phase 0 scaffold + phase 2 work on safety/genome/NFC features
- Full strategic brief (BRIEF.md, ROADMAP.md, GRILL.md), 5 PROPOSED ADRs awaiting sign-off
- In active sprint loop (has CLAUDE.md extending portfolio rules)
- Off-thesis but AI product
- **Action:** Move from `_archive/portfolio-snapshots/pixel-pets/` queue into EXTERNALIZE bucket. Treat like looma-sh: spin out or explicit deprioritize, don't silently delete.

### `looma-sh` — wrongly archived (covered in earlier memos)
- Live production endpoints, investor brief, IP work, paid pricing
- Already flagged in `founder_decisions_memo.md` and `migration_status_check.md`
- The standalone `/Users/shaharsolomon/dev/projects/looma_sh_full_fun/` also exists — likely a fuller export
- **Action:** Externalize, not archive. Stop the delete sweep before it hits `portfolio/looma-sh/`.

### `02_AI_AGENTS/llm` — never even considered
- Highest-ranked project in entire portfolio (89/88 in Feb)
- Last commit 2026-05-13 (12 days ago)
- "FinSavvyAI Distributed AI Cluster" — uses your brand name in product
- Not in the consolidation plan, not in archive, not in monorepo
- **Action:** Founder decision needed — promote to `products/finsavvy-cluster/` (8th or 9th core product), externalize as separate brand, or explicit decision to deprioritize. Don't leave it orphaned.

---

## Categories assessed via web research

| Category | Market size / health | Key competitors | Verdict |
|---|---|---|---|
| AI code review (PushCI/PipeWarden) | $400-600M ARR narrow, $2-3B broad; +30-40% YoY | CodeRabbit (most installed), Greptile (codebase graph), Snyk (security-first), Sourcery, Qodo | **Real market, room for differentiated entrant.** |
| AI agent orchestration (LunaOS) | $5.4B (2024) → $50B by 2030 | LangGraph (150K stars, enterprise), CrewAI (60% F500), Microsoft Agent Framework (AutoGen+Semantic Kernel merged) | **Hot market but extremely crowded.** Position carefully. |
| AI runtime security (OpenSyber) | Crystallizing fast | **Check Point acquired Lakera** (Apr 2026), Lasso (MCP gateway, Portkey partner) | **Window closing.** Incumbents are buying the category. |
| AI AML/fraud (AMLIQ) | Multi-billion compliance market | Sardine (agentic risk), Unit21 (full AML stack), LSEG World-Check (legacy) | **Real market.** "Replace World-Check at 1/10 cost" is correct framing. |
| AI database workspace (QueryFlux) | Forming | DBHub (100K downloads), Supabase MCP, Bytebase Text-to-SQL, Oracle SQLcl MCP | **Category exists, room to define.** |
| M365 governance for MSPs (TenantIQ) | 51% of MSPs say it's #1 AI barrier (AvePoint/Omdia April 2026) | AvePoint Elements (enterprise), CoreView (mid-market), ScalePad | **Strongest market validation in the portfolio.** |
| Local LLM cluster (02_AI_AGENTS/llm) | Mature/crowded | Ollama (169K stars, 2.5B downloads), vLLM (production king), Bento (managed), llama.cpp, MLX | **Brutal market.** Niche differentiator (multi-machine home cluster + AWS-CLI) is plausible but small. |

---

## Recommended top-3 focus for the next 60 days

If I had to pick three products to invest GTM energy in, ranked purely on (market validation × readiness × competitive window):

1. **TenantIQ** — biggest market signal, weakest entrenched competition at MSP price point, regulatory tailwind. Move on this first.
2. **PushCI + PipeWarden** — OSS wedge thesis is sound, market is paying, CodeRabbit's install dominance can be challenged with a sharper "AI-PR specific" pitch.
3. **QueryFlux** *(contingent on the 8th-product decision)* — category forming, multi-surface play is hard to copy, last-2-day commit velocity proves the team is shipping.

Tier 1 also includes AMLIQ but it requires the QuantumBeam fold-in to be complete before GTM; treat as Q3 launch.

**Defer or sharpen first:** LunaOS (positioning), OpenSyber (competitive window), 02_AI_AGENTS/llm (decision on whether to compete here at all).

**Fix immediately (5-minute items):** a2a-framework LICENSE; pixel-pets/looma-sh archive halt; 02_AI_AGENTS/llm bucket assignment.

---

## Sources

- [Best AI for Code Review 2026 — Verdent Guides](https://www.verdent.ai/guides/best-ai-for-code-review-2026)
- [The State of AI Code Review in 2026 — DEV Community](https://dev.to/rahulxsingh/the-state-of-ai-code-review-in-2026-trends-tools-and-whats-next-2gfh)
- [8 Best AI Code Review Tools That Catch Real Bugs in 2026 — Qodo](https://www.qodo.ai/blog/best-ai-code-review-tools-2026/)
- [Best Multi-Agent Frameworks in 2026 — gurusup](https://gurusup.com/blog/best-multi-agent-frameworks-2026)
- [AI Agents in 2026: LangGraph vs CrewAI vs Smolagents — DEV Community](https://dev.to/pooyagolchian/ai-agents-in-2026-langgraph-vs-crewai-vs-smolagents-with-real-benchmarks-on-local-llms-4ma1)
- [Top 5 Agentic AI Frameworks to Watch in 2026 — Future AGI](https://futureagi.substack.com/p/top-5-agentic-ai-frameworks-to-watch)
- [Best AI Security Platforms in 2026 — General Analysis](https://generalanalysis.com/guides/best-ai-security-platforms)
- [Lakera AI Agent Security](https://www.lakera.ai/lakera-guard)
- [Check Point Acquires Lakera (press release)](https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises/)
- [Best MCP Security Tools in 2026 — TrueFoundry](https://www.truefoundry.com/blog/best-mcp-security-tools)
- [Lasso Security MCP Gateway via Portkey](https://portkey.ai/blog/securing-mcp-to-deliver-enterprise-grade-agentic-ai-protection/)
- [Unit21 Agentic AI AML Platform](https://www.unit21.ai/products/aml-transaction-monitoring)
- [Sardine Agentic Financial Crime Platform](https://www.sardine.ai/)
- [Top 5 Text-to-SQL Query Tools in 2026 — Bytebase](https://www.bytebase.com/blog/top-text-to-sql-query-tools/)
- [Supabase MCP Server: AI Integration Guide (2026)](https://designrevision.com/blog/supabase-mcp-server)
- [CoreView 2026 Microsoft 365 Predictions](https://www.coreview.com/blog/four-key-predictions-on-microsoft-365-for-2026)
- [AvePoint + Omdia: Governance is #1 MSP AI Adoption Barrier (April 2026)](https://www.globenewswire.com/news-release/2026/04/09/3271007/0/en/Research-From-AvePoint-and-Omdia-Reveals-Governance-and-Compliance-as-the-Leading-AI-Adoption-Barrier-Among-MSPs.html)
- [Agentic AI Forces MSPs to Own Governance — Business of Tech (April 2026)](https://businessof.tech/2026/04/17/agentic-ai-forces-msps-to-own-governance-infrastructure-costs-and-execution-risk/)
- [Local LLM Deployment 2026: Ollama vs vLLM — QubitTool](https://qubittool.com/blog/local-llm-deployment-2026-ollama-vllm-optimization)
- [Awesome Local LLM 2026 — BrightCoding](https://www.blog.brightcoding.dev/2026/04/29/awesome-local-llm-the-revolutionary-local-ai-toolkit)
