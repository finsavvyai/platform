# FinsavvyAI Portfolio — Product Vision & Descriptions

Last updated: 2026-06-09 (May-2026 market-scan deltas applied — pricing, stack-map, cross-cutting bets; see `MARKET_SCAN_2026-05.md`)
Audience: founder research, market validation, GTM positioning, investor briefs.

## Portfolio thesis

**FinsavvyAI is the control plane for AI-generated software.** Developers ship with Cursor, Claude Code, Copilot, and agents; FinsavvyAI makes that software safe to test, deploy, operate, audit, and govern. Each product picks one workflow that humans currently navigate across four tabs, collapses it into an autonomous loop, and ships a signed, auditable trail.

Master category: **AI Software Control Plane** (not "portfolio", not "AI-native operational tooling").

The portfolio is a **stack**, not a federation. Each product solves one layer; together they form the SDLC + Runtime + Compliance surface for AI-generated software.

> **Cost claims**: the "~1/10 incumbent" line is retired from public copy until a benchmark ships. Incumbent prices (World-Check, NICE, LexisNexis, Palo Alto, Cisco) are quote-only — no public anchor to divide by. Use "priced for mid-market", "usage-based alternative", "reduce investigation time" instead.

## Positioning (2026 scan deltas applied)

**Flagship: OpenSyber.** Best 2026 timing — agent security + MCP + prompt injection + tool-call abuse + runtime enforcement + audit. Validated by M&A (Palo Alto → Protect AI → Prisma AIRS) and a coined category (Dell'Oro AISS, ~$0 → ~$8B by 2030).

**Ship as one public story first: OpenSyber + SDLC.cc + PushCI.**
Tagline: **"Secure the AI software factory — from generated code to agent runtime."**

**Three bundles** (reduce public surface 11 → 3):

| Bundle | Products | Promise |
|---|---|---|
| **AI DevOps Kit** | PushCI + Qestro + QueryFlux + ClawPipe | "Ship AI-generated code safely." |
| **AI Security Kit** | OpenSyber + SDLC.cc + SDLC.ai | "Secure agents, prompts, tools, sensitive data." |
| **Regulated AI Kit** | AMLIQ + TenantIQ + SDLC.ai | "Evidence-grade AI workflows for regulated companies." |

**Product ranking** (2026 GTM priority, from scan):

| Rank | Product | Why |
|---|---|---|
| 1 | OpenSyber | Best 2026 timing: MCP + agent security + runtime enforcement + audit |
| 2 | SDLC.cc | Strong compliance pull: AI DLP across ChatGPT/Claude/Copilot/Office + evidence |
| 3 | PushCI | Best dev wedge + easiest distribution |
| 4 | Qestro | Strong IF positioned for AI-generated code (not generic QA) |
| 5 | ClawPipe | Good but crowded; must lead with deflection benchmarks |
| 6 | QueryFlux | Strong technical idea; must avoid Supabase-clone framing |
| 7 | TenantIQ | Good MSP niche; Microsoft competition risk |
| 8 | AMLIQ | Large market but trust/procurement/data moat hard. Start as overlay |
| 9 | SDLC.ai | Too broad standalone; use as enterprise bundle name |
| 10 | LunaOS | Keep internal runtime; external GTM later |
| 11 | FinSavvy Cluster | Crowded + lower urgency. Defer unless sharp niche found |

## Stack map

| Layer | Product | One-liner |
|---|---|---|
| Code adoption | **PushCI** | AI-native CI/CD wedge. Zero config. |
| Data tier | **QueryFlux** | Safe DB surface for AI agents. |
| Runtime QA | **Qestro** | Test copilot for AI vibe coding. |
| Orchestration | **LunaOS** | Agent runtime substrate. |
| Local inference | **FinSavvy Cluster** | Distributed home-cluster LLMs. |
| AI pipeline | **ClawPipe** | Booster → Pack → Cache → Route → Gateway. |
| Runtime security | **OpenSyber** | WAF equivalent for MCP/AI agents. |
| Governance | **SDLC.cc** | Privacy layer. PII scrub across AI surfaces. |
| Enterprise AI | **SDLC.ai** | Zero-trust AI/ML platform (GDPR/HIPAA/PCI). |
| AML | **AMLIQ** | FP triage + investigation evidence overlay on existing screening. |
| M365 | **TenantIQ** | AI governance + remediation for Microsoft 365. |

Adoption funnel: `Cursor → PushCI → QueryFlux → Qestro → OpenSyber → SDLC.cc`. AMLIQ + TenantIQ + SDLC.ai are enterprise verticals consuming the same shared platform.

---

## 1. AMLIQ — AI-native AML investigations

**2026 wedge**: false-positive triage + investigation evidence overlay on existing screening. NOT "replace World-Check" first — land as an overlay, expand to secondary-screening API. Human-in-loop with explainable, validated models (per Wolfsberg AI/ML Principles + SR 11-7 / SR 26-02); regulators set explainability + validation + human-oversight expectations, they do not "approve" autonomous AI decisions.

**Investigation fabric** (per `RESEARCH_AI_GOV_2026-06.md`): agentic AML — (1) automated evidence collection + case prep (KYC/CDD pull, prior screening, counter-party review, preliminary summary before the file opens); (2) graph-based transaction/network analysis (structuring detection, high-risk-jurisdiction flags, network viz); (3) SAR/STR drafting (already scaffolded — `sar-draft-handler.ts`); (4) cross-border corridor-risk + multi-jurisdiction watchlist ingestion (FATF-informed). Every agent action logged, human-in-loop. Verified (deep-research 2026-06-06): SymphonyAI "−60% case time" = **vendor-reported pilot** (attribute as such, not a benchmark); "17→5min L2" = weakly sourced, **keep out of public copy**.

**Mission**: reduce AML investigation cost and false positives without sacrificing auditability — overlay on World-Check / LexisNexis / Refinitiv screening, then displace.

**Problem**: Legacy AML stacks push analysts through fragmented sanctions lists, manual case files, per-record fees ($100K-$500K/seat/year). Workflow is the textbook "humans copy-pasting between four tabs" automation target.

**Solution**: Autonomous AML agent on top of two production fraud-scoring engines (QuantumBeam quantum-enhanced + ML-Fraud classical), exposed as one decision API + one analyst console. Every decision emits a signed, PII-free audit record.

**Surface**: `POST /v1/aml/decision`, `POST /v1/aml/investigate`, `GET /v1/aml/cases/{id}`, `GET /v1/aml/audit/{id}`, plus React analyst console.

**Target user**: AML analysts in regulated FIs, fintechs, crypto exchanges, gaming operators.

**Differentiator**: explainable decisions, per-API pricing (not per-seat), <50ms screening latency target, SOC 2 evidence built into the audit shape. Pricing anchor: ComplyAdvantage self-service Starter from $99/mo (100 monitored entities) — beatable with transparent usage tiers.

**Suggested pricing**: Free 1,000 screens/mo · Pro $99-$299 · Team $999 · Enterprise custom + data-retention.

**Stack**: Go (api + engines), React + Vite (console), pgvector embeddings, Cloudflare audit sink.

**Status**: in migration. `/api/v1/screen/public-demo` shipped (28/28 fixture queries pass; Embedding + Cyrillic/Arabic normalizers wired). Full decision API design complete; integration pending.

**Standalone**: `github.com/finsavvyai/amliq` (active, BEACON perf baseline).

**Research prompts**:
- TAM of mid-market FIs paying $100K-$1M/yr to World-Check
- Switching cost / contract length
- Regulator acceptance of AI-generated decisions w/ audit trail
- Pricing anchor: per-decision vs per-seat
- SOC 2 evidence retention competitive landscape

---

## 2. OpenSyber — Runtime AI security ⭐ FLAGSHIP

**2026 wedge**: **OpenSyber MCP Firewall** — approve, block, replay, and audit every agent tool call. Position as "runtime policy boundary for MCP and autonomous agents" (drop "AI cyber SaaS" framing). The WAF + IAM + audit layer for AI agents and MCP tool calls.

**Runtime identity governance** (per `RESEARCH_AI_GOV_2026-06.md`): the identity layer is the enforcement chokepoint — every agent action starts with authn/authz. Defend the four agent risks static IAM can't: **privilege drift**, **shadow agents**, **MCP bypass**, **broken delegation chains**. Governance runs at runtime (agents make thousands of access decisions/min), not periodic audit. Align policy engine to **FIDO** pillars: agent authentication, verifiable user instructions, trusted delegation. Regulatory coverage to advertise: EU AI Act, NIST AI RMF, ISO 42001.

**Mission**: WAF equivalent for MCP servers and AI agents in production.

**Problem**: Existing security perimeter (WAFs, RASP, SAST) was built for HTTP + human-authored code. Autonomous agents calling tools at machine speed bypass it entirely. Prompt injection + tool call abuse + sandbox escape have no existing enforcement plane.

**Solution**: Request-path inspection between agent runtime and the world. Signed tool registry + per-call policy + sandbox profiles + prompt-injection classifiers + lateral movement detection. Default deny.

**Differentiator**: detection latency p99 <50ms hot path. Fail-closed audit (failed emit blocks action). Tool calls cryptographically signed. Skill marketplace (70/30 split) + TokenForge device-bound sessions (W3C DBSC).

**Target user**: platform security engineers shipping autonomous agents to production; security architects designing AI agent posture from zero.

**Stack**: Hono on Cloudflare Workers, Next.js 16 dashboard, Drizzle ORM + D1 (~173 tables), Auth.js v5, Hetzner VM agent runtime with osquery + seccomp.

**Pricing tiers**: OSS local firewall · Pro cloud audit $19-$49/dev/mo · Team policy mgmt $199/mo · Enterprise SSO/SIEM.

**Status**: standalone leads with active commits (compete-plan routes, R2 binding, swarm-shipped skills).

**Standalone**: `github.com/finsavvyai/opensyber`.

**Research prompts**:
- Cisco Duo Passport / Okta / Entra workforce competition pricing
- MCP-server-in-production adoption curve (2026 vs 2027)
- Prompt-injection incidents disclosed publicly (anchor severity)
- Enterprise willingness to pay for runtime AI agent security vs DIY

---

## 3. TenantIQ — Microsoft 365 governance

**2026 wedge**: multi-tenant AI governance console for MSPs — OAuth grant inventory + Copilot readiness + risky app consent drift + remediation simulation + MSP monthly posture report.

**Mission**: AI governance, remediation, blast-radius simulation for M365 tenants.

**Problem**: MSPs manage 9-250+ M365 tenants concurrently with no unified posture view. OAuth grants are blind spots. AI agents granted Graph scopes create compliance exposure.

**Solution**: One API + desktop console + mobile shell. Every Graph access flows through `packages/graph/`. All consent state mirrored locally with signed snapshot. Read-only by default; write scopes per-action with audit + rollback.

**Differentiator**: MSP-first (multi-tenant operator UX), blast-radius simulation before remediation applies, 33-table account-deletion cascade contract, signed consent snapshots detect drift vs Microsoft's view.

**Suggested pricing**: MSP starter $49/mo (10 tenants) · Growth $199/mo (50 tenants) · Scale $499+ · per-tenant remediation add-on.

**Target user**: MSP operators (9-250+ tenants); security/compliance leads in single-tenant enterprises needing defensible posture evidence.

**Stack**: Cloudflare Workers + Hono (api), SvelteKit 5 (desktop console), Capacitor 8 + SvelteKit (mobile), Drizzle ORM + D1, JWT (jose HS256/RS256).

**Status**: standalone leads (saml-auditor fix, RAG ingest, agent runtime production-wired).

**Standalone**: `github.com/finsavvyai/tenantiq`.

**Research prompts**:
- MSP TAM, average revenue per tenant managed
- OAuth grant compliance fines (EU AI Act, NIST, ISO 27001)
- Per-tenant pricing anchors (CrowdStrike, SentinelOne for M365 add-ons)
- Cross-sell to AMLIQ (regulated FIs already on M365)

---

## 4. Qestro — Testing copilot for AI vibe coding

**2026 wedge**: "Qestro tests what AI coding agents changed" — testing copilot for AI-generated code before it reaches production. Part of the Cursor / Copilot / Claude Code workflow, not generic QA. (Incumbent mabl is quote-only/sales-led — transparent pricing is itself a wedge.)

**Mission**: Write tests once, run everywhere. Self-healing tests for AI-generated code.

**Problem**: Devs ship fast with Cursor/Copilot/vibe coding. Tests don't keep up. Flaky tests + maintenance hell + no cross-target coverage (browser/mobile/API separately).

**Solution**: Paste URL or API endpoint, describe in plain English. AI generates Playwright/Maestro test code with smart assertions. Self-healing engine fixes selectors when UI changes.

**Differentiator**: One platform → three targets (browser, mobile, API). Self-healing means tests don't break on UI change. AI-native generation removes boilerplate. Sits at the runtime gate post-PushCI merge.

**Suggested pricing**: Free local · Pro $19/dev/mo · Team $99-$299 · usage add-on for hosted browsers.

**Target user**: tech leads at 20-200 dev orgs with active LLM-assisted commits hitting main daily.

**Stack**: Vite + React 19 (frontend), Cloudflare Workers + Hono + Drizzle + D1 (backend), Playwright + Maestro (runners), MCP server for protocol adapter, multi-provider LLM (Claude, GPT-4).

**Status**: early access. WCAG 2.1 AA pass + offline badge + a11y scan tooling shipped (standalone). Real Playwright runner + API runner + self-healing engine + CI/CD integration live.

**Standalone**: `github.com/finsavvyai/questro` (note: typo, repo is "questro" not "qestro").

**Research prompts**:
- Playwright + Cypress + BrowserStack pricing tiers
- "self-healing test" anchor vendors (Mabl, Functionize, testRigor)
- AI-coding test coverage drop metrics (industry benchmarks)
- Per-test-run vs per-seat pricing

---

## 5. PushCI — AI-native CI/CD wedge

**2026 wedge**: zero-config **CI/CD guardrail for AI-generated PRs** (not "cheaper GitHub Actions"). Anchored by 2026 research: 61,837 GitHub Actions runs from AI-bot PRs show negative correlation between AI-agent contribution frequency and workflow success.

**Mission**: Make CI/CD invisible. Push code. Everything happens.

**Problem**: GitHub Actions = 50+ lines of YAML to run `go test`. $200-$2000/mo for moderate teams. Platform lock-in (config doesn't port between GitHub/GitLab/Bitbucket). Junior devs excluded. Reliability declining (major 2025 outages).

**Solution**: Single Go binary. `npx pushci init` → AI scans repo (`go.mod`, `package.json`, `Cargo.toml`) → detects stack, framework, build tool → generates pipeline → installs git hooks. `git push` runs tests locally (free), webhook notifies API, status posts on PR.

**Differentiator**: Zero config (only auto-detect-and-just-work). Free compute (runs on dev machine, not cloud). Multi-platform (one tool for GitHub + GitLab + Bitbucket + Gitea). AI-native (error explanation, auto-fix, smart caching). 95% margins (no compute costs).

**Suggested pricing**: Free local CLI · Pro dashboard $9/mo · Team $29/seat · Enterprise policy/fleet/SSO.

**Target user**: solo devs and small teams adopting AI coding agents. Entry-point to the FinsavvyAI portfolio (upgrade path: Qestro → OpenSyber → SDLC.cc).

**Stack**: Go binary CLI (signed via cosign), Cloudflare Worker API, React dashboard, Tailscale mesh for distributed jobs, Expo/React Native mobile control surface.

**Status**: standalone leads (week 1 discovery undo per Q3 plan, M1+M2 marketing hero, D1 dashboard).

**Standalone**: `github.com/finsavvyai/pushci`.

**Research prompts**:
- GitHub Actions / CircleCI / Buildkite pricing models
- Solo dev + small team CI/CD spend
- AI sandbox CI parity (Claude Code, Cursor, Windsurf agent CI usage)
- Open-source distribution → SaaS upgrade conversion benchmarks

---

## 6. QueryFlux — AI-native database workspace

**2026 wedge**: **database access broker for AI agents** — not "another DB". Avoid Supabase-clone framing. (Neon anchor: usage-based, $0.106-$0.222/CU-hour, $0.35/GB-mo, $5/mo minimum — price as a broker layer, not storage.)

**Mission**: Safe, observable, governed data surface for AI-authored applications.

**Problem**: AI agents need DB access to ship apps. Raw credentials are catastrophic. No policy gate, no audit, no tenant isolation between agents talking to the same data.

**Solution**: All agent queries pass through a policy gate (allow/deny by table, column, row predicate). All emit audit events. No agent gets raw DB credentials; auth via connection broker. Multi-tenant by default.

**Differentiator**: Per-agent rate limits, scoped API keys, default-deny on schema introspection. p95 query proxy overhead <50ms. Editor + AI extensions (VSCode, OpenAI app, Gemini functions, MCP server). Tauri desktop.

**Suggested pricing**: Free local proxy · Pro $29/mo · Team $199/mo · Enterprise private deployment.

**Target user**: devs shipping production apps where AI agents need DB read/write; data engineers granting agents query access without raw credentials.

**Stack**: Vite + React 19 (web), Next.js 15 (website), Tauri (desktop), React Native (mobile), MCP server (stdio), Cloudflare Workers + D1, Go monolith backend, QueryLens (lens/core sqlite + lens/api-java Spring Boot NLP-to-SQL + lens/vectorize-worker CF + Vectorize).

**Status**: actively shipping (SSO, subscriptions, security hardening tasks 11.x + 13.x merged within last week). Tree restructure complete (32 → 14 dirs).

**Standalone**: monorepo-only.

**Research prompts**:
- PlanetScale, Neon, Supabase pricing + agent-access positioning
- AI-agent DB credential leakage incidents
- MCP server adoption for DB access (Cursor / Claude Desktop / Cline)
- "Data layer for AI apps" anchor — does category exist yet

---

## 7. SDLC.ai — Enterprise zero-trust AI/ML platform

**2026 wedge**: evidence layer mapping AI activity to NIST AI RMF / ISO 42001 / EU AI Act / SOC 2 / PCI / HIPAA / GDPR. Too broad as a standalone — use primarily as the **enterprise bundle name** (anchors AI Security Kit + Regulated AI Kit).

**Mission**: Production SaaS for regulated enterprises (finance, healthcare, government). 99.9% SLA, SOC 2 / HIPAA / GDPR / PCI-DSS / FINRA compliant. Multi-tenant data isolation.

**Solution**: Edge-deployed AI/ML platform with Go API gateway, Python RAG service, Rust vector core, Next.js admin UI, DLP service, LLM gateway, OPA-based policy engine.

**Differentiator**: zero-trust by design (every query authorized + audited), regulated-industry compliance baked in, edge deployment (Cloudflare Workers + D1 + R2 + KV).

**Target user**: regulated enterprises (FS, healthcare, gov).

**Stack**: Go (gateway, compliance), Python (RAG, DLP), Rust (vector-core, retrieval-rs), Next.js + Tailwind (admin UI), PostgreSQL + pgvector, Redis, OPA, Presidio, Prometheus + Grafana + OpenTelemetry, Cloudflare Workers + Docker + Terraform.

**Status**: monorepo-only (relocated from `queryflux/sdlc-ai` to `products/sdlc-ai` 2026-05-29).

**Domain**: sdlc.ai.

**Research prompts**:
- Regulated-enterprise AI procurement (RFP cycles, compliance evidence asks)
- SOC 2 / HIPAA / GDPR audit cost anchor
- AWS/Azure ML competitive lift (Bedrock, Azure OpenAI Service)
- Pricing: per-tenant + per-query + compliance-tier

---

## 8. SDLC.cc — Privacy layer for AI workflows

**2026 wedge**: **evidence-grade AI DLP** for ChatGPT / Claude / Copilot / Gemini / Perplexity / MCP agents / Office workflows — AI prompt + file scrubber with signed evidence. Not just "PII scrub". Direct incumbent: Microsoft Purview DSPM for AI (GA) — compete on breadth + signed deterministic exports, not licensing lock-in.

**Mission**: One gateway, 8 surfaces, shared backend. Scrub PII / credentials / IDs before any prompt reaches Claude, ChatGPT, Gemini, Copilot, Perplexity.

**Problem**: Enterprises use AI but can't pipe PII into vendor APIs without compliance exposure. EU AI Act, US executive orders, Israeli AI directives all require an evidentiary chain.

**Solution**: One backend (`api.sdlc.cc/v1/dlp/scrub`), N front-doors (web scrub.sdlc.cc, Chrome/Edge/Firefox extensions, Outlook/Excel/Word/PowerPoint/Teams add-ins, Cloudflare AI Gateway plugin). Every surface POSTs to one endpoint with one bearer key.

**Differentiator**: append-only audit (Postgres no UPDATE/DELETE grants), Ed25519 evidence signing, deterministic exports (byte-identical re-runs for chain-of-custody), 8 deployment surfaces (no single integration point).

**Suggested pricing**: Free web scrubber · Pro browser ext $9/user · Team admin $99-$299 · Enterprise Office add-ins + SIEM.

**Target user**: CTO/CISO/CCO at regulated enterprises (FS, healthcare, public sector, defense supply chain); DevSecOps leads answering auditor questions about AI-generated code.

**Stack**: Cloudflare Workers gateway, Go MaskAML chain (`sdlc-core` private lib shared with AMLIQ + TenantIQ), Prometheus metrics, audit log (tenant_id + counts only; raw text NEVER stored).

**Status**: live deployments (`sdlc-cc-landing.pages.dev`, `scrub.sdlc.cc`, `api.sdlc.cc`). Co-located with sdlc-core + sdlc-platform legacy repos — unification backlog open.

**Research prompts**:
- EU AI Act DLP requirements + enforcement timeline
- Office 365 add-in distribution (Microsoft Partner Center economics)
- "Privacy proxy" anchors: Skyflow, Piiano, Nightfall
- Per-scrub vs per-seat pricing

---

## 9. FinSavvy Cluster — Distributed local LLM inference

**2026 wedge**: defer unless a sharp niche lands. Crowded (Ollama/vLLM/llama.cpp free; Red Hat AI Inference Server priced per-GPU) + lower urgency. If pursued, lead with concrete "first multi-node inference in 5 min" demo, not feature parity.

**Mission**: Power users running LLMs locally for privacy, latency, or cost.

**Problem**: Crowded market (Ollama, vLLM, llama.cpp, MLX). All single-node. None ops-friendly.

**Solution**: AWS-CLI ergonomics (`finsavvyai` CLI) + multi-machine home cluster (distribute inference across N home boxes) + intelligent model routing (smallest capable model per prompt). Menubar app, desktop app, iOS app, Cloudflare control plane.

**Differentiator**: AWS-style ops (SRE persona, not ML researchers), multi-node home pooling (not single-node, not cloud-managed), model routing as policy DSL.

**Target user**: ops/SRE engineers running LLMs locally; small teams with multiple workstations pooling inference capacity.

**Stack**: not yet in canonical pnpm workspace. CLI + menubar + desktop + iOS + Cloudflare Worker control plane.

**Status**: 9th CORE product (promoted post-May-2026 ranking). Promotion is structural; actual GTM is "defer or sharpen first" per ranking memo. LunaOS direct-integration planned.

**Standalone**: monorepo-only.

**Research prompts**:
- Ollama / vLLM / llama.cpp adoption curve, monetization
- Home-cluster ops persona size (r/LocalLLaMA, /selfhosted, /homelab)
- iOS local-inference market (Apple Intelligence cannibalization risk)
- AWS-CLI ergonomics as differentiator — measurable?

---

## 10. LunaOS — AI orchestration runtime

**2026 wedge**: keep internal. Runtime substrate for the other products; external GTM later (landscape: Temporal, Inngest, Trigger.dev, LangGraph, Autogen). No public positioning push in this cycle.

**Mission**: Substrate that other FinsavvyAI products (Qestro, OpenSyber, SDLC.cc) and customer agents execute on. Runtime + routing + dashboards + engines + IDE bridges + mobile shell + vault + docs.

**Architecture**: `lunaos-engine` runtime core (surface-stable, depends on nothing in-product), `luna-agents` agent definition layer (evolves fast), `lunaos-dashboard` + `lunaos-studio` UIs (must go through engine API), `lunaos-vscode` + `lunaos-intellij` IDE bridges, `lunaos-mobile` shell, `luna-vault` local-first secrets, `lunaos-docs`.

**Target user**: (a) internal product teams building FinsavvyAI products needing agent runtime; (b) external dev teams self-hosting or consuming as service.

**Standalone**: monorepo-only (no separate GitHub repo).

**Notable**: `OpenHands` and `antigravity-awesome-skills` vendored upstream (read-only, upgrade by re-vendor). `lunaforge` is the predecessor, harvested via documented elevation pattern.

**Status**: large surface area. Internal-first; external GTM TBD.

**Research prompts**:
- Agent runtime landscape (Inngest, Trigger.dev, Temporal, LangGraph, Autogen)
- Self-hosted vs managed agent infra preference (security vs ops)
- IDE-bridge UX anchors (Cursor, Continue, Cody)

---

## 11. ClawPipe — Intelligent AI pipeline

**2026 wedge**: **deflection-first** — "Don't call the model when you don't need to." Lead with benchmarked cost reduction by task type (math, JSON, dates, classification, summarization, RAG, support, agent loops), NOT routing. Crowded gateway market (LiteLLM, Helicone, Portkey, Cloudflare AI Gateway, Bifrost, Kong) — do not compete as "another gateway."

**Mission**: Booster, semantic cache, self-learning router across 21 providers. Cuts LLM cost without changing app logic.

**Pipeline**: Request → Booster → Packer → Cache → Router → Provider Call → Learn.
- **Booster** (246 deterministic rules) — resolves prompts without AI (math, JSON, dates, conversions, UUIDs)
- **RAG** — retrieves documents, prepends as context
- **Packer** — compresses context (20-60% token reduction)
- **Semantic Cache** — hash + embedding dedup
- **Router** — self-learning model selection (cost, quality, latency)
- **Swarm** — fan out to N models (vote/best/first/merge)
- **Gateway** — 21 providers (Anthropic, OpenAI, DeepSeek, Bedrock, Cerebras, Cohere, Databricks, Fireworks, Gemini, Groq, HuggingFace, Mistral, OpenRouter, Perplexity, Replicate, Together, Vertex, Writer, xAI, AI21, Azure OpenAI)
- **Learner** — tracks outcomes, refines routing weights (persisted to D1)

**Differentiator**: only product combining booster + packer + cache + router + gateway + swarm + 15-plugin Guard Registry + DLP pack + M365 intent classifier in a single SDK.

**Target user**: devs/teams cutting LLM costs without changing app logic.

**Stack**: TypeScript SDK (`clawpipe-ai` on npm, v3.6.1, 167 files, 94.7 kB), Cloudflare Workers + Hono + D1 + KV gateway, Cloudflare Pages landing.

**Pricing**:

| Tier | Price | Calls/day |
|---|---|---|
| Free | $0 | 1,000 |
| Indie | $19/mo | 10,000 |
| Dev | $79/mo | 15,000 |
| Growth | $299/mo | 150,000 |
| Scale | $799/mo | 1,500,000 |
| Enterprise | Custom | Unlimited |

**Status**: live (`api.clawpipe.ai`, landing on Pages, 647 tests across 136 files, rate-limited 1.5K concurrent). Public measured benchmark in progress at `github.com/finsavvyai/clawpipe-booster-benchmark` (methodology v1.0 locked; per-bucket numbers pending).

**Standalone**: `github.com/finsavvyai/clawpipe`. OSS.

**Research prompts**:
- LLM gateway competition (Portkey, Helicone, LiteLLM, Cloudflare AI Gateway)
- Booster (deterministic prompt skip) — measurable cost reduction by task type
- Per-call vs per-token pricing
- Open-source distribution → paid tier conversion

---

## 12. Beacon — Agent-payments trust layer (PROPOSED, unconfirmed)

**Status**: NOT yet a confirmed product. Surfaced by `RESEARCH_AI_GOV_2026-06.md`. **Open: standalone 12th product vs AMLIQ module vs naming collision with the existing AMLIQ "BEACON perf baseline".** Resolve before adding to the stack map / ranking.

**Proposed mission**: cryptographic trust layer for agent-initiated payments — the "Verifiable Intent" equivalent for the FinsavvyAI stack.

**2026 wedge**: as autonomous agents transact, intent becomes invisible — trust must be explicit + verifiable. Beacon issues **verifiable-intent tokens** (tamper-resistant record linking identity ↔ intent ↔ action), authenticates agents, and models delegated authority. **AP2-compatible** (Google Agent Payments Protocol) and aligned to **FIDO** + Mastercard Verifiable Intent rather than a bespoke scheme.

**AMLIQ tie-in**: AMLIQ ingests + verifies Beacon intent tokens during investigations — agent-initiated transactions carry cryptographic proof of authorization into the audit trail.

**Differentiator (if pursued)**: open-standard alignment (FIDO/AP2/EMVCo/IETF) = interoperable + future-proof; native bridge to AML investigation evidence (no other trust layer feeds a screening fabric).

**Caveat**: FIDO agentic-payments WGs + AP2 + Verifiable Intent are recent consortium efforts — confirm spec maturity + reference-implementation availability before committing build effort.

**Bundle fit**: Regulated AI Kit (with AMLIQ + TenantIQ) and/or AI Security Kit.

---

## Shared infrastructure (not products)

These are platform layers consumed by all products via `packages/*`:

| Package | Role |
|---|---|
| `@finsavvyai/auth` | JWT verify, role gates, hardened in round 1 |
| `@finsavvyai/billing` | LemonSqueezy wrappers (Free/Pro/Team/Enterprise tiers) |
| `@finsavvyai/telemetry` | OTel + audit emit + redact module |
| `@finsavvyai/policy-engine` | Allow/deny gates for agent actions |
| `@finsavvyai/ai-gateway` | Shared LLM proxy via Cloudflare Worker |
| `packages/shared-types` | Cross-product TS types (AML decisions, agent contracts) |
| `packages/aml-screen-client` | AMLIQ /screen TS client |
| `sdlc-core` | Private Go DLP/MaskAML library shared by AMLIQ + TenantIQ + SDLC.cc |
| `products/amliq/brain/` | AMLIQ Brain (reg-change, alert triage, SAR draft) — lives under the AMLIQ product tree, not a top-level `apps/` |

## Cross-cutting bets

- **Audit-first**: every product writes to `FINSAVVY_AUDIT_SINK` with shared shape + product event namespaces (`aml.*`, `qf.*`, `opensyber.*`, `tenantiq.*`, etc.). Audit emit failure is fail-closed.
- **PII-free reasons**: all `reason` fields are stable codes (e.g. `sanctions_match`), never free-form strings with PII.
- **Cryptographic identities**: agents have keypairs (OpenSyber), evidence is signed (SDLC.cc, AMLIQ), tool calls carry signatures.
- **Edge-first**: Cloudflare Workers is the default runtime where possible. D1 + KV + R2 for state.
- **Apple HIG**: all customer-facing UI passes contrast, keyboard nav, screen reader. Lighthouse CI ≥90 Perf + A11y on web surfaces.
- **Policy packs as monetizable assets**: MCP OWASP Top 10, NIST AI RMF, ISO 42001, EU AI Act, PCI AI-usage, AML investigation, M365 Copilot readiness — sold + versioned, not bundled features.
- **Replay everywhere**: failed AI PR, blocked tool call, AML decision, scrub event, DB query, LLM route — every decision is reconstructable from the audit trail.
- **Export Evidence button**: every product ships PDF + JSON + CSV + SIEM + signed hash + verification endpoint. Sell the compliance output, not the feature.
- **Local-first trust**: PushCI / Qestro / QueryFlux / SDLC.cc / OpenSyber run locally; cloud stores policy + metrics + audit only — raw data never leaves the box.
- **One demo repo** (`finsavvyai/ai-generated-saas-demo`): Cursor → PushCI → Qestro → QueryFlux → ClawPipe → OpenSyber → SDLC.cc → signed audit export, as the single end-to-end proof.

## Research starting points

1. **Market sizing per product** — TAM, SAM, pricing anchors (incumbent + adjacent)
2. **Switching cost** — contract length, integration burden, regulator/auditor acceptance
3. **Adoption curve** — MCP-in-production timeline, AI-coding test coverage drop, regulated-AI procurement RFP cycles
4. **Competitive landscape per product** — incumbent (World-Check, Cisco Duo, Playwright) + AI-native (Skyflow, Helicone, Mabl)
5. **Funnel economics** — PushCI free → portfolio cross-sell conversion benchmarks
6. **Compliance moat** — EU AI Act, US EO, Israeli AI directives, NIST AI RMF, ISO 42001 — which products carry which evidence asks
7. **Distribution moat** — npm SDK distribution (ClawPipe, PushCI), Office add-in store (SDLC.cc), Chrome/Edge/Firefox stores (SDLC.cc, OpenSyber VS Code extension)

## Status snapshot (2026-05-30)

| Product | Standalone repo | Monorepo state | Active development |
|---|---|---|---|
| AMLIQ | `finsavvyai/amliq` | stale snapshot | standalone leads (BEACON perf) |
| OpenSyber | `finsavvyai/opensyber` | stale snapshot | standalone leads |
| TenantIQ | `finsavvyai/tenantiq` | stale snapshot | standalone leads |
| Qestro | `finsavvyai/questro` | stale snapshot | standalone leads (WCAG pass) |
| PushCI | `finsavvyai/pushci` | recent (`7f0b994a5`) | standalone leads |
| ClawPipe | `finsavvyai/clawpipe` | stale snapshot (in `oss/`) | standalone leads |
| QueryFlux | — | restructured 2026-05-29 | monorepo (active) |
| SDLC.ai | — | monorepo-only | monorepo (Sprint 1 stabilization) |
| SDLC.cc | — | live deployments | monorepo (consolidation pending) |
| FinSavvy Cluster | — | monorepo-only | last commit 2026-05-13 |
| LunaOS | — | monorepo-only | active |

See `PRODUCTS_KEEP_ALIVE.md` for the **proposed** dual-presence submodule plan that would resolve the stale-snapshot drift (not yet executed — products are still plain tracked directories, no `.gitmodules`).
