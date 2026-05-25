# Agent Compute Competitors — Analysis

**Date:** April 18, 2026
**Scope:** Modal, Railway, Fly.io, Hugging Face Spaces, Replit Agent
**Lens:** OpenSyber positioning — "deploy a secured AI agent in 60 seconds" (Hetzner VM + osquery/seccomp + TokenForge device-bound sessions + skill marketplace)

---

## Executive Framing

Through 2025 and early 2026, nearly every general-purpose compute platform added an "agent surface" — persistent sandboxes, microVMs, agent SDKs, or MCP integrations. The space is consolidating around four isolation models: **gVisor** (Modal), **Firecracker microVMs** (Fly.io Sprites), **container sandboxing** (Railway, Replit), and **shared-tenant GPUs with ZeroGPU** (Hugging Face). OpenSyber's differentiated bet is that none of these ship **runtime security monitoring**, **device-bound session auth**, or **audited skill marketplaces** — they ship raw compute and leave security posture to the developer.

---

## 1. Modal (modal.com)

| Attribute | Detail |
|---|---|
| **Positioning tagline** | "AI infrastructure that developers love" |
| **Primary persona** | Python-first ML engineers, inference/training workloads, AI startup CTOs |
| **Agent-specific surface** | **Modal Sandboxes** — ephemeral gVisor-isolated containers explicitly marketed as "secure environments for untrusted code." Native integration with OpenAI Agents SDK (announced April 2026). |
| **Pricing** | Free: $30/mo credits, 3 seats, 100 containers + 10 GPU concurrency, 1-day log retention. GPU per-second: H100 $0.001097/s (~$3.95/hr), A100 80GB $0.000694/s, L4 $0.000222/s. CPU $0.0000131/core/s. |
| **Deployment latency** | "Sub-second cold starts," "instant autoscaling," marketed as "100x faster than Docker" |
| **Security posture** | **SOC 2 + HIPAA**, gVisor syscall interception via Sentry user-space kernel, default no inbound + CIDR-allowlisted outbound, 5-minute default sandbox lifetime (configurable 24h), team-level access controls, data residency |
| **Skills/extension ecosystem** | No marketplace. Python decorators + first-party integrations with S3, MLOps, telemetry vendors |
| **Notable features** | 1) gVisor sandboxing baked in, 2) Per-second GPU billing, 3) Native OpenAI Agents SDK backend, 4) Checkpointable containers, 5) $30/mo free credits |
| **Gaps vs. OpenSyber** | No runtime security monitoring (osquery-style), no skill marketplace, no device-bound session auth, no compliance evidence generation, no audited third-party skills |
| **Integrations** | OpenAI Agents SDK (native), MCP-compatible via Agents SDK, LangChain via Python |

Sources: [modal.com](https://modal.com), [Modal pricing](https://modal.com/pricing), [Modal Sandboxes docs](https://modal.com/docs/guide/sandboxes), [Northflank gVisor comparison](https://northflank.com/blog/how-to-sandbox-ai-agents)

---

## 2. Railway (railway.com)

| Attribute | Detail |
|---|---|
| **Positioning tagline** | "Ship software peacefully" / "the all-in-one intelligent cloud provider" |
| **Primary persona** | Full-stack indie devs, startup teams (TripAdvisor, Cognizant, Mercado Libre cited), anyone tired of Kubernetes |
| **Agent-specific surface** | Generic compute, not agent-specific. `/agents` page exists but is a thin label; no agent runtime SDK. 650+ template marketplace for frameworks. |
| **Pricing** | Free: 1 vCPU / 0.5 GB RAM / 0.5 GB storage / 1 project ($1/mo after 30-day trial). Hobby $5/mo. Pro $20/mo (1,000 vCPU, 1 TB RAM cap). Enterprise custom w/ HIPAA BAA, SSO, audit logs. CPU $0.00000772/vCPU-s, memory $0.00000386/GB-s, egress $0.05/GB |
| **Deployment latency** | "No cold starts, unlimited duration" — customer testimonial: 1,500 rps at <50ms. Deploy-from-git push in seconds. |
| **Security posture** | SSL auto-provisioned, 100 Gbps private networking, no VPC config required. **Enterprise-only**: SSO, HIPAA BAA, audit logs, dedicated VMs. No SOC 2 publicly advertised on standard tier. |
| **Skills/extension ecosystem** | 650+ template marketplace (Postgres, Redis, Next.js, etc.) — **not agent skills**, just app templates |
| **Notable features** | 1) Template marketplace, 2) No cold starts, 3) Per-second billing, 4) Git-push deploys, 5) 100Gbps private mesh |
| **Gaps vs. OpenSyber** | No agent runtime, no security monitoring, no sandboxing for untrusted code, no device binding, no compliance evidence, no skill marketplace (templates ≠ skills) |
| **Integrations** | Docker-native, supports Datadog, Sentry, OpenTelemetry, Terraform |

Sources: [railway.com](https://railway.com), [Railway pricing](https://railway.com/pricing), [Railway Review 2026](https://scribehow.com/page/Railway_Review_2026_The_Cloud_Deployment_Platform_Developers_Are_Quietly_Switching_To__MWY5FbWoSFO2qF55Vz9bgQ)

---

## 3. Fly.io (fly.io)

| Attribute | Detail |
|---|---|
| **Positioning tagline** | "Build fast. Run any code fearlessly." |
| **Primary persona** | Distributed-systems devs, edge-first SaaS teams, AI agent developers (with Sprites) |
| **Agent-specific surface** | **Sprites (sprites.dev)** — launched Jan 2026. Firecracker-based persistent VMs explicitly marketed for AI coding agents (Claude Code primary case). Boot in 1–12s, 100GB NVMe, checkpoint/restore in ~300ms, auto-idle. |
| **Pricing** | Pay-as-you-go. shared-cpu-1x 256MB ~$2.02/mo, performance-1x 2GB ~$32/mo. **Sprites: $0.07/CPU-hr + $0.04375/GB-hr memory + $0.000683/GB-hr hot storage**. $30 trial credits. A 4-hr Claude Code session ≈ $0.44. **GPUs deprecated after Aug 2026.** |
| **Deployment latency** | Machines launch "instantly," Sprites boot in 1–12s, sub-100ms response across 18 regions |
| **Security posture** | **SOC 2 Type 2**, KVM hardware isolation on all apps, Firecracker microVMs for Sprites ("Even we have a hard time seeing what they're doing"), Rust/Go memory-safe stack, end-to-end encryption on private networking, L3 network policies + domain allowlists |
| **Skills/extension ecosystem** | No skill marketplace. JS + Go SDKs. CLI auto-generates Dockerfiles for Phoenix, Rails, Django, Laravel, Next.js, SvelteKit |
| **Notable features** | 1) Firecracker microVM isolation, 2) Persistent stateful Sprites, 3) Checkpoint/restore ~300ms, 4) Auto-idle billing, 5) 18 global regions |
| **Gaps vs. OpenSyber** | No runtime security monitoring layer (no osquery/seccomp pre-wired), no skill marketplace, no device-bound sessions, no compliance evidence generator, **dropping GPUs** |
| **Integrations** | Claude Code (primary), generic Linux so any framework works; no MCP marketplace or first-party agent SDK |

Sources: [fly.io](https://fly.io), [Fly.io pricing](https://fly.io/docs/about/pricing/), [Sprites.dev](https://sprites.dev/), [SDxCentral on Sprites](https://www.sdxcentral.com/news/flyio-debuts-sprites-persistent-vms-that-let-ai-agents-keep-their-state/), [Simon Willison on Sprites](https://simonwillison.net/2026/Jan/9/sprites-dev/)

---

## 4. Hugging Face Spaces (huggingface.co/spaces)

| Attribute | Detail |
|---|---|
| **Positioning tagline** | "The AI App Directory" |
| **Primary persona** | ML researchers, model publishers, demo-builders, AI hobbyists |
| **Agent-specific surface** | **Hugging Face Agents** — connects agents to the Hub via **MCP**, Skills, and open-source tooling. Works with Claude Desktop, Cursor, ChatGPT, VS Code. ZeroGPU H200 free tier. |
| **Pricing** | Free CPU Basic (2 vCPU / 16GB). CPU Upgrade $0.03/hr. T4 $0.40/hr. L4 $0.80/hr. L40S $1.80/hr. A100 80GB $2.50/hr. 8xA100 $20/hr. **ZeroGPU (H200, 70GB VRAM) FREE**. PRO $9/mo. Team $20/user/mo (SSO, audit logs, storage regions). Enterprise $50+/user/mo. |
| **Deployment latency** | Click "New Space" → select hardware → deploy. Minutes, not seconds. ZeroGPU has queue with PRO priority. |
| **Security posture** | **SOC 2 Type 2**, GDPR compliant, TLS everywhere, RBAC, AWS PrivateLink (Inference Endpoints), BAAs for Enterprise. Spaces themselves run in Docker containers — isolation not as aggressive as microVMs. |
| **Skills/extension ecosystem** | The Hub IS the marketplace — millions of models/datasets, Spaces as deployable apps, Skills system for Agents. Not a paid-revenue-share marketplace like OpenSyber's 70/30. |
| **Notable features** | 1) Free ZeroGPU H200, 2) MCP-first agent architecture, 3) Massive model/dataset ecosystem, 4) Spaces Dev Mode (PRO), 5) Storage Regions for data residency (Team+) |
| **Gaps vs. OpenSyber** | Research-demo optimized, not production security; no runtime monitoring, no osquery/seccomp, no device binding, no compliance evidence, weaker container isolation than microVMs |
| **Integrations** | MCP native, Claude/ChatGPT/Cursor/VS Code clients, TRL, Qwen, ERNIE, full HF model zoo |

Sources: [Hugging Face Spaces](https://huggingface.co/spaces), [HF pricing](https://huggingface.co/pricing), [HF Agents docs](https://huggingface.co/docs/hub/agents), [HF Security docs](https://huggingface.co/docs/hub/en/security)

---

## 5. Replit Agent (replit.com)

| Attribute | Detail |
|---|---|
| **Positioning tagline** | "Turn ideas into apps in minutes — no coding needed" (Replit Agent 4) |
| **Primary persona** | Non-coders, citizen developers, vibe-coding startup founders, educational users |
| **Agent-specific surface** | **Replit Agent 4** — parallel agents, multi-artifact output (web/mobile/landing/video), team coordination, one-shot prompts. Deeply integrated IDE. |
| **Pricing** | Starter free (limited daily credits). Core $20/mo ($25 credits). Pro $95/mo annual ($100 credits, 15 collaborators). Enterprise custom (SSO/SAML, VPC peering, static IPs). |
| **Deployment latency** | "Minutes" — agent-driven build loop, not instant. Deployments are first-class but tied to Replit runtime. |
| **Security posture** | **SOC 2 Type 2**, container isolation per project, restricted network access, Google Cloud Armor DDoS, RBAC + SAML on Enterprise. **Notable: 2025 incident where agent deleted a production DB** — Replit added snapshots/sandbox since. **No VPC isolation on standard plans.** |
| **Skills/extension ecosystem** | 100+ integrations (OpenAI, Stripe, Google Workspace). Databricks + Lakebase enterprise data partnerships. No third-party skill marketplace with revenue share. |
| **Notable features** | 1) Parallel agent execution, 2) Multi-artifact output, 3) Built-in auth/DB/hosting, 4) 100+ integrations, 5) Design-to-code flow |
| **Gaps vs. OpenSyber** | Container-only isolation (weaker than microVM/gVisor), no runtime monitoring, no device-bound auth, no audited skill marketplace, compliance evidence not automated, history of agent-caused destructive incidents |
| **Integrations** | OpenAI, Stripe, Google Workspace, Databricks, Lakebase, generic HTTP APIs |

Sources: [Replit](https://replit.com), [Replit Security](https://replit.com/products/security), [Replit Enterprise](https://replit.com/enterprise), [Replit Review 2026](https://hackceleration.com/replit-review/)

---

## Comparative Matrix

| Capability | Modal | Railway | Fly.io | HF Spaces | Replit | **OpenSyber** |
|---|---|---|---|---|---|---|
| Agent-specific runtime | Sandboxes | None | Sprites | Agents/MCP | Agent 4 | **Hetzner VM + osquery** |
| Isolation model | gVisor | Container | Firecracker | Container | Container | KVM + seccomp |
| SOC 2 | Y (+ HIPAA) | Enterprise only | Y | Y | Y | Roadmap |
| Runtime security monitoring | N | N | N | N | N | **Y (osquery)** |
| Device-bound session auth | N | N | N | N | N | **Y (TokenForge ECDSA P-256)** |
| Skill marketplace (revenue share) | N | Templates only | N | Hub (no $) | N | **Y (70/30)** |
| Compliance evidence gen | N | N | N | N | N | **Y (ai-compliance-writer skill)** |
| Free tier (ongoing) | $30/mo credits | 1 vCPU/0.5GB | None (credits only) | CPU Basic + ZeroGPU | Limited credits | **1 agent, 10 runs/day** |
| Cold start | Sub-second | None | 1–12s (Sprites) | Seconds | Minutes | **60s deploy claim** |
| Native MCP integration | Via Agents SDK | N | N | **Y (first-class)** | Partial | Roadmap |

---

## Differentiation Plan for OpenSyber

### Five Positioning Angles — "the secure layer they don't have"

1. **"Modal gives you a sandbox. OpenSyber gives you a SOC-ready agent."** — Modal ships gVisor isolation but leaves monitoring, auth, compliance to the customer. OpenSyber ships osquery + seccomp + TokenForge + compliance evidence pre-wired on day zero.
2. **"Railway ships apps. OpenSyber ships agents you can audit."** — Railway has zero agent-specific security surface and no audit logging on standard tiers. OpenSyber positions against Railway as the "agent-native Railway" where every action is device-bound and audited.
3. **"Fly.io Sprites are for Claude Code sessions. OpenSyber is for production agents."** — Sprites is positioned for ephemeral coding agents. OpenSyber is positioned for long-running production agents that need runtime security telemetry, not 4-hour scratch sessions. Also: **Fly dropped GPUs in 2026** — OpenSyber can partner or fill that void.
4. **"Hugging Face is a research directory. OpenSyber is a production runtime."** — HF Spaces is research-demo culture. OpenSyber targets security-conscious teams where "my Space might leak my dataset" is a blocker.
5. **"Replit Agents deleted a prod DB. OpenSyber agents can't."** — Capitalize on Replit's 2025 destructive-agent incident. OpenSyber's seccomp profiles + device-bound write tokens make that class of failure structurally impossible.

### Three Concrete Security Features to Build/Highlight

1. **Runtime Attestation Feed** — expose a live osquery-backed telemetry stream per agent (syscalls, fs writes, network egress). Every competitor treats the sandbox as a black box. OpenSyber treats it as an observable, audited surface. Ship as `/agents/{id}/attestation` and a dashboard heatmap.
2. **Skill Marketplace Signing + SBOM** — every skill in the marketplace gets a cryptographic signature, SBOM, and provenance record before install. Undercut HF (open free-for-all) and Replit (100+ integrations with no attestation). Anchor to SLSA Level 3.
3. **Device-bound Agent Tokens via TokenForge** — make the OpenSyber agent's API credential a non-extractable ECDSA P-256 key bound to the host VM. Modal/Fly/Replit all use bearer tokens that an attacker extracts from env once and re-uses anywhere. OpenSyber tokens refuse to work off-device.

### Two GTM Plays

1. **"Drop-in secured Modal Sandbox" partnership/bridge** — publish an `@opensyber/modal-adapter` SDK that lets Modal users wrap their Sandboxes with OpenSyber runtime monitoring + TokenForge in three lines. Same for Fly Sprites. Meet users where they already are; land on their infra as the security sidecar, then expand.
2. **Compliance Fast-Track campaign targeting regulated vertical SaaS** — "Deploy your first SOC-2-evidenced AI agent in 60s." Lean into the `ai-compliance-writer` skill ($99/mo premium bundle) paired with free tier. Lead gen: any team in fintech/healthtech/legaltech that needs audit evidence but has no budget for a compliance engineer.

### One Bold Bet

**OpenSyber becomes the default secure-sidecar every agent platform ships with.** Push to make the OpenSyber runtime + TokenForge + attestation feed an open spec (OpenAgentSec), then land it as the security layer recommended inside the Agentic AI Foundation (Linux Foundation, April 2026). When Modal/Fly/Railway customers ask "how do I secure this agent?" — the answer is the OpenSyber spec, hosted on OpenSyber by default, forkable by anyone. Same playbook as Let's Encrypt for TLS: become the obvious free baseline, monetize on the enterprise compliance/evidence layer above it.

---

## Sources

- [modal.com](https://modal.com) — positioning
- [Modal pricing](https://modal.com/pricing) — GPU/CPU rates
- [Modal Sandboxes docs](https://modal.com/docs/guide/sandboxes) — gVisor isolation
- [Northflank — How to sandbox AI agents 2026](https://northflank.com/blog/how-to-sandbox-ai-agents) — isolation taxonomy
- [railway.com](https://railway.com) — positioning
- [Railway pricing](https://railway.com/pricing) — tier limits
- [Railway Review 2026](https://scribehow.com/page/Railway_Review_2026_The_Cloud_Deployment_Platform_Developers_Are_Quietly_Switching_To__MWY5FbWoSFO2qF55Vz9bgQ) — cold start data
- [fly.io](https://fly.io) — positioning
- [Fly.io pricing docs](https://fly.io/docs/about/pricing/) — machine pricing
- [Sprites.dev](https://sprites.dev/) — Sprites pricing + isolation
- [SDxCentral: Fly.io Sprites](https://www.sdxcentral.com/news/flyio-debuts-sprites-persistent-vms-that-let-ai-agents-keep-their-state/)
- [Simon Willison on Sprites](https://simonwillison.net/2026/Jan/9/sprites-dev/)
- [huggingface.co/spaces](https://huggingface.co/spaces) — AI App Directory
- [Hugging Face pricing](https://huggingface.co/pricing) — Spaces hardware, PRO/Team/Enterprise
- [HF Agents docs](https://huggingface.co/docs/hub/agents) — MCP-first agent model
- [HF Security docs](https://huggingface.co/docs/hub/en/security) — SOC 2 Type 2
- [replit.com](https://replit.com) — Agent 4 positioning
- [Replit Security](https://replit.com/products/security) — SOC 2, container isolation
- [Replit Enterprise](https://replit.com/enterprise) — SSO/SAML/VPC
- [Replit Review 2026](https://hackceleration.com/replit-review/) — 2025 prod DB incident
- [OpenAI Agents SDK + Modal integration 2026](https://dev.to/practiceoverflow/the-great-agent-platform-consolidation-why-im-rethinking-my-9-side-project-agent-4mba) — April 2026 consolidation
