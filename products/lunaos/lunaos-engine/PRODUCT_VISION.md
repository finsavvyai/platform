# 🌙 LunaOS — Product Vision & Build Plan

### The Honest Version

**Date**: February 7, 2026
**Status**: Post-cleanup, pre-build
**Domain**: `lunaos.ai`

---

## What LunaOS IS (One Sentence)

**An open-source platform of 20+ AI coding agents that work inside any IDE via MCP, orchestrated visually, with an optional cloud engine for teams.**

Not a code completion tool. Not a single-purpose chatbot. A coordinated team of specialist AI agents that handle the full software development lifecycle — requirements → design → code → review → test → deploy → document.

---

## The Product Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        lunaos.ai                                │
│                                                                 │
│  SURFACES (how users interact):                                 │
│                                                                 │
│  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌──────┐ ┌─────────┐  │
│  │ CLI     │ │ MCP       │ │ Studio   │ │ Web  │ │ API     │  │
│  │         │ │ Protocol  │ │          │ │ App  │ │         │  │
│  │ luna    │ │           │ │ Visual   │ │      │ │ REST +  │  │
│  │ run     │ │ Works in: │ │ workflow │ │ Dash │ │ Stream  │  │
│  │ review  │ │ Claude    │ │ builder  │ │ board│ │         │  │
│  │ test    │ │ Cursor    │ │          │ │      │ │ api.    │  │
│  │ deploy  │ │ Windsurf  │ │ studio.  │ │agents│ │ lunaos  │  │
│  │         │ │ Zed       │ │ lunaos   │ │.luna │ │ .ai     │  │
│  │ npm     │ │ VS Code   │ │ .ai      │ │os.ai │ │         │  │
│  └────┬────┘ └─────┬─────┘ └────┬─────┘ └──┬──┘ └────┬────┘  │
│       │             │            │           │         │        │
│       └─────────────┴────────────┴───────────┴─────────┘        │
│                              │                                  │
│  ENGINE (what powers it):    ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  lunaos-engine                            │   │
│  │                                                          │   │
│  │  • Agent Execution (load persona → LLM → stream result) │   │
│  │  • RAG (index code → embed → vector search)             │   │
│  │  • Auth (JWT + API keys + OAuth)                         │   │
│  │  • Billing (Stripe/LemonSqueezy)                         │   │
│  │  • Workflow Orchestration (agent chains)                  │   │
│  │                                                          │   │
│  │  Cloudflare Workers + D1 + KV + Vectorize + Queues       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## The 28 Agents (What We Have Today)

### 🏗️ Build Agents (idea → code)

| # | Agent | File | Status | What It Does |
|---|-------|------|--------|-------------|
| 1 | Requirements Analyzer | `luna-requirements-analyzer.md` | ✅ Ready | Vague idea → structured spec with user stories, acceptance criteria |
| 2 | Design Architect | `luna-design-architect.md` | ✅ Ready | Spec → technical design, API contracts, DB schema |
| 3 | Task Planner | `luna-task-planner.md` | ✅ Ready | Design → ordered implementation plan with dependencies |
| 4 | Task Executor | `luna-task-executor.md` | ✅ Ready | Implementation plan → production code, file by file |
| 5 | API Generator | `luna-api-generator.md` | ✅ Ready | Natural language → REST/GraphQL API scaffold |
| 6 | Vision RAG | `luna-glm-vision.md` | ✅ Ready | Screenshot → component breakdown → matching code |

### 🛡️ Quality Agents (make it bulletproof)

| # | Agent | File | Status | What It Does |
|---|-------|------|--------|-------------|
| 7 | Code Review | `luna-code-review.md` | ✅ Ready | Bugs, security flaws, performance issues, anti-patterns |
| 8 | Testing & Validation | `luna-testing-validation.md` | ✅ Ready | Generate unit/integration/E2E test suites |
| 9 | UI Test | `luna-ui-test.md` | ✅ Ready | Visual regression, accessibility, responsive testing |
| 10 | UI Fix | `luna-ui-fix.md` | ✅ Ready | Diagnose and fix UI issues |
| 11 | Security (365) | `luna-365-security.md` | ✅ Ready | OWASP audit, vulnerability scanning, auto-fix |
| 12 | Auth | `luna-auth.md` | ✅ Ready | Authentication system implementation |

### 🚀 Ship Agents (get it live)

| # | Agent | File | Status | What It Does |
|---|-------|------|--------|-------------|
| 13 | Cloudflare Deploy | `luna-cloudflare.md` | ✅ Ready | One-command Workers + Pages + D1 + KV deployment |
| 14 | Docker | `luna-docker.md` | ✅ Ready | Dockerfile, compose, K8s manifests |
| 15 | Deployment | `luna-deployment.md` | ✅ Ready | Multi-platform deployment orchestration |
| 16 | Documentation | `luna-documentation.md` | ✅ Ready | Auto-generate README, API docs, architecture guides |
| 17 | Post-Launch Review | `luna-post-launch-review.md` | ✅ Ready | Post-deployment health check and optimization |
| 18 | Monitoring | `luna-monitoring-observability.md` | ✅ Ready | Logging, metrics, alerting setup |

### 🧠 Intelligence Agents (make it smart)

| # | Agent | File | Status | What It Does |
|---|-------|------|--------|-------------|
| 19 | RAG | `luna-rag.md` | ✅ Ready | Semantic code search and retrieval |
| 20 | RAG Enhanced | `luna-rag-enhanced.md` | ✅ Ready | Advanced RAG with re-ranking and evaluation |
| 21 | Analytics | `luna-analytics.md` | ✅ Ready | PostHog/GA4 integration + tracking plan |
| 22 | SEO | `luna-seo.md` | ✅ Ready | Technical SEO optimization |
| 23 | OpenAI App | `luna-openai-app.md` | ✅ Ready | OpenAI/Anthropic integration with streaming |
| 24 | Database | `luna-database.md` | ✅ Ready | Schema design, migrations, optimization |
| 25 | LemonSqueezy | `luna-lemonsqueezy.md` | ✅ Ready | Payment integration with LemonSqueezy |

### 🎨 Design Agents (make it beautiful)

| # | Agent | File | Status | What It Does |
|---|-------|------|--------|-------------|
| 26 | Apple HIG | `luna-hig.md` | ✅ Ready | Apple Human Interface Guidelines compliance |
| 27 | User Guide | `luna-user-guide.md` | ✅ Ready | End-user documentation generation |
| 28 | Run (Meta) | `luna-run.md` | ✅ Ready | Meta-agent that chains other agents |

---

## What Exists vs. What Needs Building

### ✅ DONE — Production-Ready Assets

| Asset | Repo | Lines | Notes |
|-------|------|:-----:|-------|
| 28 agent personas | `luna-agents/agents/` | ~8K | Well-crafted markdown prompts, tested with Claude/Cursor |
| 22 agent commands | `luna-agents/commands/` | ~5K | Command implementations for CLI |
| 5 MCP servers | `luna-agents/mcp-servers/` | ~3K | IDE integration, functional |
| Visual Studio | `lunaos-studio/` | ~10K | Three.js workflow builder, deployable |
| Prisma schema | `lunaos-engine/packages/database/` | ~860 | Solid data model |
| 5 OpenHands agents | `OpenHands/` | — | DevSecOps, TestCraft, DocDynamo, APIBuilder, CodeReview |
| Marketing site | `lunaos-marketing/` | ~6K | Landing, pricing, investors pages |
| Documentation | `lunaos-docs/` | ~27K | 57 docs consolidated |

### ⚠️ EXISTS BUT NEEDS WORK

| Component | Current State | What's Needed |
|-----------|--------------|---------------|
| Hono API worker | 608 lines, good patterns, has bugs | Fix env shadowing, add agent execution endpoint, deploy |
| RAG interfaces | Good abstractions, no CF implementation | Implement Cloudflare Vectorize provider |
| luna-agents backend | 11K lines JS, more tested than engine | Evaluate: use as engine base or merge key pieces |
| Dashboard (Next.js) | 27 files, basic pages exist | Wire to API, add real data, polish UI |

### 🔨 NEEDS BUILDING FROM SCRATCH

| Component | Priority | Effort | Description |
|-----------|:--------:|:------:|-------------|
| **Agent Execution Engine** | 🔴 P0 | 3 days | Load persona markdown → build system prompt → call LLM → stream SSE response |
| **CLI (`@luna-agents/cli`)** | 🔴 P0 | 3 days | `luna init`, `luna run <agent>`, `luna list`, `luna serve` |
| **Auth system** | 🔴 P0 | 2 days | JWT + API key auth in Hono worker |
| **RAG Cloudflare impl** | 🟡 P1 | 3 days | Vectorize embeddings, D1 metadata, semantic search |
| **Billing (Stripe/LS)** | 🟡 P1 | 3 days | Checkout, webhooks, subscription management, usage metering |
| **Agent chains engine** | 🟡 P1 | 3 days | DAG execution: agent output → next agent input |
| **GitHub OAuth + indexing** | 🟡 P1 | 2 days | Connect repo → scan → index into RAG |
| **Dashboard wiring** | 🟡 P1 | 3 days | Real API calls, agent execution UI, streaming output |
| **VitePress docs site** | 🟢 P2 | 2 days | Configure VitePress, organize agent catalog |
| **VS Code extension** | 🟢 P2 | 3 days | Wrap CLI, agent output in panel |
| **Status page** | 🟢 P2 | 1 day | Simple uptime monitoring |

---

## Build Plan — 6 Weeks to Launch

### Week 1: "Wire It Up" — Get subdomains live

**Goal**: All 5 subdomains deployed with real (even if minimal) content.

| Day | What | Deliverable |
|-----|------|-------------|
| Mon | Set up Cloudflare DNS for lunaos.ai subdomains | DNS records active |
| Mon | Deploy `lunaos-marketing/` → `lunaos.ai` | Marketing site live |
| Mon | Deploy `lunaos-studio/` → `studio.lunaos.ai` | Studio live |
| Tue | Fix Hono worker: remove NestJS code, fix env bugs, add health endpoint | Clean `worker.ts` |
| Tue | Deploy API worker → `api.lunaos.ai` | API returns `{ status: "ok" }` |
| Wed | Add JWT auth to Hono worker (signup/login/verify) | Auth endpoints work |
| Wed | Implement `POST /agents/execute` — load persona, call LLM, stream response | **First agent execution on production** |
| Thu | Deploy Next.js dashboard → `agents.lunaos.ai` | Dashboard live |
| Thu | Wire dashboard login → API auth | Login works cross-subdomain |
| Fri | Test end-to-end: marketing → signup → login → execute agent | Full user flow works |

**Week 1 ships**: 5 live subdomains, working auth, first agent execution.

### Week 2: "Make Agents Real" — CLI + core agents working

**Goal**: A developer can install the CLI and run agents locally.

| Day | What | Deliverable |
|-----|------|-------------|
| Mon | Build CLI: `luna init` (scaffold `.luna/` dir) | CLI scaffolds project |
| Mon | Build CLI: `luna list` (show available agents) | 28 agents listed |
| Tue | Build CLI: `luna run <agent>` — local mode (reads persona, calls OpenAI/Anthropic directly) | **`luna run code-review` works locally** |
| Wed | Build CLI: `luna run <agent> --cloud` — calls `api.lunaos.ai/agents/execute` | Cloud execution works |
| Thu | Agent execution: proper streaming (SSE), save results to DB, execution history | Streaming output |
| Thu | Dashboard: list agent executions, view results, re-run | Dashboard shows real data |
| Fri | Publish CLI to npm: `npm i -g @luna-agents/cli` | **Anyone can install and run** |
| Fri | Test 6 core agents end-to-end: requirements → design → plan → execute → review → test | Agent chain works manually |

**Week 2 ships**: Published CLI on npm, 6 core agents functional, dashboard shows real executions.

### Week 3: "Make It Smart" — RAG + GitHub integration

**Goal**: Agents can understand your codebase through semantic search.

| Day | What | Deliverable |
|-----|------|-------------|
| Mon | RAG: File scanner → chunker → embedder using Cloudflare AI | Files get embedded |
| Tue | RAG: Store embeddings in Cloudflare Vectorize, metadata in D1 | Vector DB populated |
| Wed | RAG: Semantic search endpoint — query → relevant code chunks | Search works |
| Wed | Wire RAG into agent execution — agents can search codebase for context | Agents get smarter |
| Thu | GitHub OAuth flow — connect repo from dashboard | OAuth works |
| Thu | Auto-index connected repo: clone → scan → embed → index | Repo indexed |
| Fri | Test: connect real repo → run code-review → agent finds real issues using RAG | **RAG-powered code review** |

**Week 3 ships**: RAG pipeline works, GitHub repos can be connected, agents use codebase context.

### Week 4: "Make It Commercial" — Billing + API keys

**Goal**: Users can upgrade from free to paid, generate API keys.

| Day | What | Deliverable |
|-----|------|-------------|
| Mon | Stripe/LemonSqueezy integration: create products, checkout session | Checkout works |
| Mon | Webhook handler: subscription created/updated/cancelled → update DB | Billing syncs |
| Tue | Usage metering: track agent executions per user, enforce tier limits | Free: 100/mo, Pro: 10K/mo |
| Tue | API key management: generate/revoke from dashboard | API keys work |
| Wed | API key auth middleware: key-based access to all endpoints | External API access |
| Wed | Pro gating: mark 10+ agents as Pro-only, show upgrade prompt | Upsell flow |
| Thu | Dashboard billing page: current plan, usage, invoices, upgrade button | Billing UI |
| Fri | Test full flow: signup free → run 100 agents → hit limit → upgrade → unlimited | **Revenue works** |

**Week 4 ships**: Stripe payments, usage limits, API keys, Pro tier.

### Week 5: "Make It Beautiful" — Polish + docs + Studio wiring

**Goal**: Product-quality UX, documentation, Studio connected to engine.

| Day | What | Deliverable |
|-----|------|-------------|
| Mon | Dashboard redesign: proper design system, dark mode, animations | Premium feel |
| Mon | Agent execution UI: streaming output with syntax highlighting | Beautiful output |
| Tue | Studio ↔ API: save/load workflows, trigger agent execution from nodes | Studio works with engine |
| Tue | Agent chains: DAG execution engine — output of one feeds into next | Automated chains |
| Wed | VitePress docs site: getting started, agent catalog, API reference | `docs.lunaos.ai` live |
| Thu | Landing page redesign: real screenshots, demo GIF, testimonials | Marketing polished |
| Thu | Onboarding wizard: detect framework → connect repo → first agent run | Smooth first-run |
| Fri | CLI: `luna studio` opens Studio, `luna serve` starts local server | CLI fully featured |

**Week 5 ships**: Polished UX, docs live, Studio connected, agent chains work.

### Week 6: "Launch" — Product Hunt + community

**Goal**: Public launch, community setup, everything hardened.

| Day | What | Deliverable |
|-----|------|-------------|
| Mon | Security audit: rate limiting, CORS, input validation, SQL injection | Hardened |
| Mon | Performance: response time < 200ms for all API endpoints | Fast |
| Tue | Status page → `status.lunaos.ai` | Uptime monitoring |
| Tue | Error tracking: Sentry integration | Errors caught |
| Wed | Product Hunt submission: screenshots, description, maker comments | Submitted |
| Wed | Community Discord: channels for agents, showcase, support | Discord open |
| Thu | **LAUNCH DAY** — Product Hunt goes live | 🚀 |
| Thu | Monitor, respond to comments, fix issues | Support |
| Fri | Week 1 retrospective, plan Week 7-8 based on feedback | Data-driven next steps |

**Week 6 ships**: Product Hunt launch, everything live, community active.

---

## Revenue Model

| Tier | Price | Target User | Limits |
|------|-------|-------------|--------|
| 🆓 **Community** | $0/mo | Individual devs, OSS | CLI + 6 core agents + 100 runs/mo |
| ⚡ **Pro** | $29/mo | Freelancers, indie hackers | All 28 agents + Cloud RAG + 10K runs/mo |
| 🏢 **Team** | $79/seat/mo | Startups (5-50 devs) | Shared workspaces + analytics + SSO + API keys |
| 🏛️ **Enterprise** | $5K+/mo | Mid-market & enterprise | On-premise + VPC + custom agents + CSM |

### Unit Economics

```
Pro subscriber ($29/mo):
  LLM cost:        ~$3/mo (amortized)
  Cloudflare:      ~$0.50/mo
  Support:         ~$0 (self-serve)
  Gross margin:    ~88%

Enterprise ($5K+/mo):
  LLM cost:        $0 (they run locally)
  Infra:           $0 (they host)
  Support:         ~$500/mo
  Gross margin:    ~90%+
```

---

## Competitive Position

```
                    Code Completion ◄──────────────────► Full SDLC
                          │                                  │
        GitHub Copilot ───┤                                  │
        Cursor ───────────┤                                  │
        Windsurf ─────────┤                                  │
                          │              Devin ──────────────┤
                          │                                  │
                          │         🌙 LunaOS ───────────────┤
                          │                                  │
   Cloud-Only ◄───────────┼──────────────────────────► Local
                          │                                  │
        Devin ($500/mo) ──┤                                  │
        v0 ───────────────┤                                  │
                          │         🌙 LunaOS ───────────────┤
                          │                                  │
  Single Agent ◄──────────┼──────────────────────────► Multi-Agent
                          │                                  │
        Everyone else ────┤                                  │
                          │         🌙 LunaOS ───────────────┤
```

**LunaOS owns: Full SDLC × Runs Anywhere × Multi-Agent × Visual**

No one else has all four.

---

## Post-Launch Roadmap

### Month 2-3: Growth
- VS Code extension (wrap CLI)
- Agent Store (community-contributed agents)
- Webhook triggers (PR opened → run code-review automatically)
- Team workspaces

### Month 4-6: Enterprise
- SSO/SAML
- On-premise deployment (Docker + local LLM)
- Custom agent builder
- Audit logging + compliance

### Month 7-12: Platform
- Autonomous agent chains (GitHub Actions for AI agents)
- Agent marketplace with revenue share
- Mobile app (React Native + on-device inference)
- SOC2 Type II certification

---

## The 10 Repos (Final State)

```
lunaos-ai/ (GitHub Org)
│
├── lunaos-engine       🔒 api.lunaos.ai      TS/Hono/Cloudflare Workers
├── lunaos-dashboard    🌍 agents.lunaos.ai    Next.js 14
├── lunaos-marketing    🌍 lunaos.ai           Static HTML/CSS/JS
├── lunaos-studio       🌍 studio.lunaos.ai    Three.js visual builder
├── luna-agents         🌍 npm @luna-agents     Agent personas + CLI + MCP
├── lunaos-docs         🌍 docs.lunaos.ai      VitePress
├── lunaos-mobile       🔒 App stores          React Native (future)
├── OpenHands           🌍 Docker/pip          Fork with specialized agents
├── nexa-sdk            🌍 Reference           On-device inference
└── lunaos-infra        🔒 status.lunaos.ai    Docker/Terraform/CI
```

---

## Success Metrics

| Milestone | When | Numbers |
|-----------|------|---------|
| MVP Live | Week 1 | 5 subdomains deployed |
| First Agent Run | Week 1 | `POST /agents/execute` returns streamed response |
| CLI Published | Week 2 | `npm i -g @luna-agents/cli` works |
| Revenue Ready | Week 4 | Stripe payments processing |
| Launch | Week 6 | Product Hunt, 500 signups target |
| Product-Market Fit | Month 3 | 100 Pro subs, <5% churn, $2,900 MRR |
| Series A Ready | Month 12 | $200K+ MRR, 2K+ Pro subs |

---

## What To Build FIRST (Next Session)

The single most important thing: **make `luna run code-review` work end-to-end.**

That means:
1. Build the CLI (`luna` command)
2. CLI reads the agent persona markdown
3. CLI calls OpenAI/Anthropic with the persona as system prompt
4. CLI streams the response to terminal
5. CLI saves the report to `.luna/reports/`

This can work **without** the cloud engine — pure local execution. Once this works, everything else builds on top.

```bash
# The first demo:
npm i -g @luna-agents/cli
cd my-project
luna init
luna run code-review
# → Real code review appears in terminal
# → Report saved to .luna/reports/code-review-2026-02-08.md
```

That's the MVP. That's the demo. That's the Product Hunt video.

---

*LunaOS — The AI Development Crew*
*lunaos.ai*
*February 7, 2026*
