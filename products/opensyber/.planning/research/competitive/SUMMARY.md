# Competitive Landscape — Executive Summary

> **Date:** 2026-04-20 · **Scope:** OpenSyber + TokenForge · **Sources:** three parallel research docs in this directory (15 competitors, ~6,000 words evidence)

---

## Inputs

| Category | Competitors | Detail |
|---|---|---|
| **AI agent / LLM security** | Protect AI · Lasso · Lakera · HiddenLayer · CalypsoAI | [ai-security-competitors.md](./ai-security-competitors.md) |
| **Agent compute / hosting** | Modal · Railway · Fly.io · Hugging Face Spaces · Replit | [agent-compute-competitors.md](./agent-compute-competitors.md) |
| **TokenForge auth / session** | Auth0 · WorkOS · Clerk · Stytch · Keyri | [tokenforge-competitors.md](./tokenforge-competitors.md) |

---

## Top 5 threats across all 15

1. **Category consolidation in AI security** — Protect AI → Palo Alto ($500M+), Lakera → Check Point ($300M), CalypsoAI → F5 ($180M). Three of our direct security competitors now bundled into incumbent firewall/ADC distribution. Moat: the incumbents don't yet host agents — OpenSyber's runtime+security combo is still unique.
2. **Modal × OpenAI Agents SDK (April 2026)** — Modal's gVisor-isolated Sandboxes became the default backend for OpenAI's Agents SDK. $30/mo free credits, SOC 2 + HIPAA. Closest threat to eating the "secure agent runtime" category. Moat: they have isolation, not runtime attestation/skill marketplace/compliance evidence.
3. **Lasso's OSS MCP Gateway** — only vendor-native MCP security product shipping today. Pulls developer mindshare in exactly our wedge. Moat: they lack hosted runtime + skill marketplace + device-bound agent auth.
4. **Fly.io Sprites (Firecracker microVMs)** — explicit "built for agents" positioning, persistent state, ~$0.44 per 4-hr Claude Code session, SOC 2 Type 2. Strongest isolation story. Moat: no runtime security monitoring, no compliance evidence, no marketplace.
5. **Clerk's React/Next.js dev mindshare** (TokenForge flank) — owns our natural buyer audience without any cryptographic device binding. DX alone is the wedge. Moat: they ship zero Web Crypto non-extractable keys; zero MCP adapter.

## OpenSyber differentiation pillars

### Durable angles (3 to lead with)

- **Only PLG AI-agent security platform** — self-serve, 60-second onboarding, published pricing. Every AI-security competitor is demo-gated enterprise sales, especially post-acquisition. Every compute competitor lacks the security layer.
- **Runtime + security + marketplace, one surface** — per-user Hetzner VM with osquery + seccomp + TokenForge device-bound agent credentials + signed, SBOM-attested skill marketplace. No single competitor ships all three primitives.
- **Security-first skill marketplace with 70/30 split** — compounding supplier economy. Protect AI has `huntr` (17k researchers for vulnerability research, different motion) but nobody in security has an agent skill marketplace. Nobody in agent compute has security-audited skills.

### Secondary angles

- **Cloudflare + Hetzner infra** — cheap enough to give a real free tier (1 agent, 10 runs/day) that Modal/Replit/Railway can't match on margin once agents run 24/7.
- **TokenForge baked in** — device-bound agent credentials is a primitive *none* of the 15 competitors ship. Lakera's Red team, Protect AI's Guardian — all operate on HTTP prompt level, not session/identity level.
- **Compliance evidence out-of-the-box** — SOC 2 / ISO 27001 / HIPAA / GDPR auto-evidence from runtime telemetry. Modal offer SOC 2 for the infra; nobody yet shortcuts the compliance-pack generation for the agent workload.

## TokenForge differentiation pillars

Per research doc, TokenForge has the cleanest "nobody-else-ships-this" story in the portfolio:

- **Non-extractable ECDSA P-256 via Web Crypto in the browser** — Keyri have it mobile-only, Auth0 DPoP is OAuth-scoped, Clerk/WorkOS/Stytch have nothing
- **Framework-agnostic SDKs** — Hono, Express, Next.js, Go, Kotlin, Python, Swift, React Native, **MCP integration** — the MCP adapter is a first, aligned with OpenSyber's agent thesis
- **Per-request device attestation** — every session call proves device continuity cryptographically, not via fingerprint fuzzy match

## Pricing observations

| Segment | Free tier signal | Entry tier signal | Enterprise |
|---|---|---|---|
| AI security | Lakera Community 10k req/mo, rest demo-gated | No public pricing on Protect AI, CalypsoAI, HiddenLayer | 6-7 figure deals typical after acquisitions |
| Agent compute | Modal $30/mo free credits · Fly.io $5 free · Railway $5 free · HF Spaces free tier · Replit free | Most $5-20/mo entry | Custom |
| TokenForge auth | Clerk 10k MAU free · Stytch 25 MAU free · Auth0 25k MAU free · WorkOS unlimited SSO free | Clerk $25/mo · Auth0 $35/mo | 5-6 figure |
| **OpenSyber current** | 1 agent, 10 runs/day, no skills | Pro $299 (from V2 plan) | $9,999 |

### Pricing levers identified

1. **Free dev forever <10K MAU for TokenForge** — invert Auth0's growth penalty, undercut Clerk's $25 MFA paywall
2. **Per-bound-device pricing for TokenForge** (not per MAU) — aligns price with actual primitive; nobody else price this way
3. **Aggressive OpenSyber free tier on compute cost** — Hetzner €4/mo VM absorbed as CAC; competitors can't because usage-based billing

## GTM implications

From agent compute research:

- **Replit prod-DB incident + Fly GPU sunset** = concrete anti-competitor stories for paid marketing: "Replit agents can't destroy your DB, and we still have GPUs"
- **Sidecar GTM** — publish Modal/Fly adapter SDKs so OpenSyber land as the security sidecar on competitor infra. Non-zero-sum — they provide compute, we provide security layer
- **OpenAgentSec open spec bet** — push through Linux Foundation's Agentic AI Foundation to become the default free security baseline. Monetize compliance + evidence on top. Commoditizes security, creates distribution, weaponizes against the PANW/Check Point/F5 consolidation wave

From TokenForge research:

- **MIT-license the client SDK + adapters** — monetize hosted device registry, audit trail, cross-tenant threat intel
- **Position as "the OAuth for device-bound agents"** — become the default trust primitive for agent-to-agent and agent-to-service auth

From AI security research:

- **Lean into PLG as the anti-pattern to the entire incumbent category** — none of Protect AI, Lakera, CalypsoAI etc. have self-serve signup. Transparent pricing + 60s onboarding is structurally defensible
- **Developer as buyer, not CISO** — incumbents targeting CISOs; AI agents today built by developers who adopt bottom-up. Match the buyer

## Concrete actions (next 30 days)

### Product

- [ ] Ship runtime attestation feed UI in dashboard (leverages existing osquery + seccomp signals)
- [ ] Publish Modal adapter SDK (`@opensyber/modal-adapter`) — sidecar security for Modal agents
- [ ] Publish Fly.io adapter SDK (`@opensyber/fly-adapter`)
- [ ] Sign skill marketplace packages with Sigstore + ship SBOMs (differentiation vs Lasso MCP gateway)
- [ ] Add TokenForge MIT-license repo + landing at `tokenforge.opensyber.cloud/oss`
- [ ] Publish MCP adapter for TokenForge (differentiation vs every auth competitor)

### Positioning / marketing

- [ ] Rewrite opensyber.cloud homepage with three pillars as the headline structure
- [ ] Comparison page: OpenSyber vs Modal · vs Lasso · vs Protect AI
- [ ] Blog: "Why we chose per-user Hetzner VMs over Firecracker microVMs"
- [ ] Blog: "Replit prod-DB incident — what AI agent platforms should do differently"
- [ ] Launch on Product Hunt + Hacker News with "60-second secured AI agent" demo

### Pricing

- [ ] A/B: raise free-tier daily limit from 10 → 50 runs to close the gap with Modal $30 credits
- [ ] Announce TokenForge "free <10K MAU forever" commitment publicly (market signal vs Clerk/Auth0)
- [ ] Publish per-bound-device pricing table for TokenForge enterprise

### Standards play

- [ ] Draft OpenAgentSec spec v0.1 (MIT) — runtime attestation + signed skills + device-bound auth primitives
- [ ] Submit to Linux Foundation Agentic AI Foundation or similar
- [ ] Recruit 3 design partners among current portfolio integrations

## Risky bets worth considering

1. **Open-source OpenSyber agent runtime** (current closed source). Monetize marketplace + compliance + managed hosting. Commoditizes the layer the consolidating incumbents need, makes OpenSyber the reference implementation.
2. **Acquire a small AI-security open-source tool** to bootstrap developer presence (e.g. a fork of rebuff.ai or garak)
3. **Free lifetime Pro tier for 100 early-stage YC/accelerator founders** — seed the reference customer logos before PANW/Check Point bundles catch them

---

## Files in this directory

```
.planning/research/competitive/
├── SUMMARY.md                                    ← this file
├── ai-security-competitors.md                    ← 5 AI security profiles + differentiation
├── agent-compute-competitors.md                  ← 5 compute profiles + differentiation
└── tokenforge-competitors.md                     ← 5 auth profiles + differentiation

.planning/research/
├── tokenforge-entra-setup.md                     ← TokenForge Microsoft OAuth setup plan
└── mpn-partner-program.md                        ← MPN Partner Program enrollment guide
```
