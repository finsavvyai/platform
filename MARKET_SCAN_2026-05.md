# FinsavvyAI — May 2026 Market Scan

Source: external strategic scan, pasted 2026-05-30. Quantitative addendum added 2026-05-31 (deep-research workflow, 113 agents, cited + adversarially verified). See bottom of file.
Status: raw research input. Recommendations distilled in `PRODUCTS_VISION.md` deltas below.

## Executive conclusion

Portfolio thesis directionally right but too broad for market messaging. Strongest 2026 wedge:

**Secure, auditable infrastructure for AI-generated and AI-operated software.**

Connects PushCI → Qestro → QueryFlux → ClawPipe → OpenSyber → SDLC.cc as one buyer story. AMLIQ + TenantIQ + SDLC.ai = regulated-industry verticals on top.

Market validation:
- Agentic AI security recognized as 2026 category (Palo Alto, Gravitee)
- MCP both adoption wave AND security liability (ClawGuard paper, MCP security paper)
- AI DLP moved from browser filtering → AI-workflow governance (Microsoft Purview DSPM GA May 2026)
- LLM gateways crowded → ClawPipe must lead with deflection not routing
- AI testing crowded → Qestro needs "vibe coding" angle
- CI/CD mature → PushCI wedge is "guardrail for AI-generated PRs"

## Market themes (May 2026)

### A. Agent security = new WAF / API gateway category

Buyers asking: who is this agent? what tools can it call? what data? what if model tricked? can I prove what happened?

**Implication for OpenSyber**: drop "AI cyber SaaS" framing. Become "runtime policy boundary for MCP and autonomous agents."

Best positioning: **OpenSyber is the WAF + IAM + audit layer for AI agents and MCP tool calls.**

### B. MCP = adoption wave AND security liability

MCP creates market for OpenSyber, QueryFlux, LunaOS, ClawPipe. Also creates fear (server injection, tool poisoning, malicious tools, runtime-only behavior).

Moat is NOT MCP itself. Moat is: policy + signed audit + enforcement + sandboxing + benchmarked latency + enterprise deployment.

### C. AI DLP broader than "block PII in ChatGPT"

Microsoft Purview DSPM for AI now covers Copilots, agents, third-party LLM apps. AI DLP buyer guides cover ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek, Grok, desktop/native.

**Implication for SDLC.cc**: not "PII scrub." Position: "evidence-grade AI DLP for ChatGPT/Claude/Copilot/Gemini/Perplexity/MCP agents/Office workflows."

### D. LLM gateway crowded

LiteLLM, Helicone, Portkey, Cloudflare AI Gateway, Bifrost, Kong AI Gateway, TrueFoundry. Portkey + Helicone lead AI observability. LiteLLM = self-hosted flexibility. Cloudflare = edge-native.

**Implication for ClawPipe**: don't compete as "another gateway." Hero claim: **"Don't call the model when you don't need to."** Benchmarked cost reduction by task type (math, JSON, dates, classification, summarization, RAG, support, agent loops).

### E. AI testing crowded

Mabl, Functionize, testRigor, Katalon, Testim, Applitools, LambdaTest, BrowserStack.

**Implication for Qestro**: not generic "AI testing." Position: **"Testing copilot for AI-generated code before it reaches production."** Part of Cursor/Copilot/Claude Code workflow.

### F. CI/CD mature, but AI PRs create new wedge

GitHub Actions, GitLab CI, Jenkins dominate. But: 2026 paper analyzing 61,837 GitHub Actions runs from AI-bot PRs found negative correlation between AI-agent contribution frequency and workflow success rate.

**Implication for PushCI**: not "cheaper GitHub Actions." Position: **"CI/CD guardrail for AI-generated PRs."**

## Competitor cheat sheet

| Product | Main competitors |
|---|---|
| AMLIQ | LSEG World-Check, LexisNexis, ComplyAdvantage, NICE Actimize, SAS, SymphonyAI, Oracle Financial Crime, Fiserv, Quantifind |
| OpenSyber | Palo Alto AI security, Cisco AI Defense, Lakera, HiddenLayer, Noma, Protect AI, Prompt Security, Lasso, Mindgard, Patronus, Straiker |
| TenantIQ | Microsoft Defender for Cloud Apps, Purview, Entra, SaaS Alerts, Augmentt, CIPP, Huntress MDR M365, Hornetsecurity, Varonis, Adaptive Shield, AppOmni |
| Qestro | Mabl, Functionize, testRigor, Katalon, Testim, Applitools, LambdaTest, BrowserStack |
| PushCI | GitHub Actions, GitLab CI, Jenkins, CircleCI, Buildkite, Harness, TeamCity, Dagger, Earthly, RunsOn, Actuated |
| QueryFlux | Supabase, Neon, PlanetScale, Firebase, Appwrite, Convex, PocketBase, Hasura, Prisma + MCP DB wrappers |
| SDLC.cc | Microsoft Purview DSPM/DLP, Nightfall, Skyflow, Piiano, Dope Security, Netskope, Varonis, Concentric AI, Forcepoint, Symantec DLP |
| SDLC.ai | Azure OpenAI + Purview + Defender, AWS Bedrock Guardrails, Vertex AI, Databricks Mosaic, Snowflake Cortex, watsonx.governance, Credo AI, Holistic AI, CalypsoAI |
| ClawPipe | LiteLLM, Helicone, Portkey, Cloudflare AI Gateway, Bifrost, Kong AI Gateway, TrueFoundry, TensorZero, Maxim, Langfuse, Lunary |

## OSS projects to study / reuse

| Area | Project | Why |
|---|---|---|
| Agent security | ClawGuard | Deterministic tool-call boundary enforcement |
| Agent security | jamjet-labs/jamjet | Unsafe tool-call blocking, approval, budgets, audit, replay |
| MCP security | provnai/McpVanguard | Runtime enforcement boundary for MCP workflows |
| MCP firewall | ressl/mcp-firewall | Security gateway with policy + threat detection + audit |
| MCP chain detection | luckyPipewrench/pipelock | Detects attack patterns in tool-call sequences |
| MS governance | microsoft/agent-governance-toolkit | MCP security gateway spec, fail-closed, HMAC, audit |
| PII / DLP | microsoft/presidio | PII detection, redaction, masking, anonymization |
| LLM gateway | Helicone | OSS observability + AI Gateway, 100+ models |
| LLM deflection | Isartor | Rust prompt firewall, semantic caching |
| LLM routing | Bifrost / maximhq | Adaptive load balancing, guardrails, 1000+ models |
| AI testing | headout/autoheal | Auto-healing locators for Selenium + Playwright |
| AI testing | bug0inc/passmark | Playwright AI regression with auto-healing |
| AI testing | Karthick-1501/playwright-agent | AI Playwright framework with DOM discovery |
| MCP discovery | punkpeye/awesome-mcp-servers | Ecosystem map |

Action: create `research/adapters/` folder. POC adapters for:
1. Presidio → SDLC.cc
2. Jamjet / McpVanguard → OpenSyber
3. Helicone / Bifrost / Isartor → ClawPipe
4. AutoHeal / Passmark → Qestro
5. agent-governance-toolkit → audit + MCP gateway semantics

## GTM clusters

### Cluster 1 — Developer wedge (PushCI, Qestro, QueryFlux, ClawPipe)

- ICP: solo builders, Cursor users, Claude Code users, small teams, indie SaaS, dev agencies, technical founders
- Message: "AI helps you ship faster. FinsavvyAI keeps the output safe, tested, cheap, production-ready."
- Offer: free "AI Builder Safety Kit" (PushCI free local CI + Qestro 20 runs/mo + QueryFlux local proxy + ClawPipe 1k/day + OpenSyber local MCP firewall preview)
- Channels: GitHub, npm, Product Hunt, HN, Reddit (r/ClaudeAI, r/Cursor, r/LocalLLaMA, r/selfhosted), YouTube, VS Code / Cursor marketplaces
- Motion: OSS first → hosted upgrade. `npm install → local success → dashboard → team audit → paid`

### Cluster 2 — Security / compliance wedge (OpenSyber, SDLC.cc, SDLC.ai)

- ICP: CTO, CISO, DevSecOps, compliance officer, AI governance lead, MSP security lead
- Message: "Let employees and agents use AI without leaking data, bypassing policy, or losing audit evidence."
- Offer: free AI Risk Assessment (MCP config scan + browser AI scan + prompt leakage + GitHub Actions AI-bot PR risk + PDF mapped to NIST AI RMF / ISO 42001 / EU AI Act)
- Channels: LinkedIn security content, CISO webinars, M365/MSP communities, GitHub security marketplace, OWASP, compliance consultants as resellers
- Motion: land with audit evidence → expand to runtime enforcement

### Cluster 3 — Regulated verticals (AMLIQ, TenantIQ, SDLC.ai)

- ICP: fintechs, MSBs, payment companies, crypto exchanges, gaming, MSPs serving regulated clients
- Message: "Reduce compliance cost and false positives without sacrificing auditability."
- AMLIQ pitch: NOT "replace World-Check" first. Pitch: false-positive triage + case summary + sanctions explainability + audit export + secondary-screening API
- TenantIQ pitch: OAuth grant inventory + Copilot readiness + risky app consent drift + remediation simulation + MSP monthly posture report
- Channels: fintech founder communities, MSB/payment compliance, MSP forums, Microsoft partner ecosystem, regulatory consultants, LinkedIn outbound

## Top 10 strategic recommendations

1. **Rename master category**: "AI Software Control Plane" (not "portfolio", not "AI-native operational tooling")
2. **Reduce public products 11 → 3 bundles** (AI DevOps Kit, AI Security Kit, Regulated AI Kit)
3. **OpenSyber = flagship** (best 2026 timing: agent security + MCP + prompt injection + tool-call abuse)
4. **One shared audit ledger** across all products (shape: `tenant_id, product, event_type, actor_type, actor_id, resource, decision, reason_code, pii_stored, signature`)
5. **Policy packs as monetizable assets** (MCP OWASP Top 10, NIST AI RMF, ISO 42001, EU AI Act, PCI AI usage, AML investigation, M365 Copilot readiness)
6. **Replay everywhere** (failed AI PR, blocked tool call, AML decision, scrub event, DB query, LLM route)
7. **Signed evidence exports** (PDF + JSON + CSV + SIEM + signed hash + verification endpoint)
8. **Local-first trust differentiator** (PushCI/Qestro/QueryFlux/SDLC.cc/OpenSyber run locally; cloud stores policy + metrics + audit only)
9. **One demo repo** (`finsavvyai/ai-generated-saas-demo`) showing Cursor → PushCI → Qestro → QueryFlux → ClawPipe → OpenSyber → SDLC.cc → audit export
10. **Drop "1/10 cost" claim** until benchmarked. Replace with "priced for mid-market," "usage-based alternative," "reduce investigation time."

## Per-product wedge revisions

| Product | Current framing | Recommended wedge |
|---|---|---|
| AMLIQ | "Replace World-Check at 1/10 cost" | False-positive triage + investigation evidence overlay on existing screening |
| OpenSyber | WAF + MCP + agent runtime + marketplace + DBSC + sandbox | **OpenSyber MCP Firewall**: approve, block, replay, audit every agent tool call |
| TenantIQ | M365 governance | Multi-tenant AI governance console for MSPs |
| Qestro | Testing copilot, write once run everywhere | Qestro tests what AI coding agents changed |
| PushCI | Zero-config CI/CD wedge | Zero-config CI guardrail for AI-generated code |
| QueryFlux | AI-native database workspace | Database access broker for AI agents (not "another DB") |
| SDLC.cc | One gateway 8 surfaces PII scrub | AI prompt + file scrubber with signed evidence |
| SDLC.ai | Enterprise zero-trust AI/ML | Evidence layer mapping AI activity to NIST RMF / ISO 42001 / EU AI Act / SOC 2 / PCI / HIPAA / GDPR |
| ClawPipe | Booster + cache + route + gateway | **Cut LLM spend before the gateway** (deflection-first) |

## Pricing tweaks

| Product | Suggested tier change |
|---|---|
| AMLIQ | Free 1,000 screens/mo · Pro $99-$299 · Team $999 · Enterprise custom + data-retention |
| OpenSyber | OSS local firewall · Pro cloud audit $19-$49/dev/mo · Team policy mgmt $199/mo · Enterprise SSO/SIEM |
| TenantIQ | MSP starter $49/mo (10 tenants) · Growth $199 (50 tenants) · Scale $499+ · per-tenant remediation add-on |
| Qestro | Free local · Pro $19/dev/mo · Team $99-$299 · usage add-on hosted browsers |
| PushCI | Free local CLI · Pro dashboard $9/mo · Team $29/seat · Enterprise policy/fleet/SSO |
| QueryFlux | Free local proxy · Pro $29/mo · Team $199/mo · Enterprise private deployment |
| SDLC.cc | Free web scrubber · Pro browser ext $9/user · Team admin $99-$299 · Enterprise Office add-ins + SIEM |
| ClawPipe | Add **Indie $19/mo, 10k/day** between Free and Dev |

## Consolidated narrative

**"FinsavvyAI is the control plane for AI-generated software. Developers use Cursor, Claude Code, Copilot, and agents to ship faster. FinsavvyAI makes that software safe to test, deploy, operate, audit, and govern."**

Three bundles:
- **AI DevOps Kit** — PushCI + Qestro + QueryFlux + ClawPipe. "Ship AI-generated code safely."
- **AI Security Kit** — OpenSyber + SDLC.cc + SDLC.ai. "Secure agents, prompts, tools, sensitive data."
- **Regulated AI Kit** — AMLIQ + TenantIQ + SDLC.ai. "Evidence-grade AI workflows for regulated companies."

## Marketing tactics

1. **Benchmark-led** not vision-deck-led. Publish:
   - "LLM traffic eliminated by deterministic boosters"
   - "MCP firewall latency p50/p95/p99"
   - "AI-generated PR failure benchmark"
   - "Self-healing Playwright benchmark"
   - "PII scrub accuracy by entity type"
   - "World-Check-style false-positive triage benchmark"

2. **One "AI Agent Security Lab"** content engine. Weekly: MCP exploit demo, unsafe tool-call, prompt injection, .env leak, GitHub agent PR failure, Copilot exposure, Office DLP. Each post: "reproduce locally with FinsavvyAI."

3. **OSS the wedge, charge for evidence**: local CLI/GitHub Action/MCP server free. Dashboard + audit retention + SSO/SIEM + policy packs + hosted runners paid. Fits PushCI, Qestro, OpenSyber, SDLC.cc, ClawPipe.

4. **Sell compliance output, not features**: auditor-ready report, evidence trail, FP reduction, access-control proof, DLP proof, human-approval proof, policy-enforcement proof. Every product gets an **Export Evidence** button.

5. **Build around M365 as enterprise beachhead**: TenantIQ + SDLC.cc + OpenSyber combine into OAuth-grant-risk + Copilot-readiness + risky-apps + AI-data-movement + prompt-leakage + agent-access + MSP report.

## Priority roadmap

### Next 30 days
1. Pick OpenSyber as flagship
2. Launch "OpenSyber MCP Firewall" landing page
3. Publish one exploit demo
4. Publish one latency benchmark
5. Release local CLI / GitHub Action
6. Add signed audit export
7. Connect SDLC.cc scrubber as policy module
8. Create one demo repo
9. Add pricing
10. Start outbound to AI security leads + devtool founders

### Next 60 days
1. Launch PushCI + Qestro integrated AI PR guardrail
2. Launch QueryFlux local DB broker
3. Publish "AI-generated PR reliability" report (public repo data)
4. Launch ClawPipe benchmark
5. Build M365 Copilot/OAuth risk report for TenantIQ

### Next 90 days
1. Bundle AI DevOps Kit
2. Bundle AI Security Kit
3. Bundle Regulated AI Kit
4. Add SSO/SIEM/audit retention
5. Start MSP channel for TenantIQ + SDLC.cc
6. Start fintech compliance pilot for AMLIQ

## Final product ranking

| Rank | Product | Why |
|---|---|---|
| 1 | OpenSyber | Best 2026 timing: MCP + agent security + runtime enforcement + prompt injection + audit |
| 2 | SDLC.cc | Strong compliance pull: AI DLP, Copilot, ChatGPT, Claude, Office, evidence |
| 3 | PushCI | Best dev wedge + easiest distribution |
| 4 | Qestro | Strong IF positioned for AI-generated code (not generic QA) |
| 5 | ClawPipe | Good but crowded; must lead with deflection benchmarks |
| 6 | QueryFlux | Strong technical idea; must avoid Supabase-clone framing |
| 7 | TenantIQ | Good MSP niche; Microsoft competition risk |
| 8 | AMLIQ | Large market but trust/procurement/data moat hard. Start as overlay |
| 9 | SDLC.ai | Too broad standalone; use as enterprise bundle name |
| 10 | LunaOS | Keep internal runtime; external GTM later |
| 11 | FinSavvy Cluster | Crowded + lower urgency. Defer unless sharp niche found |

## Strongest recommendation

Ship **OpenSyber + SDLC.cc + PushCI** as one public story first.

Tagline: **"Secure the AI software factory — from generated code to agent runtime."**

---

# Quantitative addendum — cited market data (2026-05-31)

Source: deep-research workflow (113 agents, 5-angle fan-out → fetch → 3-vote adversarial verification). Fills the number gaps the qualitative scan above lacked. **Confidence = verifier-panel vote, NOT certainty.** Every figure carries a primary source. Anything not listed here was not independently verifiable from public sources (see Gaps).

Run stats: 6 angles → 30 sources fetched → 97 claims extracted → 25 verified → 21 confirmed, 4 killed.

## High-confidence findings (3-0 verifier vote, primary-sourced)

**OpenSyber — category TAM exists and is being validated by M&A.**
- AI Systems Security (AISS) market: **~$0 → nearly $8B by 2030**, ~60 vendors, across model security, AI red-teaming, AI-SPM, runtime guardrails, agent security. Source: Dell'Oro Group (May 2026). Caveat: single firm coined the category; all third-party coverage traces to one release (normal for analyst TAM).
- **Palo Alto acquired Protect AI** (announced Apr 28 2025, completed Jul 2025) → folded into **Prisma AIRS**, whose 5 named capabilities include "Runtime Security" + "AI Agent Security." A major incumbent now sits in OpenSyber's exact lane. Caveat: no public evidence Prisma AIRS covers MCP specifically; "AI Agent Security" is described generically.

**SDLC.cc — integrated incumbent confirmed.**
- **Microsoft Purview DSPM for AI** (GA) spans M365 Copilot, Security Copilot, Azure OpenAI/AI Foundry, AND third-party gen-AI incl. consumer ChatGPT via browser. Nightfall/Skyflow/Piiano (and SDLC.cc) compete against this breadth. Source: Microsoft Learn. Caveat: full third-party enforcement needs the Purview browser extension + E5-class licensing — affects depth, not breadth.

**PushCI / Qestro — adoption curve near-saturated.**
- **DORA 2025: 90% of tech professionals use AI at work** (+14 pts YoY, ~5,000 respondents). Source: Google Cloud/DORA. Caveat: "AI at work" = any use, not depth of dev-workflow integration.

**Qestro — incumbent pricing is opaque.**
- **mabl: quote-only, sales-led**, consumption/credit model (~500 cloud-test-run credits/mo to start, local runs free). No published dollar tiers. Source: mabl.com/pricing. (Third-party trackers *estimate* ~$499/mo Starter, $40k+/yr Enterprise — NOT mabl-published.) Signal: transparent pricing is itself a wedge.

**AMLIQ — competitor pricing anchor + regulator/auditor acceptance.**
- **ComplyAdvantage: self-service Starter from $99/mo** (annual; $120/mo monthly) for 100 monitored entities, entity-volume ladder to 2,000; Enterprise quote-only. Source: complyadvantage.com/pricing + G2.
- **Neon serverless Postgres** (QueryFlux anchor): usage-based, hourly-metered, no fixed seat — **$0.106/CU-hour (Launch), $0.222/CU-hour (Scale), $0.35/GB-month** storage. Post-Databricks (May 2025): storage fell ~80% from $1.75→$0.35/GB-mo. Source: neon.com. Caveat: $5/mo minimum since Aug 2025.
- **Red Hat AI Inference Server** (FinSavvy Cluster anchor): priced **per accelerator/GPU**, bundled into Red Hat AI Enterprise + OpenShift AI. Source: redhat.com + CDW SKU MCT4848. Caveat: exact $ not public (sales-directed) — a pricing *model*, not list price. OSS (Ollama/llama.cpp/raw vLLM) unambiguously free.
- Regulator acceptance: Wolfsberg **2022 AI/ML Principles** (5 named: Legitimate Purpose, Proportionate Use, Design/Technical Expertise, Accountability/Oversight, Openness/Transparency) + **2025 Effective Monitoring Part II**; **SR 11-7** (Fed/OCC) requires customer-side validation of vendor models. Sources: wolfsberg-principles.com, federalreserve.gov. Caveat: none "approve" AI decisions — they set explainability/validation/human-oversight expectations a vendor must meet. Wolfsberg is voluntary bank-industry guidance, not law.

## Medium-confidence findings (secondary syndicated research — attribute, don't treat as consensus)

| Product | Finding | Source | Caveat |
|---|---|---|---|
| **AMLIQ** | AML solutions market **$4.13B (2025) → $9.38B (2030)**, 17.8% CAGR | MarketsandMarkets #95490454 | Cross-firm variance wide: Grand View ~$4.24B, R&M $6.91B, Juniper ~$75B (by scope). $9.38B is high-end. Cite as MarketsandMarkets estimate, not TAM consensus |
| **SDLC.ai** | AI TRiSM market **$2.95B (2025)** → $3.59B (2026) | Precedence Research | Secondary aggregator; high-end of $2.0–2.95B cluster. The longer 2035 (~$21B) projection FAILED verification (1-2) — exclude it |

## What the panel REFUTED / killed

- ❌ **Neon: "80% of databases created by AI agents"** (0-3) and **"30%→80% AI-agent share growth"** (1-2) — both killed. Do NOT use as DB-for-AI-agents adoption evidence.
- ❌ **vLLM "500K+ GPUs / 200+ accelerators / 500+ models"** (1-2) — killed. Don't quote vLLM scale numbers.
- ❌ **AI-TRiSM ~$21B by 2035** (1-2) — speculative long-range, excluded.
- ⚠️ **"Regulators accept AI-generated AML decisions"** — wrong framing per the Wolfsberg/SR 11-7 findings. AMLIQ must position as human-in-loop with explainable, validated models, not autonomous decisioning. (Reinforces existing overlay/FP-triage wedge.)
- ⚠️ The portfolio's recurring **"1/10 cost"** claim stays **unbenchmarked** — incumbent contract prices (World-Check, NICE, LexisNexis, Palo Alto, Cisco) all quote-only, no public anchor to divide by. Keep out of public copy until a benchmark ships (matches Top-10 rec #10).

## Coverage gaps — NOT anchored this run (open questions for next pass)

These competitors from the brief returned **no verified hard-dollar figure**. Do not invent numbers:
- **PushCI**: GitHub Actions, CircleCI, Buildkite, Harness pricing.
- **ClawPipe**: LiteLLM, Helicone, Portkey, Cloudflare AI Gateway pricing.
- **LunaOS**: Temporal, Inngest, Trigger.dev, LangGraph pricing.
- **TenantIQ**: SaaS Alerts, Augmentt, CIPP, AppOmni (MSP-channel/quote-only).
- **SDLC.ai vendors**: Credo AI, Holistic AI, CalypsoAI.
- **AMLIQ enterprise incumbents**: LSEG World-Check, LexisNexis, NICE Actimize — contract/quote-only, no ACV anchored.
- OpenSyber's defensible **SAM slice** within the ~$8B AISS total (runtime-guardrails + agent-security + MCP wedge) — Dell'Oro reports category total only.
- Whether Prisma AIRS / Cisco AI Defense cover **MCP specifically** — undisclosed publicly.

## Time-sensitivity

Neon pricing may shift further post-Databricks; Prisma AIRS capabilities expanding; **SR 11-7 superseded by SR 26-02 / OCC 2026-13 (Apr 2026)** but vendor-validation principle preserved; Wolfsberg Part II (Aug 2025) recent enough that auditor adoption is still emerging.

## Sources (primary, verified)

Dell'Oro Group (AISS) · Palo Alto Networks (Protect AI / Prisma AIRS) · Microsoft Learn (Purview DSPM for AI) · Google Cloud/DORA 2025 · mabl.com/pricing · complyadvantage.com/pricing + G2 · neon.com/pricing · redhat.com (AI Inference Server) · Wolfsberg Group AI/ML Principles · US Federal Reserve SR 11-7. Secondary: MarketsandMarkets (AML), Precedence Research (AI-TRiSM).
