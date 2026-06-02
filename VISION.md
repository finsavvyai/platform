# Vision

> **Infrastructure for autonomous AI software systems.**

## Why this exists

Software is increasingly written, operated, and even reviewed by AI. By 2026, leading engineering orgs report a large and growing share of new code is AI-generated (Microsoft 20–30%; Google targeting ~75%), Gartner expects 40% of enterprise apps to embed task-specific agents by year-end (up from <5% in 2025), and the EU AI Act's high-risk obligations land **August 2, 2026**. Capability is racing ahead of *trust*: the same Gartner forecast warns >40% of agentic projects will be cancelled by 2027 for unclear value and weak risk controls.

The gap is not "can AI write the software?" — it's "**can you trust, govern, audit, and operate** AI that does?" FinsavvyAI Platform is the shared **control plane** that answers yes.

## What we are

A small set of hardened, framework-agnostic primitives that every AI-native product needs but should never re-implement:

| Package | Layer | Role |
|---|---|---|
| `policy-engine` | **Govern** | Rules over AI-generated code & PRs — allow / warn / deny decisions |
| `telemetry` | **Audit** | Traces, AI-execution logs, and replayable run history |
| `ai-gateway` | **Route** | Provider routing, retries, semantic cache, model selection |
| `auth` | **Identify** | OAuth, JWT, MFA, SAML, SCIM, RBAC — incl. emerging agent identity |
| `billing` | **Meter** | Subscriptions and entitlements |

Together they form a control plane where every AI action is **authenticated → authorized → policy-checked → logged/replayable → routed → metered.**

## Who we serve

The platform is the shared spine beneath six products, each owning an end-to-end AI engineering workflow:

- **PushCI** — trust AI-generated code
- **Qestro** — trust AI-generated apps
- **LunaOS** — operate AI engineering workflows
- **OpenSyber** — secure AI runtime execution
- **SDLC.cc** — govern AI software delivery
- **AMLIQ** — AI-native AML investigations

## Where we bet (and where we don't)

Our market research (see [`docs/MARKET_RESEARCH.md`](docs/MARKET_RESEARCH.md)) points to one dominant dynamic: **the trust/governance/observability/gateway space is being squeezed from both sides** — hyperscalers commoditize the gateway from below (AWS Bedrock, Azure Foundry, Vertex, and the labs now ship native routing + prompt caching + observability), while security suites and data platforms absorb governance from above (Palo Alto→Portkey & Protect AI, Check Point→Lakera, Cisco→Robust Intelligence, ClickHouse→Langfuse, CoreWeave→W&B). Surviving the middle requires betting on what's defensible, not what's commoditizing.

**We bet on the defensible layer.** Per the consensus of a16z, Sequoia, and Bessemer, the model is commoditizing and durable moats now come from **owned workflows, audit/governance, and data flywheels** — not raw data or thin wrappers.

1. **Governance & audit are the moat.** `policy-engine` (governing AI-generated code/PRs) and `telemetry` (auditable, replayable AI-execution logs) ride the EU-AI-Act and agentic-governance tailwinds, and sit in the emerging, still-unowned category of "governing AI-generated code." This is the story.
2. **Neutrality is our wedge.** Native hyperscaler routing/caching is single-vendor by design. A cross-vendor, cross-product control plane is the structural counter-position — so `ai-gateway` is a neutral cost/control *surface*, and `auth`/`billing` are *enablers*, never the differentiator.
3. **Deterministic execution replay is whitespace.** Most observability vendors stop at trace inspection; reproducible replay of AI runs — auditable and regulation-relevant — is genuinely differentiated.
4. **The six products are the workflow moat.** "Build customer-back": the products own end-to-end workflows; the platform is the shared system of record and data flywheel beneath them — exactly the defensibility the market rewards.

## How we build to that end

The engineering conventions are the vision made concrete (details in [`CLAUDE.md`](CLAUDE.md) and [`README.md`](README.md)):

- **Ports-and-adapters** — contracts as interfaces; consumers inject production infra. The platform stays a neutral spine, never coupled to one cloud or vendor.
- **Errors as values** and **explicit, replayable decisions** — auditability is a design property, not an afterthought.
- **100% coverage on critical paths** (auth, billing writes, policy decisions), mandatory **audit logs** for auth events / admin actions / sensitive mutations, and **no high/critical vulns at release** — because the product *is* trust.

## What "winning" looks like

Every AI-native product in the ecosystem treats authentication, authorization, policy, audit, routing, and metering as a solved, shared, neutral layer — and ships trustworthy autonomous software faster because of it. The platform becomes the system of record for *what AI did, under what policy, on whose authority* — the one place that question is answerable, and replayable.
