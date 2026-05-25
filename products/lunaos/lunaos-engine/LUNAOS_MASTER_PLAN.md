# 🌙 LunaOS — The Master Plan

### *The Open Platform That Replaces Your Entire Engineering Team*

**Date**: February 7, 2026  
**Version**: 1.0  
**Classification**: Internal Strategy  
**Domain**: `lunaos.ai`  

---

> *"The best way to predict the future is to build it."*  
> *— Alan Kay*

---

## Part I: The Thesis

### The $200B Problem

Every company in the world is trying to ship software faster. The answer for the last 3 years has been "AI coding assistants." But here's what nobody is saying out loud:

**Code completion is a feature, not a product.**

GitHub Copilot, Cursor, Windsurf — they all do the same thing: you type, they autocomplete. They're souped-up IntelliSense. They help you write code **faster**, but they don't help you **build software**.

Building software is not writing code. Building software is:
- Understanding requirements
- Designing architecture
- Writing code *(this is the only part Copilot helps with)*
- Reviewing for security vulnerabilities
- Writing tests
- Setting up CI/CD
- Deploying to production
- Monitoring and debugging
- Writing documentation
- Iterating based on feedback

**Copilot handles 1 of 10 steps.** The other 9 steps still take 90% of the time.

### The LunaOS Thesis

**What if you could hire an entire AI engineering team, not just an AI typist?**

LunaOS is not a code completion tool. LunaOS is an **AI-native software development platform** — a coordinated team of 20+ specialized agents, each world-class at one discipline, that work together to take you from idea to deployed application.

```
The Old Way (2024-2025):
  Human Developer + Copilot autocomplete
  → Still takes weeks to ship
  → Still manually reviews, tests, deploys
  → Still writes docs at 2 AM (or never)

The LunaOS Way (2026):
  Human Developer + 20 AI Agents
  → Requirements: 5 minutes (not 2 days)
  → Architecture: 10 minutes (not 1 week)  
  → Code Review: instant (not waiting for teammate)
  → Test Suite: generated (not skipped)
  → Deployment: one command (not a sprint)
  → Documentation: automatic (not outdated)
```

### Why Now

Three things happened in 2025 that make this possible today:

1. **MCP (Model Context Protocol)** became the standard. Any AI tool can call any other AI tool through a universal protocol. LunaOS agents speak MCP natively — they work inside Claude, Cursor, Windsurf, Zed, and any future tool.

2. **On-device inference crossed the quality threshold.** Nexa SDK runs 70B-parameter models on a MacBook with acceptable latency. Enterprises can now run AI agents without sending a single byte to the cloud.

3. **Multi-agent orchestration matured.** OpenHands proved (77.6% SWE-Bench) that specialized agents outperform general-purpose ones. LunaOS builds on this foundation with 5 custom-trained agents.

### The Market Map

```
                    Code Completion ◄──────────────────────► Full SDLC
                          │                                      │
        GitHub Copilot ───┤                                      │
        Cursor ───────────┤                                      │
        Windsurf ─────────┤                                      │
        Codeium ──────────┤                                      │
        Tabnine ──────────┤                                      │
                          │                                      │
                          │               Devin ─────────────────┤
                          │               Replit Agent ───────── ┤
                          │                                      │
                          │                  🌙 LunaOS ──────────┤
                          │                                      │
   Cloud-Only ◄───────────┼──────────────────────────────► Runs Anywhere
                          │                                      │
        Devin ($500/mo) ──┤                                      │
        Replit ────────── ┤                                      │
        v0 ───────────────┤                                      │
        Bolt.new ─────────┤                                      │
                          │                                      │
                          │                  🌙 LunaOS ──────────┤
                          │                  Ollama ──────────── ┤
                          │                                      │

  Single Agent ◄──────────┼──────────────────────────────► Multi-Agent
                          │                                      │
        Everyone else ────┤                                      │
                          │                                      │
                          │                  🌙 LunaOS ──────────┤
                          │                                      │
```

**LunaOS occupies the only empty quadrant: Full SDLC × Runs Anywhere × Multi-Agent.**

---

## Part II: The Product

### What LunaOS Actually Is

LunaOS is a **platform with six surfaces**, all under `lunaos.ai`:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        🌙 lunaos.ai                                 │
│                                                                     │
│  ┌─────────┐ ┌──────────────┐ ┌──────────┐ ┌──────┐ ┌───────────┐ │
│  │ Landing  │ │  Dashboard   │ │  Studio  │ │ CLI  │ │    MCP    │ │
│  │ Page     │ │              │ │          │ │      │ │  Protocol │ │
│  │          │ │ • Run agents │ │ • Visual │ │ luna │ │           │ │
│  │ lunaos   │ │ • View runs  │ │   agent  │ │ init │ │ Works in  │ │
│  │ .ai      │ │ • API keys   │ │   chain  │ │ run  │ │ Claude    │ │
│  │          │ │ • Billing    │ │   builder│ │ deploy│ │ Cursor    │ │
│  │          │ │ • Analytics  │ │          │ │ serve│ │ Windsurf  │ │
│  │          │ │              │ │          │ │      │ │ Zed       │ │
│  │          │ │ agents.      │ │ studio.  │ │      │ │ VS Code   │ │
│  │          │ │ lunaos.ai    │ │ lunaos.ai│ │      │ │           │ │
│  └─────────┘ └──────┬───────┘ └────┬─────┘ └──┬───┘ └─────┬─────┘ │
│                     │              │           │           │       │
│                     └──────────────┼───────────┤───────────┘       │
│                                    │           │                   │
│                          ┌─────────▼───────────▼──────────┐       │
│                          │      api.lunaos.ai              │       │
│                          │                                 │       │
│                          │  The Engine:                    │       │
│                          │  • Agent execution              │       │
│                          │  • RAG (semantic code search)   │       │
│                          │  • Plugin system                │       │
│                          │  • Auth + billing               │       │
│                          │  • Workflow orchestration        │       │
│                          │                                 │       │
│                          │  Powered by:                    │       │
│                          │  • Cloudflare Workers (edge)    │       │
│                          │  • OpenHands (AI agents)        │       │
│                          │  • Nexa SDK (on-device)         │       │
│                          │  • PostgreSQL + Vectorize       │       │
│                          └─────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### The 20+ Agents

Every agent is a **specialist**. They don't do everything — they do one thing at a world-class level.

#### 🏗️ **Build Agents** — From idea to code

| Agent | What It Does | How It's Different |
|-------|-------------|-------------------|
| **📋 Requirements Analyzer** | Takes a vague idea → produces structured spec with user stories, acceptance criteria, data models | Doesn't just list features — produces implementable specs with Mermaid diagrams |
| **🏛️ Design Architect** | Takes spec → produces technical design, API contracts, database schema, component hierarchy | Generates actual Prisma schemas and OpenAPI specs, not just diagrams |
| **💻 Code Generator** | Takes design → produces production code with error handling, logging, types | Not autocomplete — generates entire files, routes, services with proper patterns |
| **📸 Vision RAG** | Takes screenshot → breaks down into components → generates matching code | The only agent that can look at a Figma screen and produce pixel-accurate code |

#### 🛡️ **Quality Agents** — Make it bulletproof

| Agent | What It Does | How It's Different |
|-------|-------------|-------------------|
| **🔍 Code Review** | Analyzes code for bugs, security flaws, performance issues, anti-patterns | OWASP-aligned, knows your stack, produces actionable fixes not just warnings |
| **🧪 Testing Agent** | Generates unit, integration, and E2E test suites with 80%+ coverage | Generates Playwright/Jest/Vitest tests that actually run, not pseudocode |
| **🔐 Security Hardener** | Audits and fixes CSRF, XSS, SQL injection, rate limiting, auth vulnerabilities | Produces working middleware code, not just a report |
| **📊 Performance Agent** | Profiles code, identifies bottlenecks, suggests and implements optimizations | Benchmarks before/after, proves the improvement |

#### 🚀 **Ship Agents** — Get it live

| Agent | What It Does | How It's Different |
|-------|-------------|-------------------|
| **☁️ Cloudflare Deploy** | Deploys to Workers + Pages + D1 + KV + R2 + Vectorize | One command: global edge deployment with database, cache, storage |
| **🐳 Docker Agent** | Generates Dockerfile, compose, K8s manifests | Production-grade multi-stage builds, not tutorial examples |
| **📖 Documentation** | Auto-generates README, API docs, architecture guides, changelogs | Stays in sync with code — updates when code changes |
| **💳 Billing Agent** | Scaffolds Stripe/LemonSqueezy integration with webhooks + subscription management | Generates working checkout flows, not boilerplate |

#### 🧠 **Intelligence Agents** — Make it smart

| Agent | What It Does | How It's Different |
|-------|-------------|-------------------|
| **🤖 AI Integration** | Wires up OpenAI/Anthropic/Google AI with proper prompt engineering | Handles streaming, retry logic, cost tracking, fallback providers |
| **📊 Analytics Agent** | Integrates PostHog/GA4 with custom event tracking plan | Produces a tracking spreadsheet AND the implementation code |
| **🍎 Apple HIG** | Converts any UI to Apple Human Interface Guidelines compliance | The only agent that knows HIG inside out |
| **📱 Mobile Generator** | Generates React Native/Expo cross-platform apps | Full app scaffold with navigation, auth, and API integration |

#### ⛓️ **Chain Agents** — Agents that call agents

This is the breakthrough feature. In LunaOS Studio (`studio.lunaos.ai`), you can build **agent chains** — workflows where one agent's output feeds into the next:

```
User: "Build me a SaaS for project management"
  │
  ├─→ 📋 Requirements Agent
  │     └─→ 🏛️ Design Architect
  │           └─→ 💻 Code Generator
  │                 └─→ 🧪 Testing Agent
  │                       └─→ 🔍 Code Review
  │                             └─→ 📖 Documentation
  │                                   └─→ ☁️ Cloudflare Deploy
  │
  └─→ Result: Deployed app at your-app.pages.dev
       Time: 2-4 hours (not 2-4 months)
```

The visual Studio (`studio.lunaos.ai`) has a drag-and-drop canvas where you connect agent nodes with Three.js particle effects. It's built, it works, and it looks incredible.

---

## Part III: The Unfair Advantages

### 1. On-Device AI (The Enterprise Unlock)

Every competitor requires sending code to the cloud. Every CISO at every Fortune 500 says no.

LunaOS includes **Nexa SDK** — a complete local inference engine:

```
┌─────────────────────────────────────────────┐
│  Enterprise Customer's Machine              │
│                                             │
│  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Luna CLI      │  │ Nexa SDK            │ │
│  │               │  │                     │ │
│  │ luna run      │──│ /v1/chat/completions│ │
│  │ code-review   │  │ /v1/embeddings      │ │
│  │               │  │ /v1/images          │ │
│  │               │  │                     │ │
│  │               │  │ Runs: Llama, Mistral│ │
│  │               │  │ GGUF / MLX models   │ │
│  │               │  │ Multi-GPU + NPU     │ │
│  └──────────────┘  └─────────────────────┘ │
│                                             │
│  Nothing leaves this box. Ever.             │
└─────────────────────────────────────────────┘
```

**No other multi-agent platform offers this.** Copilot, Cursor, Devin, Replit — all cloud-only.

This unlocks the entire enterprise market: banks, defense, healthcare, government — anyone with data sovereignty requirements.

### 2. MCP-Native (The Distribution Hack)

LunaOS agents speak **Model Context Protocol** natively. That means they work inside:

- **Claude** (Anthropic's IDE)
- **Cursor** (the fastest-growing IDE)
- **Windsurf** (Codeium's IDE)
- **Zed** (the new performance king)
- **VS Code** (via extension)
- **Any future MCP-compatible tool**

You don't need to convince developers to switch IDEs. LunaOS works **inside the IDE they already use**. That's the distribution hack — we ride every IDE's growth instead of competing with them.

### 3. Open Core (The Community Engine)

The agent personas (markdown files), the CLI, and the visual Studio are **open source**. The engine (RAG, agent management, billing, plugins) is **proprietary**.

```
Open Source (MIT):                    Proprietary:
├── luna-agents/                      ├── claude-agent/ (the engine)
│   ├── 20+ agent personas           │   ├── RAG engine
│   ├── MCP server                   │   ├── Agent management
│   └── CLI tool                     │   ├── Plugin system
├── lunaos-studio/                    │   ├── Billing + auth
│   └── Visual workflow builder       │   └── Database + migrations
└── Marketing site                    └── Enterprise features
```

This is the **WordPress model**: the core is open, the hosting is paid. WordPress powers 43% of the internet. Nobody competes with WordPress — they build ON WordPress.

When developers contribute new agent personas to `luna-agents/`, the platform gets better. When they share workflow templates in Studio, everyone benefits. The community builds the product.

### 4. The Visual Studio (The Demo Magnet)

`studio.lunaos.ai` is a **Three.js-powered visual workflow builder** with:
- Glassmorphism node design
- Particle effect backgrounds
- Drag-and-drop agent chains
- Real-time execution visualization
- Voice control ("create a code review node")
- 10+ pre-built workflow templates
- Collaboration (multiple users editing)

This is the **demo that sells the product**. When you show a CTO a visual canvas where agents connect to form an autonomous pipeline, with particles flowing between nodes as they execute — that's a signed contract.

No competitor has anything like this. Devin is a chat box. Cursor is autocomplete. v0 is a form. LunaOS Studio makes AI development **visual, beautiful, and intuitive**.

### 5. The OpenHands Foundation (The Quality Floor)

Our agents are built on **OpenHands** — the highest-scoring open-source AI coding agent (77.6% SWE-Bench). We don't build AI from scratch. We specialize proven AI.

We've already forked OpenHands and created 5 domain-specific agents:
- **DevSecOps Guardian** — security scanning + auto-fix
- **TestCraft AI** — test generation with coverage guarantee
- **Documentation Dynamo** — auto-maintains docs
- **API Builder Pro** — natural language → production API
- **Code Review Agent** — instant PR review

Each agent inherits OpenHands' problem-solving ability and adds domain expertise through custom prompts, tools, and evaluation harnesses.

---

## Part IV: The Business

### Revenue Model

| Tier | Price | Who | What They Get |
|------|-------|-----|---------------|
| **🆓 Community** | $0 | Individual devs, open source contributors | CLI + 6 core agents + community Studio + 100 runs/month |
| **⚡ Pro** | $29/mo | Freelancers, indie hackers | All 20+ agents + Cloud RAG + 10K API calls/mo + priority queue |
| **🏢 Team** | $79/seat/mo | Startups (5-50 devs) | Shared workspaces + team analytics + SSO + agent chains + API keys |
| **🏛️ Enterprise** | Custom ($5K+/mo) | Mid-market & enterprise | On-premise (Nexa) + VPC + SOC2 + custom agents + dedicated CSM |

### Unit Economics

```
Pro subscriber:
  Revenue:           $29/month
  LLM cost:          ~$3/month (OpenAI/Anthropic, amortized across usage limits)
  Cloudflare infra:  ~$0.50/month (Workers, KV, Vectorize — extremely efficient)
  Support:           ~$0 (self-serve, docs)
  ─────────────────────────────
  Gross Margin:      ~88%

Enterprise customer:
  Revenue:           $5,000-20,000/month
  LLM cost:          $0 (they run Nexa on-premise)
  Infra:             $0 (they host it)
  Support:           ~$500/month (dedicated CSM)
  ─────────────────────────────
  Gross Margin:      ~90-97%
```

### Growth Projections

| Milestone | Timeline | Metrics |
|-----------|----------|---------|
| **MVP Live** | Week 8 | 5 subdomains live, 6 agents functional, CLI published |
| **Product Hunt Launch** | Week 10 | Top 5 of the day, 500 signups, 300 GitHub stars |
| **First Dollar** | Month 3 | 20 Pro subscribers, $580 MRR |
| **Product-Market Fit** | Month 6 | 100 Pro + 30 Team seats, $5K MRR, <5% monthly churn |
| **Growth Mode** | Month 12 | 500 Pro + 200 Team + 3 Enterprise, $45K MRR, $540K ARR |
| **Series A Ready** | Month 18 | 2K Pro + 500 Team + 10 Enterprise, $200K+ MRR, $2.4M ARR |

### Why Investors Will Care

1. **$200B TAM**: The developer tools market is massive and growing 25% YoY
2. **88% gross margins**: SaaS economics with near-zero marginal cost
3. **Open-source distribution**: Community drives adoption, enterprise drives revenue
4. **On-device moat**: Only platform that serves enterprise data sovereignty requirements
5. **Multi-product platform**: Not a feature — a platform where agents are apps
6. **Proven technology**: Built on OpenHands (77.6% SWE-Bench), not research projects

---

## Part V: The Build Plan

### Phase 0: "Wire It Up" (Week 1-2)

**Goal**: Get all 6 subdomains live with real, deployed code.

| Day | Tasks | Deliverable |
|-----|-------|-------------|
| **Day 1** | Bootstrap monorepo (`pnpm install`), delete `worker-standalone.ts`, remove `nexa-backend/` source, provision PostgreSQL, run `prisma migrate deploy` | Dev environment works |
| **Day 2** | Set up Cloudflare DNS for all subdomains, deploy `luna-os-ai/website/` → `lunaos.ai`, deploy `lunaos-studio/` → `studio.lunaos.ai` | 3 subdomains live |
| **Day 3** | Implement JWT auth in Hono worker, merge OpenHands AI Engine LLM client, connect Cloudflare KV + Vectorize | Auth works, vector search works |
| **Day 4** | Deploy API Worker → `api.lunaos.ai`, deploy Next.js dashboard → `agents.lunaos.ai`, wire Studio → API | 5 subdomains live |
| **Day 5** | Build `POST /agents/:id/execute`, load persona → inject system prompt → call LLM → stream response | **🎉 First agent execution on production** |
| **Day 6-7** | RAG pipeline: scan files → chunk → embed → store in Vectorize → semantic search endpoint | RAG search works |
| **Day 8-10** | Polish auth flow (signup → login → dashboard), fix UI issues, test cross-subdomain cookies | End-to-end user flow works |

**Phase 0 ships**: `lunaos.ai` (marketing), `agents.lunaos.ai` (dashboard), `api.lunaos.ai` (API), `studio.lunaos.ai` (visual builder) — all live and connected.

### Phase 1: "Make Agents Real" (Week 3-4)

**Goal**: 6 core agents actually run and produce real output.

| Task | Details | Days |
|------|---------|------|
| Agent execution engine | Load persona markdown → build system prompt → call OpenAI/Anthropic → stream SSE response → save to DB | 3 |
| Wire OpenHands agents | Import DevSecOps Guardian, TestCraft, DocDynamo, CodeReview from fork → run via agent execution engine | 3 |
| Luna CLI (`@luna-agents/cli`) | `luna init`, `luna run <agent>`, `luna deploy`, `luna status`, `luna serve`, `luna studio` | 3 |
| GitHub Integration | OAuth → connect repo → auto-index codebase into RAG → agents can search your code | 2 |
| Agent Dashboard UI | List agents, trigger run, view streaming output, execution history, download reports | 2 |
| Studio ↔ API wiring | Save/load workflows, execute agent nodes, show real-time status in Studio | 2 |

**Phase 1 ships**: A developer can `luna init` → `luna run code-review` and get a real code review. They can open Studio and visually chain agents.

### Phase 2: "Make It Commercial" (Week 5-6)

**Goal**: Revenue infrastructure. Free → Pro → Team upgrade path.

| Task | Details | Days |
|------|---------|------|
| Stripe integration | Checkout session, webhook handler, subscription management → wire to Prisma billing models | 3 |
| Usage metering | Track agent executions, RAG queries, API calls per user → enforce tier limits | 2 |
| API key management | Generate/revoke API keys from dashboard → key-based auth middleware | 1 |
| Agent Marketplace page | Browse all agents, descriptions, ratings, Pro badge → gating logic | 3 |
| Onboarding wizard | Detect framework → connect repo → pick agents → first run → upgrade prompt | 2 |
| Email transactional (Resend) | Welcome, usage alerts, upgrade nudges, weekly digest | 1 |
| Local inference (Nexa) path | `luna serve` starts Nexa locally → `luna run --local code-review` routes to local LLM | 2 |

**Phase 2 ships**: Users can sign up free, upgrade to Pro via Stripe, generate API keys, and run agents locally.

### Phase 3: "Make It Viral" (Week 7-8)

**Goal**: Public launch with maximum impact.

| Task | Details | Days |
|------|---------|------|
| Landing page polish | Real screenshots, real demo GIFs, real metrics. Remove all placeholder content. | 2 |
| Documentation site → `docs.lunaos.ai` | VitePress: getting started, agent catalog, API reference, tutorials | 3 |
| Product Hunt launch | Use existing launch assets, schedule for Tuesday 12:01 AM PT | 1 |
| VS Code extension | Wrap Luna CLI → one-click agent runs from editor, output in panel | 3 |
| GLM Reasoning Visualizer | React Flow visualization of agent thinking chains → demo magnet | 2 |
| Status page → `status.lunaos.ai` | Uptime monitoring for all services | 0.5 |
| Community Discord | Agent channels, showcase channel, bot that posts run results | 0.5 |
| Security hardening | SOC2 prep: audit logging, encryption, GDPR consent flows, rate limit testing | 2 |

**Phase 3 ships**: Product Hunt launch. Docs live. VS Code extension in marketplace. All 6 subdomains operational.

---

## Part VI: Post-Launch — The Platform Play

### Q3 2026: Autonomous Agent Chains

The Studio (`studio.lunaos.ai`) evolves from "visual builder" to **autonomous execution engine**:

- Agents trigger other agents automatically based on output
- The DAG engine (already built in `workflow-engine.js`) handles execution ordering
- Users create "recipes" — saved agent chains that run on triggers (push to main, PR opened, cron)
- **This is the "GitHub Actions for AI Agents" moment**

### Q3 2026: Agent Store

Open the platform to third-party agent developers:

- Anyone can publish an agent persona (markdown + tools definition)
- Quality review process using the Plugin compatibility system
- Revenue share: 70% to developer, 30% to platform
- Categories: Frontend, Backend, DevOps, Security, Mobile, Data
- **This is the "App Store for AI Agents" moment**

### Q4 2026: Luna Mobile

Build a React Native app using Nexa SDK's Swift bindings:

- Run agents on your phone
- Code review during your commute
- On-device inference — no internet needed
- Push notifications when agent chains complete

### Q4 2026: Enterprise Platform

Full enterprise readiness:

- Multi-tenant workspaces (Prisma `Project` model)
- SSO/SAML (auth model has `ssoProvider`, `mfaEnabled`)
- On-premise deployment (Docker + Nexa, infrastructure from `luna-os-ai`)
- Custom agent builder — enterprises create proprietary agents
- Audit trail — every execution logged (`AuditLog` model)
- Compliance: SOC2 Type II, GDPR, HIPAA-ready

### 2027: The Operating System

The endgame is in the name: **LunaOS** — an operating system for software development.

```
2026: LunaOS is a tool (you run agents)
2027: LunaOS is a platform (agents run for you)
2028: LunaOS is an OS (agents build, deploy, monitor, and maintain your entire stack)
```

In 2028, you describe a product and LunaOS builds it, deploys it, monitors it, fixes bugs automatically, updates documentation, handles customer support tickets, and scales infrastructure — while you sleep.

That's not science fiction. Every component already exists in our repos:
- Agent execution engine ✅
- Agent chains ✅ (Studio)
- RAG for understanding code ✅
- Security hardening ✅
- Auto-deployment ✅
- On-device inference ✅
- Visual orchestration ✅

We just need to wire them together.

---

## Part VII: The Competitive Kill Sheet

### vs. GitHub Copilot ($19/mo, 1.8M users)

| | Copilot | LunaOS |
|---|---------|--------|
| **What it does** | Autocompletes code in your IDE | Runs 20+ specialized agents across the entire SDLC |
| **Architecture** | Single model, code completion | Multi-agent, task-specific specialists |
| **Deployment** | None | One-command global edge deployment |
| **Testing** | None | Generates and runs full test suites |
| **Security** | None | OWASP-aligned security auditing + auto-fix |
| **Works offline** | No | Yes (Nexa SDK) |
| **Visual builder** | No | Three.js agent chain studio |
| **Open source** | No | Agent personas + Studio are MIT |

**Attack vector**: "Copilot helps you type. LunaOS helps you ship."

### vs. Cursor ($20/mo, fastest-growing IDE)

| | Cursor | LunaOS |
|---|--------|--------|
| **What it does** | AI-powered IDE with chat | AI agent platform with 20+ specialists |
| **Lock-in** | Must use Cursor IDE | Works in ANY MCP-compatible IDE including Cursor |
| **Agents** | 1 general agent | 20+ domain specialists |
| **Deployment** | None | Built-in |
| **Visual builder** | No | `studio.lunaos.ai` |
| **On-device** | No (cloud-only) | Yes (Nexa SDK) |

**Attack vector**: "LunaOS works INSIDE Cursor via MCP. You don't have to choose."

### vs. Devin ($500/mo)

| | Devin | LunaOS |
|---|-------|--------|
| **Price** | $500/mo | $29/mo Pro, $0 free tier |
| **Transparency** | Black box | Open agent personas, visual reasoning (GLM viz) |
| **Offline** | No | Yes |
| **IDE integration** | No (web only) | MCP + CLI + VS Code + web |
| **Visual builder** | No | Three.js Studio |
| **Community** | Closed | Open source agents + marketplace |

**Attack vector**: "17x cheaper, transparent, runs offline, works in your IDE."

### vs. Bolt.new / v0 (Vercel)

| | Bolt / v0 | LunaOS |
|---|-----------|--------|
| **What it does** | Generates UI prototypes | Generates and deploys full-stack applications |
| **Output quality** | Prototypes (not production) | Production-grade with tests, security, docs |
| **Deployment** | Platform-locked | Deploys to Cloudflare (or any cloud) |
| **Agent chains** | No | Visual drag-and-drop chains |
| **Enterprise** | No | SOC2, on-premise, SSO |

**Attack vector**: "Bolt makes demos. LunaOS makes products."

---

## Part VIII: Repo Organization — The Foundation

Before building anything, we organize. Right now `claude-agent` is a monolith holding everything. The first job is breaking it apart into focused repos with clear ownership.

### Current State (The Mess)

```
claude-agent/                  ← MONOLITH #1: has everything jammed together
├── apps/web/                  ← Next.js dashboard (should be its own repo)
├── apps/luna-marketing/       ← Marketing site (should be its own repo)
├── apps/cli/                  ← CLI tool (should live in luna-agents)
├── packages/api/              ← Hono API worker (this IS the engine repo)
├── packages/rag/              ← RAG engine (stays with API)
├── packages/agents/           ← Agent management (stays with API)
├── packages/database/         ← Prisma schema (stays with API)
├── packages/gateway/          ← API gateway (stays with API)
├── packages/cache/            ← Cache layer (stays with API)
├── packages/messaging/        ← Message queue (stays with API)
├── packages/monitoring/       ← Monitoring (stays with API)
├── packages/shared/           ← Shared types (stays with API)
├── packages/types/            ← Type definitions (stays with API)
├── nexa-backend/              ← Full Nexa SDK source — 152 files! (should be a reference)
├── docs/                      ← 50 files of documentation (should be its own repo)
├── monitoring/                ← Grafana/Prometheus configs (should be in infra/ops)
├── docker-compose*.yml        ← Docker configs (goes with API or separate infra repo)
├── content/                   ← Marketing content (goes with marketing repo)
├── LUNAOS_MASTER_PLAN.md      ← This file (stays as meta)
└── (20+ config files)

luna-os-ai/                    ← MONOLITH #2: even worse — 140 root files!
├── apps/
│   ├── mobile-app/            ← 163 files! Full Expo/React Native app (→ lunaos-mobile)
│   ├── orchestrator-gui/      ← 33 files, orchestrator GUI (→ reference for Studio)
│   ├── dashboard-ui/          ← Dashboard UI (→ reference for lunaos-dashboard)
│   ├── agent-runtime/         ← Agent runtime (→ reference for lunaos-engine)
│   ├── orchestrator/          ← Backend orchestrator (→ reference for lunaos-engine)
│   └── plugin-gateway/        ← Plugin gateway (→ reference for lunaos-engine)
├── lunaos/                    ← 209 files — full Python BaaS
│   ├── agents/                ← Agent system (→ reference for lunaos-engine)
│   ├── ai/                    ← AI module (17 files)
│   ├── api/                   ← REST API (45 files)
│   ├── auth/                  ← Auth system (18 files)
│   ├── billing/               ← Billing
│   ├── cache/                 ← Cache layer (7 files)
│   ├── core/                  ← Core framework (34 files)
│   ├── db/                    ← Database (22 files)
│   ├── memory/                ← Memory system (8 files)
│   ├── observability/         ← Monitoring (9 files)
│   ├── plugins/               ← Plugin system
│   ├── storage/               ← File storage
│   └── workflows/             ← Workflow engine (6 files)
├── website/                   ← 70 files — marketing site (→ lunaos-marketing)
│   ├── index.html             ← Landing page
│   ├── pricing.html           ← Pricing
│   ├── investors.html         ← Investor page
│   ├── studio/                ← 41 files — another copy of Studio!
│   └── (many duplicate/unfinished pages)
├── sdk/                       ← 10 files — Python SDK
├── infra/                     ← 31 files — deployment configs (→ lunaos-infra)
├── k8s/                       ← 5 files — Kubernetes manifests (→ lunaos-infra)
├── workers/                   ← 4 files — Cloudflare Workers (→ reference for lunaos-engine)
├── 60+ markdown docs          ← START_HERE, START_NOW, QUICK_START, DEPLOY_NOW, etc.
├── venv/                      ← 5,718 files! Checked into git!
├── investor-landing.html      ← Standalone investor page (→ lunaos-marketing)
└── Various images, PDFs, logs

luna-agents/                   ← Already separate ✅ (agent personas + MCP)
lunaos-studio/                 ← Already separate ✅ (visual workflow builder)
OpenHands/                     ← Already separate ✅ (fork with specialized agents)
```

**Summary: Two monoliths** (`claude-agent` + `luna-os-ai`) need to be decomposed. The other 3 repos are already clean.

### Target State (10 Repos, Clean Boundaries)

Every repo has **one job**, deploys independently, and talks to others only via API.

```
GitHub Org: lunaos-ai/
├─────────────────────────────────────────────────────────────────────────────┤

1. lunaos-engine          🔒 Private    ← The brain (Hono API + RAG + plugins + DB)
2. lunaos-dashboard       🌍 Public     ← Next.js web app → agents.lunaos.ai
3. lunaos-marketing       🌍 Public     ← Landing + pricing + investor page → lunaos.ai
4. lunaos-studio          🌍 Public     ← Visual workflow builder → studio.lunaos.ai
5. luna-agents            🌍 Public     ← Agent personas + CLI + MCP server
6. lunaos-docs            🌍 Public     ← VitePress documentation → docs.lunaos.ai
7. lunaos-mobile          🔒 Private    ← React Native / Expo app (future)
8. OpenHands              🌍 Public     ← Fork with 5 specialized agents
9. nexa-sdk               🌍 Public     ← Fork/reference — on-device inference
10. lunaos-infra          🔒 Private    ← Docker, Terraform, monitoring, CI/CD configs
```

### Detailed Repo Breakdown

#### 1. `lunaos-engine` 🔒 (The Brain)
**Deploys to**: `api.lunaos.ai` (Cloudflare Workers)  
**Source from**: `claude-agent/packages/*` + `openhands-ai-engine/`

```
lunaos-engine/
├── src/
│   ├── api/           ← Hono routes (/auth, /agents, /rag, /billing, /plugins, /studio)
│   ├── agents/        ← Agent execution engine, lifecycle management
│   ├── rag/           ← Embedding, chunking, vector search, evaluation
│   ├── plugins/       ← Plugin registry, sandbox, hot-reload
│   ├── auth/          ← JWT, OAuth, API keys, session management
│   ├── billing/       ← Stripe integration, usage metering, subscriptions
│   ├── database/      ← Prisma schema + migrations
│   ├── cache/         ← KV cache layer
│   ├── messaging/     ← Queue (background jobs)
│   ├── gateway/       ← Rate limiting, CORS, middleware
│   └── shared/        ← Types, utilities, constants
├── prisma/
│   └── schema.prisma  ← The 860-line database schema
├── wrangler.toml      ← Cloudflare Worker config
├── package.json
└── tsconfig.json
```

**What stays**: Everything in `claude-agent/packages/*`  
**What goes**: `apps/`, `nexa-backend/`, `docs/`, `content/`, marketing files  
**What comes in**: `openhands-ai-engine/src/services/*` (LLM client, connector generator)

---

#### 2. `lunaos-dashboard` 🌍 (The Web App)
**Deploys to**: `agents.lunaos.ai` (Cloudflare Pages)  
**Source from**: `claude-agent/apps/web/`

```
lunaos-dashboard/
├── app/               ← Next.js 14 App Router
│   ├── (auth)/        ← Login, signup pages
│   ├── dashboard/     ← Main dashboard
│   ├── agents/        ← Agent management, execution UI
│   ├── marketplace/   ← Agent marketplace
│   ├── settings/      ← User settings, API keys
│   ├── billing/       ← Subscription management
│   └── analytics/     ← Usage analytics
├── components/        ← Shared React components
├── lib/               ← API client (calls api.lunaos.ai)
├── public/
├── package.json
└── next.config.js
```

**What it does**: Purely a frontend. All data comes from `api.lunaos.ai`.  
**Zero backend logic** — the dashboard is a client to the engine.

---

#### 3. `lunaos-marketing` 🌍 (The Landing Page)
**Deploys to**: `lunaos.ai` root (Cloudflare Pages)  
**Source from**: `luna-os-ai/website/` + `claude-agent/apps/luna-marketing/` + `claude-agent/content/`

```
lunaos-marketing/
├── index.html         ← Main landing page
├── pricing.html       ← Pricing tiers
├── investors.html     ← Investor one-pager
├── contact.html       ← Contact / get started form
├── demo.html          ← Interactive agent demo
├── css/               ← Styles
├── js/                ← Minimal JS
├── assets/            ← Images, logos, icons
├── sitemap.xml
├── robots.txt
└── _redirects         ← Cloudflare Pages redirects
```

**What it does**: Static marketing site. No framework needed — pure HTML/CSS/JS.  
**Merges content from**: `luna-os-ai/website/` (best pages) + `claude-agent/apps/luna-marketing/` (product hunt assets) + `claude-agent/content/` (social posts)

---

#### 4. `lunaos-studio` 🌍 (The Visual Builder) — Already exists ✅
**Deploys to**: `studio.lunaos.ai` (Cloudflare Pages)  
**Repo**: Already at `/Users/shaharsolomon/dev/projects/08_open_source/lunaos-studio`

No changes needed — just deploy. It calls `api.lunaos.ai` at runtime for agent execution.

---

#### 5. `luna-agents` 🌍 (The Agent Personas + CLI) — Already exists ✅
**Deploys to**: npm (`@luna-agents/cli`)  
**Repo**: Already at `/Users/shaharsolomon/dev/projects/02_AI_AGENTS/luna-agents`

```
luna-agents/
├── commands/          ← 20+ agent persona markdowns
├── cli/               ← Luna CLI (luna init, run, deploy, serve, studio)
├── mcp/               ← MCP server implementation
├── README.md
└── package.json
```

May absorb `claude-agent/apps/cli/` if CLI code is there.

---

#### 6. `lunaos-docs` 🌍 (The Documentation)
**Deploys to**: `docs.lunaos.ai` (Cloudflare Pages)  
**Source from**: `claude-agent/docs/` (50 files) + new VitePress config

```
lunaos-docs/
├── docs/
│   ├── getting-started/    ← Quick start, installation
│   ├── agents/             ← Agent catalog with examples
│   ├── api-reference/      ← REST API docs (auto-generated from Hono)
│   ├── studio/             ← Visual builder guide
│   ├── cli/                ← CLI reference
│   ├── enterprise/         ← On-premise, SSO, compliance
│   └── tutorials/          ← Step-by-step guides
├── .vitepress/
│   └── config.ts
└── package.json
```

---

#### 7. `lunaos-mobile` 🔒 (Future — Mobile App)
**Deploys to**: App Store + Google Play  
**Timeline**: Q4 2026 (Phase 6)

```
lunaos-mobile/
├── app/               ← Expo / React Native
├── ios/               ← iOS native (Nexa Swift bindings)
├── android/           ← Android native
└── package.json
```

---

#### 8. `OpenHands` 🌍 (The AI Brain) — Already exists ✅
**Repo**: Already at `/Users/shaharsolomon/dev/projects/08_open_source/OpenHands`

Stays as a fork. Custom agents are added as subdirectories:
- `devsecops-guardian/`
- `testcraft-ai/`
- `documentation-dynamo/`
- `api-builder-pro/`
- `code-review-agent/`
- `openhands-ai-engine/` ← services merge into `lunaos-engine`

---

#### 9. `nexa-sdk` 🌍 (On-Device Inference) — Reference only
**Current problem**: Full Nexa source (152 files) is embedded inside `claude-agent/nexa-backend/`.  
**Solution**: Delete from `claude-agent`. Reference as external dependency.

```
# In lunaos-engine, reference via script:
scripts/start-nexa.sh  ← Downloads and starts Nexa locally

# In luna-agents CLI:
luna serve  ← Starts local Nexa server for offline mode
```

---

#### 10. `lunaos-infra` 🔒 (DevOps & Monitoring)
**Source from**: `claude-agent/docker-compose*.yml`, `claude-agent/monitoring/`, `luna-os-ai/` Docker configs

```
lunaos-infra/
├── docker/
│   ├── docker-compose.yml         ← Production stack
│   ├── docker-compose.dev.yml     ← Development stack
│   └── Dockerfile                 ← Engine container
├── terraform/
│   └── cloudflare/                ← DNS, Workers, Pages config as code
├── monitoring/
│   ├── prometheus/                ← Metrics collection
│   └── grafana/                   ← Dashboards
├── ci/
│   └── github-actions/            ← Shared CI/CD workflows
└── scripts/
    ├── deploy-all.sh              ← Deploy all subdomains
    └── setup-dns.sh               ← Configure Cloudflare DNS
```

---

### Open Source Strategy

| Repo | Visibility | Why |
|------|:---:|-----|
| `lunaos-engine` | 🔒 Private | This is the IP — RAG, plugins, billing, auth. Revenue comes from hosting this. |
| `lunaos-dashboard` | 🌍 Public | Attracts contributors, builds trust. Dashboard is useless without the engine. |
| `lunaos-marketing` | 🌍 Public | SEO, transparency. Marketing sites should be inspectable. |
| `lunaos-studio` | 🌍 Public | **Key community asset.** Developers contribute workflow templates + node types. |
| `luna-agents` | 🌍 Public | **The main open-source draw.** Developers contribute new agent personas. |
| `lunaos-docs` | 🌍 Public | Obviously — docs should be community-editable. |
| `lunaos-mobile` | 🔒 Private | Contains proprietary Nexa integration logic. |
| `OpenHands` | 🌍 Public | It's a fork of MIT-licensed project. Must stay public. |
| `nexa-sdk` | 🌍 Public | Reference/fork, not our code. |
| `lunaos-infra` | 🔒 Private | Contains secrets patterns, deployment configs. |

### Migration Plan (Day 0 — Before Building Anything)

This is the FIRST thing we do. Before writing a single line of new code:

```
Step 1: Create GitHub org "lunaos-ai"
Step 2: Create these repos:
        lunaos-engine (from claude-agent/packages/*)
        lunaos-dashboard (from claude-agent/apps/web/)
        lunaos-marketing (merge luna-os-ai/website/ + claude-agent/apps/luna-marketing/)
        lunaos-docs (from claude-agent/docs/)
        lunaos-infra (from claude-agent/docker-compose*.yml + monitoring/)
Step 3: Transfer/rename existing repos into the org:
        lunaos-studio → lunaos-ai/lunaos-studio
        luna-agents → lunaos-ai/luna-agents
        OpenHands → lunaos-ai/OpenHands (or keep as personal fork)
Step 4: Clean up claude-agent:
        Delete nexa-backend/ (152 files)
        Delete apps/web/ (moved to lunaos-dashboard)
        Delete apps/luna-marketing/ (moved to lunaos-marketing)
        Delete docs/ (moved to lunaos-docs)
        Delete docker-compose*.yml (moved to lunaos-infra)
        What remains IS lunaos-engine — rename repo
Step 5: Set up Cloudflare DNS for lunaos.ai subdomains
Step 6: Deploy each repo to its subdomain
```

### The Final Map

| # | Repo | Subdomain | Deploy Target | Stack |
|---|------|-----------|---------------|-------|
| 1 | `lunaos-engine` | `api.lunaos.ai` | Cloudflare Workers | TypeScript, Hono, Prisma |
| 2 | `lunaos-dashboard` | `agents.lunaos.ai` | Cloudflare Pages | Next.js 14 |
| 3 | `lunaos-marketing` | `lunaos.ai` | Cloudflare Pages | Static HTML/CSS/JS |
| 4 | `lunaos-studio` | `studio.lunaos.ai` | Cloudflare Pages | Vite, Three.js, Konva |
| 5 | `luna-agents` | npm registry | npm publish | TypeScript, Commander.js |
| 6 | `lunaos-docs` | `docs.lunaos.ai` | Cloudflare Pages | VitePress |
| 7 | `lunaos-mobile` | App stores | App Store, Play Store | React Native / Expo |
| 8 | `OpenHands` | — | Docker / pip | Python |
| 9 | `nexa-sdk` | — | Reference | Go, Swift, C++ |
| 10 | `lunaos-infra` | `status.lunaos.ai` | Cloudflare Workers | Terraform, Docker |

---

## Part IX: Why This Will Work

### 1. The Market Is Ready
AI coding tools went from novelty to necessity in 2024-2025. Every developer uses one. But they've all plateau'd at code completion. The market is screaming for the next evolution — and multi-agent SDLC automation is it.

### 2. The Technology Is Ready
OpenHands proved agents can solve real engineering problems (77.6% SWE-Bench). Nexa proved on-device inference is viable. MCP proved agents can be protocol-native. Three.js proved developer tools can be beautiful. We're assembling proven technologies, not inventing new ones.

### 3. The Code Is Ready
115K+ lines across 6 repos. The RAG engine works. The agents exist. The Studio is built. The website is designed. The database schema is written. We need 15% new code and 85% wiring.

### 4. The Brand Is Ready
`lunaos.ai` — a memorable, clean domain. The Luna brand (inspired by a one-eyed rescue cat) has warmth and character in a market full of cold, corporate products. The calico palette, crescent mark, and futuristic warm UI are distinctive.

### 5. The Moat Is Deep
- **On-device inference**: Takes months to build, we have Nexa
- **5 specialized agents**: Each one is weeks of custom prompt engineering
- **Visual Studio**: 10K+ lines of Three.js/Konva code
- **Plugin system**: Sandbox execution, hot reload, compatibility
- **RAG engine**: Custom embeddings, chunking, evaluation pipeline
- **Open source community**: Once it grows, it compounds

### 6. The Timing Is Perfect
- GitHub Copilot is stagnating (features haven't changed in a year)
- Cursor is growing but IDE-locked
- Devin is expensive and opaque
- Replit is pivoting away from agents
- **Nobody owns "multi-agent + on-device + visual builder"**

---

## Part X: The One-Liner

When someone asks "What is LunaOS?", the answer is:

> **"LunaOS is an open AI agent platform that gives every developer a team of 20+ AI specialists — from code review to deployment — running on Cloudflare's edge or 100% on your machine."**

When a VC asks "Why should I invest?":

> **"We're building the operating system for AI-powered software development. 115K lines of code across 6 repos, all under lunaos.ai. Open core model with 88% margins. The only platform that's multi-agent, on-device, and visually orchestrated. We're two months from launch."**

When a developer asks "Why should I try it?":

```bash
npm install -g @luna-agents/cli
luna init
luna run code-review
# Your mind is now blown. Welcome to the future.
```

---

*This is the plan. Let's build it.*

---

*LunaOS — The AI Development Crew*  
*lunaos.ai*  
*February 7, 2026*
