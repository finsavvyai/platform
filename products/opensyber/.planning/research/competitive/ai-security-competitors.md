# AI-Agent / LLM Security — Competitive Landscape

**Date:** 2026-04-18
**Author:** OpenSyber competitive intelligence
**Scope:** 5 direct competitors in the AI-agent runtime security space
**Comparison target:** OpenSyber (`opensyber.cloud`) — "deploy a secured AI agent in 60 seconds," TokenForge device-bound sessions, 70/30 revenue-split skill marketplace, SOC 2/ISO 27001/HIPAA/GDPR evidence generation, Cloudflare+Hetzner infra, per-user VMs with osquery+seccomp.

---

## Market snapshot

Four of the five vendors below have been acquired by strategic incumbents within the last 12 months. This consolidation wave — Protect AI into Palo Alto Networks (~$500M+), Lakera into Check Point (~$300M), CalypsoAI into F5 ($180M) — confirms the category is real but also reshapes it: these tools are now features in network/firewall vendor suites, not developer-native products. That opens a positioning gap OpenSyber can exploit: **the independent, PLG, developer-first AI-agent security platform**.

| Vendor | Parent | Deal size | Status | Main surface |
|---|---|---|---|---|
| Protect AI | Palo Alto Networks | ~$500M+ (closed Jul 2025) | Integrated | Guardian / Recon / Layer |
| Lakera | Check Point | ~$300M (Q4 2025 close) | Integrating | Lakera Guard (Gandalf) |
| CalypsoAI | F5 | $180M (Sep 2025) | Integrated as F5 AI Guardrails | Runtime guardrails + Red Team |
| HiddenLayer | Independent | Series A $50M (2023) | Independent | AISec Platform (4 modules) |
| Lasso Security | Independent | $21M total (Seed + SAFE) | Independent | MCP Gateway + AI-SPM |

Sources: [Palo Alto Networks press](https://www.paloaltonetworks.com/company/press/2025/palo-alto-networks-completes-acquisition-of-protect-ai), [Check Point/Lakera](https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises/), [F5/CalypsoAI](https://www.f5.com/company/news/press-releases/f5-to-acquire-calypsoai-to-bring-advanced-ai-guardrails-to-large-enterprises), [HiddenLayer Series A](https://techcrunch.com/2023/09/19/hiddenlayer-raises-50m-for-its-ai-defending-cybersecurity-tools/), [Lasso funding](https://pitchbook.com/profiles/company/539808-85).

---

## Protect AI (now Palo Alto Networks)

**Positioning tagline.** "The Platform for AI Security — the broadest and most comprehensive AI security solution." Post-acquisition, it is being folded into Palo Alto's Prisma / Cortex platform ([protectai.com](https://protectai.com)).

**Primary persona.** Enterprise SecOps and MLSec teams at Palo Alto-customer shops. Originally MLSecOps practitioners; now pushed up-market into CISO/enterprise buyers via PANW sales motion.

**Core product surface.**
- **Guardian** — model scanner (picks up malicious pickled models, backdoors, supply-chain issues).
- **Recon** — automated red-team / adversarial testing.
- **Layer** — runtime monitoring and threat mitigation.
- Open source: **ModelScan**, **LLM Guard** (community pull).

**Pricing model.** Enterprise "contact sales" only; no public tier, no free trial ([eesel.ai pricing analysis](https://www.eesel.ai/blog/protect-ai-pricing)). Available via AWS Marketplace for procurement shortcuts.

**Deployment model.** SaaS with "flexible deployment" language — specifics gated behind sales. Now part of PANW cloud stack.

**Notable features.**
1. Hugging Face partnership — 4M+ model versions scanned.
2. 17,000+ researchers in the `huntr` bug-bounty community feeding threat intel.
3. 2,520+ CVEs submitted — strongest public vuln-research footprint in the space.
4. Dataiku Agents integration (Aug 2025).
5. End-to-end coverage from model selection → runtime.

**Notable gaps (for OpenSyber to exploit).**
- No published pricing, no free tier, no self-serve signup.
- No skill/plugin marketplace — purely a scanner + runtime monitor.
- No agent hosting — expects you to bring your own infra.
- PANW sales cycle = 3–6 months; not dev-accessible.

**Funding / team.** Raised $108.5M total (incl. $60M Series B 2024 at $400M valuation, Salesforce/Samsung Ventures). Acquired by Palo Alto Networks ~$500M+, closed Jul 22, 2025 ([SiliconANGLE](https://siliconangle.com/2025/04/28/palo-alto-networks-buys-protect-ai-reported-500m-debuts-new-cybersecurity-tools/)). Team joining PANW, exact headcount not disclosed.

**Integrations.** Hugging Face, AWS, Databricks, Microsoft, Elastic, Dataiku. No explicit first-party LangChain/LlamaIndex/MCP integrations on marketing surface.

---

## Lasso Security

**Positioning tagline.** "Secure AI Adoption at Enterprise Scale" — discovery → assessment → enforcement ([lasso.security](https://lasso.security)).

**Primary persona.** Enterprise CISOs and security leaders worried about *agent proliferation* and shadow GenAI inside the org. Closer to CASB for AI than to a dev tool.

**Core product surface.**
- **Discovery & AI-BOM** — inventory of agents, models, tools.
- **AI-SPM** — posture management + compliance alignment.
- **Automated Red Teaming** — 3,000+ attack library.
- **Runtime Enforcement** — proxy/API/gateway guardrails.
- **AI Detection & Response** — behavioral anomaly detection ("Intent Security Framework").
- **MCP Gateway (open source)** — first-to-market security proxy for Model Context Protocol ([lasso blog](https://www.lasso.security/resources/lasso-releases-first-open-source-security-gateway-for-mcp)). This is their strongest dev-facing asset.

**Pricing model.** Not disclosed. "Book a demo" model. No free tier advertised — though their OSS MCP Gateway is free.

**Deployment model.** Cloud + on-prem via proxy/API/gateway integration. SaaS control plane implied.

**Notable features.**
1. OSS MCP Gateway — only competitor with an explicit MCP story in product.
2. Claims 98.6% detection accuracy, <50ms classification latency.
3. "570x more cost-effective than cloud-native guardrails" (marketing claim — unverified).
4. 3 patents pending on intent-based behavioral analysis.
5. Intent Security Framework — positions agentic AI as a non-deterministic runtime problem.

**Notable gaps.**
- No agent hosting — they secure agents, they don't *run* them.
- No skill marketplace.
- No transparent pricing.
- Small team (~27–50 per PitchBook/Tracxn) — execution risk at enterprise scale.
- No published compliance evidence generation (SOC 2 / ISO 27001 artifacts).

**Funding / team.** $21M total ($6M Seed Nov 2023, $5M Feb 2024, $10M SAFE Jun 2025). ~27–50 employees (Israel-based). Founded 2023 by Schulman, Ziv, Dror, Abadi ([Crunchbase](https://www.crunchbase.com/organization/lasso-security), [PitchBook](https://pitchbook.com/profiles/company/539808-85)).

**Integrations.** MCP (their headline). LangChain/OpenAI/Anthropic integration implied via their proxy posture but not productized as named connectors on marketing pages.

---

## Lakera (now Check Point)

**Positioning tagline.** "The AI-Native Security Platform to Accelerate GenAI" ([lakera.ai](https://lakera.ai)).

**Primary persona.** Fortune 500 AI platform engineers and regulated-industry security leads. Secondary: developers via the viral **Gandalf** prompt-injection game that drove inbound leads for 3 years.

**Core product surface.**
- **Lakera Guard** — low-latency API for prompt-injection / data-leak blocking.
- **Workforce AI Security** — shadow AI discovery for employees.
- **AI Agent Security** — runtime protection for agentic systems.
- **AI Red Teaming** — attack simulation.
- **Gandalf / Agent Breaker** — educational prompt-injection CTF.

**Pricing model.** This is one of the only two competitors with a real free tier:
- **Community**: $0/mo, 10,000 API requests/mo, 8,000-token prompts, SaaS-only (EU) ([platform.lakera.ai/pricing](https://platform.lakera.ai/pricing)).
- **Enterprise**: contact sales, custom quote, self-hosted option.

**Deployment model.** SaaS default (EU data residency); self-hosted on Enterprise plan only.

**Notable features.**
1. Sub-50ms runtime latency, 0.01% false-positive rate (claimed).
2. 100+ language coverage, multimodal, model-agnostic.
3. Claims "3–4 orders of magnitude" risk reduction via context-aware detection.
4. Gandalf — >1M developers played it, huge brand recognition in AI-sec.
5. NVIDIA NeMo toolkit reference integration.

**Notable gaps.**
- No agent hosting — pure API guardrail, you bring the runtime.
- No marketplace or plugin revenue share for third-party policies.
- No visible compliance evidence generator (SOC 2 automation).
- Acquisition by Check Point means product may be bundled into Quantum/Harmony SKUs — price transparency risk.
- Community plan caps at 10k req/mo, so not a meaningful free tier for production teams.

**Funding / team.** $30M raised; $20M Series A led by Atomico (Jul 2024). ~70 employees across Zurich + SF. Acquired by Check Point ~$300M, closing Q4 2025 ([Globe Newswire](https://www.globenewswire.com/news-release/2025/09/16/3150869/0/en/Check-Point-Acquires-Lakera-to-Deliver-End-to-End-AI-Security-for-Enterprises.html)).

**Integrations.** API-first; works with any LLM client. Named: NVIDIA NeMo. LangChain/OpenAI/Anthropic supported via generic API wrapping, not branded connectors.

---

## HiddenLayer

**Positioning tagline.** "The most comprehensive security platform for AI — backed by patented technology and industry-leading adversarial AI research" ([hiddenlayer.com](https://hiddenlayer.com)).

**Primary persona.** Enterprise CISOs, AI leaders, and app developers at banks, big tech, and US Federal. Most "enterprise-first" of the five; notable Booz Allen / IBM / Capital One investor list signals this positioning.

**Core product surface (AISec Platform).**
- **AI Discovery** — asset inventory, shadow-AI elimination.
- **AI Supply Chain Security** — model-integrity validation pre-deployment.
- **AI Attack Simulation** — continuous red team for agentic + generative AI.
- **AI Runtime Security (AIDR)** — non-invasive runtime detection.
- MCP protection capabilities explicitly called out ([HiddenLayer MCP post](https://hiddenlayer.com/innovation-hub/mcp-model-context-pitfalls-in-an-agentic-world/)).

**Pricing model.** Enterprise-only, demo-gated. No free tier. No public pricing.

**Deployment model.** Non-invasive runtime (claims no perf impact). SaaS + integrations into CI/CD, MLOps, SIEM/SOAR — appears to support hybrid.

**Notable features.**
1. 30+ issued patents in AI security — largest IP moat of the five.
2. Claimed 75% reduction in AI exploit exposure.
3. Strong federal story (FedRAMP-adjacent customers).
4. MCP + agentic coverage in the marketing (one of only two competitors that says MCP out loud).
5. Broadest module set of any independent vendor — closest "platform" posture.

**Notable gaps.**
- No agent hosting — security overlay only.
- No marketplace / skill ecosystem.
- No dev free tier, no self-serve.
- No evidence of 60-second onboarding — enterprise demo cycles.
- Still independent, but competitive pressure from PANW/Check Point/F5 is intense — acquisition risk is high (speculative).

**Funding / team.** $56M total; Series A $50M Sep 2023 (M12, Moore Strategic Ventures, Booz Allen, IBM, Ten Eleven, Capital One Ventures). 51–200 employees range (LeadIQ lists 164) ([TechCrunch](https://techcrunch.com/2023/09/19/hiddenlayer-raises-50m-for-its-ai-defending-cybersecurity-tools/), [PitchBook](https://pitchbook.com/profiles/company/501766-93)). No public Series B as of April 2026.

**Integrations.** Named: AWS, Databricks, CI/CD, MLOps pipelines, SIEM/SOAR. Explicit MCP research; LangChain/OpenAI/Anthropic covered generically.

---

## CalypsoAI (now F5 AI Guardrails)

**Positioning tagline.** "Define and deploy agile data security, threat management, and governance for AI models, apps, and agents" — positioned as runtime inference protection inside the F5 Application Delivery & Security Platform (ADSP) ([f5.com](https://www.f5.com/products/ai-guardrails)).

**Primary persona.** Large-enterprise compliance/risk/governance officers and F5 customers already running BIG-IP / NGINX. Not dev-native.

**Core product surface.**
- **F5 AI Guardrails** — runtime inference protection, DLP, policy violation detection, content moderation.
- **F5 AI Red Team** — 10,000+ attack patterns added monthly (claimed).
- Presets + custom policies.

**Pricing model.** No published pricing. Bundled/sold through F5 enterprise channel.

**Deployment model.** Runs inline with F5 ADSP (BIG-IP / NGINX inference gateway). Hybrid/cloud/on-prem follow F5's existing deployment matrix.

**Notable features.**
1. "Dynamic model routing" tied to risk scoring at runtime.
2. Compliance automation aligned to GDPR, HIPAA, EUAIA.
3. 10,000+ attack patterns added monthly for Red Team.
4. Deep F5 network integration — traffic-level enforcement.
5. Audit-ready observability / logging.

**Notable gaps.**
- No developer onboarding — you need to be (or buy) F5 infrastructure.
- No skill/plugin marketplace.
- No agent runtime — only guardrails around inference.
- Smallest pre-acquisition funding footprint ($40M) suggests the product is thinner than the marketing; F5 is buying distribution + brand.
- No MCP story in public marketing (speculative gap — F5 may add one).

**Funding / team.** Founded 2018, $40M+ pre-acquisition (Paladin Capital, Lockheed Martin Ventures, Hakluyt Capital). Acquired by F5 for **$180M cash**, Sep 2025 ([F5 press release](https://www.f5.com/company/news/press-releases/f5-to-acquire-calypsoai-to-bring-advanced-ai-guardrails-to-large-enterprises)). Major ops in Dublin, Ireland.

**Integrations.** F5 ADSP, BIG-IP, NGINX. No named LangChain/OpenAI/Anthropic/MCP integrations on marketing surface.

---

## Comparison matrix

| Dimension | Protect AI | Lasso | Lakera | HiddenLayer | CalypsoAI/F5 | **OpenSyber** |
|---|---|---|---|---|---|---|
| Free tier | No | OSS MCP Gateway | Yes (10k req/mo) | No | No | **Yes (planned $0 Free)** |
| Self-serve signup | No | No | Yes | No | No | **Yes (60s)** |
| Agent hosting | No | No | No | No | No | **Yes (per-user Hetzner VM)** |
| Skill marketplace | No | No | No | No | No | **Yes (70/30 split)** |
| Compliance evidence gen | Partial | No | No | Partial | Yes (GDPR/HIPAA) | **Yes (SOC2/ISO27001/HIPAA/GDPR)** |
| Device-bound sessions | No | No | No | No | No | **Yes (TokenForge ECDSA P-256)** |
| MCP coverage | No | Yes (OSS gateway) | Generic | Yes (research) | No | **Yes (claw-gateway)** |
| Independent in Apr 2026 | No (PANW) | Yes | No (Check Point) | Yes | No (F5) | **Yes** |
| Published pricing | No | No | Yes (Community) | No | No | **Yes (planned)** |
| Developer SDK | OSS tools | OSS MCP gateway | REST API | CI/CD plugins | No | **@opensyber/claw-sdk + skill-sdk** |

---

## Differentiation plan for OpenSyber

### 5 feature gaps OpenSyber can exploit

1. **Agent hosting + security in one surface.** All five competitors are *overlay* security — they assume the agent already runs somewhere else. OpenSyber's per-user Hetzner VM with osquery + seccomp is a unique "secure by default" runtime. Nobody else lets a developer get a hardened, monitored agent in 60 seconds.
2. **Skill marketplace with revenue share.** No competitor has a 70/30 marketplace. HiddenLayer has patents, Lasso has OSS, Lakera has Gandalf — none have a supplier economy. OpenSyber can compound faster as third-party skill authors ship new detections.
3. **Transparent, published pricing.** Only Lakera has a visible tier; everyone else is demo-gated. Post-acquisition, even Lakera's transparency is at risk. OpenSyber should publish Free / Pro / Team / Enterprise on the homepage and weaponize it in SEO/PLG.
4. **Compliance *evidence generation* not just checklists.** F5 does compliance "alignment"; OpenSyber ships AI-written SOC 2 / ISO 27001 / HIPAA / GDPR evidence via the `ai-compliance-writer` skill. That is an auditor-ready deliverable, not a dashboard.
5. **Device-bound sessions (TokenForge).** ECDSA P-256 non-extractable keys for agent control-plane access is a real security primitive none of the five advertise. Position as the answer to "my agent's API key got leaked" — a concrete pain no competitor solves.

### 3 positioning angles to own

1. **"The only PLG AI-agent security platform."** Four of five competitors are now owned by network/firewall vendors (PANW, Check Point, F5). They are inherently enterprise-sales motions. OpenSyber can own the entire developer/startup/mid-market segment with self-serve + free tier + docs-first.
2. **"Security-first skill marketplace."** Frame skills as *security-audited*, *sandboxed*, *revenue-sharing* — the App Store for agent security. Competitors sell blocks and detectors; OpenSyber sells a living ecosystem.
3. **"Independent. Not a feature of a firewall."** Make acquisition-neutrality a brand value. Customers building long-term AI pipelines don't want their security vendor bundled into a BIG-IP license or Prisma SKU. Use the consolidation wave as a talking point in sales.

### 2 pricing levers

1. **Aggressive free tier — 1 agent, unlimited core guardrails, 1k AI-skill calls/month, community skills free.** This beats Lakera's 10k-req API-only cap because it includes the *runtime*, not just guardrails. Makes OpenSyber the default for solo devs and indie builders; feeds word-of-mouth and skill-marketplace supply.
2. **Developer vs. enterprise split on compliance + SSO.** Keep Free/Pro priced for individuals ($0 / $29 / $99). Put SSO, SAML, data residency, audit logs, compliance evidence, custom SLA behind a Team ($299) / Enterprise ($2,999+) wall. This mirrors the v2 pricing in `project_v2_strategy.md` and exactly maps to where competitors gate demos.

### 1 risky bet

**Open-source the core runtime + agent under Apache-2.0 (or FSL), keep the marketplace + TokenForge + compliance writer closed-source as the commercial moat.** None of the five competitors have meaningfully open-sourced their runtime — Lasso's MCP gateway is a proxy, Protect AI's OSS is scanner tooling. If OpenSyber ships `opensyber-agent` as Apache-2.0 with a clean plugin API, it can capture the "Grafana for AI-agent security" position and let the marketplace + hosted control plane + TokenForge be the monetization layer. This is the Supabase / HashiCorp / Grafana playbook, translated to AI-agent security — and it's currently *unoccupied*.

Risk: it gives competitors a free on-ramp to copy the runtime primitives. Mitigation: the moat is the marketplace network-effect + compliance automation, not the runtime binary. Grafana proved you can give away the renderer and monetize the cloud.

---

## Sources

- [protectai.com](https://protectai.com) / [Guardian page](https://protectai.com/guardian)
- [lasso.security](https://lasso.security) / [MCP Gateway](https://www.lasso.security/resources/lasso-releases-first-open-source-security-gateway-for-mcp)
- [lakera.ai](https://lakera.ai) / [Pricing](https://platform.lakera.ai/pricing)
- [hiddenlayer.com](https://hiddenlayer.com) / [AISec Platform](https://hiddenlayer.com/aisec-platform/) / [MCP post](https://hiddenlayer.com/innovation-hub/mcp-model-context-pitfalls-in-an-agentic-world/)
- [f5.com AI Guardrails](https://www.f5.com/products/ai-guardrails) / [CalypsoAI acquisition](https://www.f5.com/company/news/press-releases/f5-to-acquire-calypsoai-to-bring-advanced-ai-guardrails-to-large-enterprises)
- [Palo Alto / Protect AI close](https://www.paloaltonetworks.com/company/press/2025/palo-alto-networks-completes-acquisition-of-protect-ai)
- [Check Point / Lakera](https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises/)
- [TechCrunch HiddenLayer $50M](https://techcrunch.com/2023/09/19/hiddenlayer-raises-50m-for-its-ai-defending-cybersecurity-tools/)
- [SiliconANGLE Protect AI $500M](https://siliconangle.com/2025/04/28/palo-alto-networks-buys-protect-ai-reported-500m-debuts-new-cybersecurity-tools/)
- [PitchBook Lasso](https://pitchbook.com/profiles/company/539808-85) / [PitchBook HiddenLayer](https://pitchbook.com/profiles/company/501766-93)
- [eesel Protect AI pricing analysis](https://www.eesel.ai/blog/protect-ai-pricing) / [eesel Lakera pricing](https://www.eesel.ai/blog/lakera-pricing)
