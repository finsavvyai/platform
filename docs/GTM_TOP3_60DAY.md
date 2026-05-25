# GTM Top-3 — Next 60 Days

**Founder decision (2026-05-25):** accept May 2026 ranking memo recommendation.

Tracking doc for the three products getting GTM investment between **2026-05-25** and **2026-07-25**.

## The three

### 1. TenantIQ — Microsoft 365 governance for MSPs

**Why this is #1.** Biggest market signal in the portfolio. AvePoint + Omdia (April 2026): 51% of MSPs name governance as their #1 AI adoption barrier. AvePoint and CoreView are incumbents at enterprise pricing, leaving the MSP segment underserved.

**Position:** "AI remediation plans + OAuth governance + blast-radius simulation for MSPs."

**Path:**
- Pick 5 named target MSPs from existing network
- Build a 5-min "blast-radius for one tenant" demo
- Land first paid pilot by Day 30
- Land first paid PoC → contract conversion by Day 60

**Open items:**
- Sharpen pricing vs CoreView mid-market ($X/seat or per-tenant)
- AMLIQ + TenantIQ — overlap on M365 audit/compliance surface; coordinate
- Per round-2 TenantIQ migration: nested pnpm-workspace.yaml conflict — fix before deploy

### 2. PushCI + PipeWarden OSS — AI code review wedge

**Why this is #2.** AI code review market is $400-600M ARR narrow / $2-3B broad, +30-40% YoY. CodeRabbit owns installs; Greptile owns codebase-graph; Snyk owns security. PushCI's "AI-PR specific" angle is real but needs sharper positioning.

**Position:** "PR-time risk detection specifically for AI-authored code. PipeWarden OSS is the detection engine; PushCI is the hosted DX inside GitHub + Cursor."

**Path:**
- Open-source PipeWarden under `oss/pipewarden/` (MIT) ASAP — Day 7
- Ship PushCI hosted GitHub Marketplace listing by Day 30
- Sharpen positioning vs CodeRabbit: "PRs CodeRabbit misses because the model thinks it knows the API but doesn't"
- 20 paying customers (PushCI hosted) by Day 60

**Open items:**
- PushCI carries BSL 1.1; PipeWarden MIT. Cross-license implications documented round 4 — verify legal review before any code flow between the two
- Land first developer-evangelism content piece (blog: 10 LLM-output failure modes PipeWarden catches)

### 3. QueryFlux — AI-native database workspace

**Why this is #3.** Category is forming (DBHub 100K downloads, Supabase MCP, Bytebase Text-to-SQL). Multi-surface play (web+desktop+mobile+MCP+extensions) is hard to copy. Founder corrections promoted to 8th CORE product (`products/queryflux/`) on 2026-05-25; active shipping (Tasks 11.x SSO+Subs+SecHard merged within last 7 days).

**Position:** "The data layer for AI-coded apps. Every developer using Cursor → PushCI → QueryFlux is the natural funnel."

**Path:**
- Restructure source into `web/`, `desktop/`, `mobile/`, `mcp-server/`, `lens/`, `backend/` per CONSOLIDATION_TODO
- Wire to `@finsavvyai/auth` (replace local SSO) by Day 20
- Wire to `@finsavvyai/billing` (replace local Subscriptions) by Day 30
- MCP server public beta by Day 45
- First 50 paying users (already shipping infrastructure, primarily a positioning + growth play) by Day 60

**Open items:**
- Decide pricing relative to DBHub free tier + Supabase MCP free integration
- VSCode extension marketplace + Chrome Web Store listings
- Developer education: "Cursor + QueryFlux MCP" walkthrough video

## Tier-1 also in flight (not top-3 but actively building)

### AMLIQ
- **Status:** scaffold done (`products/amliq/`), engines relocated (QuantumBeam + ml-fraud + aegis API), decision API design written, consolidation TODO open
- **Q3 launch target** (not in this 60-day window) — needs Go module collision fix + API consolidation + audit-log wiring before GTM

## Defer / sharpen first (NOT in 60-day GTM)

| Product | Reason |
|---|---|
| LunaOS | Crowded market (LangGraph 150K stars, CrewAI 60% F500, Microsoft Agent Framework). Sharpen positioning first. |
| OpenSyber | Competitive window closing (Check Point acquired Lakera April 2026; Lasso owns MCP gateway with Portkey). Decide: own MCP-specific runtime sec, go OSS for grassroots, or merge into a larger player. |
| FinSavvy Cluster | Brutal market (Ollama 169K stars, 2.5B downloads, vLLM owns production). Niche differentiator (AWS-CLI ergonomics + multi-machine home cluster) is plausible but small. Compete-vs-niche decision pending. |
| SDLC.cc | Strong differentiation vs Credo AI / Holistic AI (they target ML models, SDLC.cc targets AI coding tools). Regulated-buyer GTM needs slower, longer sales cycle — not a 60-day win. |

## Tracking

| Product | Day 30 milestone | Day 60 milestone | Status |
|---|---|---|---|
| TenantIQ | First MSP paid pilot | First MSP paid PoC→contract | ☐ |
| PushCI+PipeWarden | PipeWarden MIT OSS + Marketplace listing | 20 PushCI paying customers | ☐ |
| QueryFlux | Auth+billing wired | 50 paying users | ☐ |

## Review cadence

- Weekly: founder reviews this doc; flips ☐ / ✗ / ✓ per milestone
- Day 30: mid-window checkpoint — anything red, escalate
- Day 60: GTM review + decide whether to extend top-3 or rotate
