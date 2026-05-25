<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/🌙_Luna_Agents-AI_SDLC-a855f7?style=for-the-badge&labelColor=0a0a1a">
    <img alt="Luna Agents" src="https://img.shields.io/badge/🌙_Luna_Agents-AI_SDLC-a855f7?style=for-the-badge&labelColor=0a0a1a">
  </picture>
</p>

<p align="center">
  <strong>28 specialized AI agents · 70+ commands for every stage of your software development lifecycle.</strong>
  <br>
  One CLI. One API. From requirements to production.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/luna-agents"><img src="https://img.shields.io/npm/v/luna-agents?color=a855f7&label=npm" alt="npm"></a>
  <a href="https://www.npmjs.com/package/luna-agents"><img src="https://img.shields.io/npm/dm/luna-agents?color=a855f7&label=downloads" alt="downloads"></a>
  <a href="https://lunaos.ai"><img src="https://img.shields.io/badge/website-lunaos.ai-3b82f6" alt="Website"></a>
  <a href="https://docs.lunaos.ai"><img src="https://img.shields.io/badge/docs-docs.lunaos.ai-10b981" alt="Docs"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-888" alt="License"></a>
</p>

---

## ⚡ Start in 30 Seconds

```bash
# Install globally
npm install -g luna-agents
luna-setup
```

Then in Claude Code, any of **232 slash commands** work:

```
/luna-agents:plan       # Break a feature into tasks
/luna-agents:go         # Implement next task
/luna-agents:test       # Run tests
/luna-agents:ship       # Deploy
/luna-agents:cmds       # See all 232 commands
```

That's it. The plugin reads your codebase, routes work to specialized AI agents, and streams results back.

---

## 🎯 What It Does

Luna Agents replaces manual workflows at every stage of the SDLC:

| Phase | Agent | What It Does |
|:------|:------|:-------------|
| 📋 **Plan** | `requirements-analyzer` | Analyzes codebase → generates requirements spec |
| 🏗️ **Design** | `design-architect` | Creates architecture docs, component diagrams, API contracts |
| 📝 **Plan Tasks** | `task-planner` | Breaks design into dependency-ordered implementation tasks |
| 💻 **Build** | `task-executor` | Implements code following your specs + standards |
| 🔍 **Review** | `code-review` | Security audit, performance check, best practices review |
| 🧪 **Test** | `testing-validation` | Generates test suites, validates requirements coverage |
| 🎨 **UI Testing** | `ui-test` | E2E visual testing with Playwright: accessibility + responsiveness |
| 🔧 **UI Fix** | `ui-fix` | Auto-fixes accessibility, responsive, and design system issues |
| 🚀 **Deploy** | `deployment` | Production configs, CI/CD pipelines, infrastructure setup |
| 📚 **Document** | `documentation` | API docs, user guides, changelogs |
| 📊 **Monitor** | `monitoring` | Logging, alerting, health checks, dashboards |
| 📈 **Review** | `post-launch-review` | Performance analysis, optimization recommendations |
| 🔐 **Security** | `365-security` | Continuous security scanning and compliance |
| 🗄️ **Database** | `database` | Schema design, migrations, query optimization |
| 🔌 **API** | `api-generator` | RESTful API scaffolding from specifications |
| 🐳 **Docker** | `docker` | Containerization, multi-stage builds, Compose configs |
| ☁️ **Cloud** | `cloudflare` | Workers, Pages, D1, R2 deployment automation |
| 🍋 **Billing** | `lemonsqueezy` | Payment integration and subscription management |
| 🔒 **Auth** | `auth` | JWT, OAuth, RBAC implementation |
| 📈 **Analytics** | `analytics` | Usage tracking, event pipelines, insight dashboards |
| 🔎 **SEO** | `seo` | Meta tags, schema markup, performance optimization |
| 🎨 **HIG** | `hig` | Apple Human Interface Guidelines compliance |
| 🧠 **RAG** | `rag` | Semantic code search across your entire codebase |
| 👁️ **Vision** | `glm-vision` | Screenshot-to-code analysis and GUI testing |
| 📱 **OpenAI App** | `openai-app` | OpenAI integration patterns and app scaffolding |
| 🏃 **Runner** | `run` | Pipeline orchestration and multi-agent workflows |
| 📖 **User Guide** | `user-guide` | End-user documentation generation |
| 🔍 **RAG Enhanced** | `rag-enhanced` | Advanced RAG with hybrid search + re-ranking |

---

## 🚀 Usage

### CLI

```bash
# Run a specific agent
luna run code-review
luna run testing-validation
luna run deployment

# Run a full pipeline
luna chain full-review    # code-review → testing → security

# List all available agents
luna agents list

# Search your codebase with AI
luna rag search "How does authentication work?"
```

### Claude Code Commands (70+)

Luna Agents includes 70+ slash commands for Claude Code. Type `/cmds` to see all.

#### Dev Workflow (sequential)

| Shortcut | Command | What It Does |
|:---------|:--------|:-------------|
| `/req` | `/ll-requirements` | Analyze codebase, generate requirements |
| `/des` | `/ll-design` | Transform requirements into technical design |
| `/plan` | `/ll-plan` | Break design into ordered tasks |
| `/go` | `/ll-execute` | Implement next task from plan |
| `/rev` | `/ll-review` | Comprehensive code review |
| `/test` | `/ll-test` | Create test suites, validate coverage |
| `/ship` | `/ll-deploy` | Deploy to staging and production |
| `/watch` | `/ll-monitor` | Set up monitoring and alerts |
| `/retro` | `/ll-postlaunch` | Analyze launch metrics |

#### Autopilot & Automation

| Shortcut | Command | What It Does |
|:---------|:--------|:-------------|
| `/feature` | `/ll-feature` | Full feature lifecycle — plan, implement, test, review, fix in a loop until done |
| `/parallel` | `/ll-parallel` | Run multiple agents simultaneously (build + test + lint) |
| `/fix` | `/ll-fix` | Systematic bug fix: failing test → bisect → fix → verify |
| `/debug` | `/ll-debug` | Scientific debugging with persistent state across resets |
| `/refactor` | `/ll-refactor` | Split oversized files, extract logic, rename across codebase |
| `/pr` | `/ll-pr` | Generate PR with summary, test plan, linked issues |

#### Quality & Testing

| Shortcut | Command | What It Does |
|:---------|:--------|:-------------|
| `/rules` | `/ll-rules` | Apply session rules: 100-line cap, full tests, Playwright e2e |
| `/perf` | `/ll-perf` | Performance profiling (bundle, queries, Web Vitals) |
| `/a11y` | `/ll-a11y` | WCAG 2.2 accessibility audit |
| `/deps` | `/ll-deps` | Dependency audit, cleanup, license check |
| `/mock` | `/ll-mock` | Generate test fixtures, factories, MSW handlers |
| `/storybook` | `/ll-storybook` | Generate component stories catalog |

#### Code Generation

| Shortcut | Command | What It Does |
|:---------|:--------|:-------------|
| `/auth` | `/ll-auth` | Auth.js v5 with 7 social OAuth providers + HTML setup guide |
| `/brand` | `/ll-brand` | Generate brand identity from codebase (colors, logo, typography) |
| `/api-client` | `/ll-api-client` | Generate typed API client SDK from routes/OpenAPI |
| `/migrate` | `/ll-migrate` | Database migration generator with up/down SQL |
| `/i18n` | `/ll-i18n` | Internationalization with RTL support |
| `/ci` | `/ll-ci` | CI/CD pipeline generator (GitHub Actions / GitLab) |
| `/changelog` | `/ll-changelog` | Auto changelog from git history |

#### AI & Intelligence

| Shortcut | Command | What It Does |
|:---------|:--------|:-------------|
| `/nexa` | `/ll-nexa` | Nexa semantic code analysis (review, bugs, explain, debt) |
| `/lam` | `/ll-lam` | Large Action Model — goal-driven autonomous actions |
| `/oh` | `/ll-openhands` | Delegate to OpenHands autonomous coding agent |
| `/chain` | `/ll-agent-chain` | Chain agents: `rag→nexa→openhands→test` |
| `/vision` | `/ll-vision` | Screenshot-to-code, UI comparison, visual diff |
| `/search` | `/ll-smart-search` | Multi-engine search (RAG + Nexa + grep) |
| `/q` | `/ll-rag` | RAG codebase search |

#### Infrastructure & DevOps

| Shortcut | Command | What It Does |
|:---------|:--------|:-------------|
| `/env` | `/ll-env` | Validate and manage .env files |
| `/rollback` | `/ll-rollback` | Generate rollback procedures and runbooks |
| `/dock` | `/ll-dockerize` | Containerize your app |
| `/cf` | `/ll-cloudflare` | Cloudflare deployment automation |
| `/sec` | `/ll-365-secure` | OWASP security audit |

#### Tools

| Shortcut | Command | What It Does |
|:---------|:--------|:-------------|
| `/hig` | `/ll-hig` | Apple HIG compliance audit |
| `/ui` | `/ll-ui-convert` | Convert UI to Apple HIG design |
| `/docs` | `/ll-docs` | Generate user, developer, API docs |
| `/cfg` | `/ll-config` | Configure Luna plugin |

### Pipeline Runner — Combine Commands

Use `/pipe` to chain commands with operators:

```bash
# >> sequential (one after another)
/pipe req >> des >> plan >> go >> rev >> test >> ship

# ~~ parallel (Luna quality checks at once)
/pipe rev ~~ test ~~ sec ~~ a11y

# () group + mix
/pipe (rev ~~ test ~~ sec) >> ship

# ?>> conditional (ship only if tests pass)
/pipe test ?>> ship

# !>> fail branch (fix if tests fail)
/pipe test ?>> ship !>> fix

# AI-powered pipeline
/pipe search "auth" >> nexa review >> lam "improve auth" >> test >> pr

# Implement 5 tasks, quality gate, ship
/pipe go *5 >> (rev ~~ test ~~ sec) >> ship

# Auto-fix loop (try 3 times until tests pass)
/pipe (fix "bug" >> test) *3? >> pr

# Apply rules before + test after every step
/pipe @before:rules @after:test go *5 >> ship

# Feature autopilot with quality gate
/pipe feature "add billing" >> (rev ~~ test) ?>> pr

# Full project from scratch
/pipe req >> des >> plan >> @before:rules @after:test go *10! >> rev >> sec >> ship >> docs >> watch
```

| Operator | Meaning | Example |
|:---------|:--------|:--------|
| `>>` | Sequential — left finishes, then right starts | `req >> des >> plan` |
| `~~` | Parallel — all run simultaneously | `rev ~~ test ~~ sec` |
| `( )` | Group — treated as a single unit | `(rev ~~ test) >> ship` |
| `?>>` | Success gate — next only if previous passed | `test ?>> ship` |
| `!>>` | Fail branch — next only if previous failed | `test !>> fix` |
| `*N` | Loop N times | `go *5` |
| `*N?` | Loop up to N times, stop on success | `(fix >> test) *3?` |
| `*N!` | Loop up to N times, stop on failure | `go *10!` |
| `*?` | Loop until success (max 10) | `(fix >> test) *?` |
| `@before:CMD` | Run before each step | `@before:rules` |
| `@after:CMD` | Run after each step | `@after:test` |
| `@each:CMD` | Run before + after each step | `@each:rev` |

### API

```bash
curl https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "Review this Express middleware for security issues..."
  }'
```

### MCP Integration

Luna works with any MCP-compatible platform — Claude Desktop, Windsurf, Cline, Zed, and more.

```json
{
  "mcpServers": {
    "luna-vision-rag": {
      "url": "https://luna-vision-rag-mcp.workers.dev/mcp",
      "headers": {
        "X-API-Key": "luna_YOUR_API_KEY"
      }
    }
  }
}
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI / Dashboard                       │
│              luna run code-review · agents.lunaos.ai         │
├─────────────────────────────────────────────────────────────┤
│                     API Gateway (Hono)                        │
│        api.lunaos.ai — Cloudflare Workers (Edge)             │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│    D1    │    KV    │ Vectorize│  Workers │    Stripe       │
│ Database │  Cache   │   RAG    │    AI    │   Billing       │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
          │                                     │
   ┌──────┴──────┐                    ┌─────────┴─────────┐
   │ 28 AI Agents │                    │ LLM Providers     │
   │  Personas    │                    │ DeepSeek·Claude·  │
   │  + Context   │                    │ OpenAI·Workers AI │
   └─────────────┘                    └───────────────────┘
```

- **Edge-native** — API runs on Cloudflare Workers (200+ PoPs, <10ms cold start)
- **Multi-provider** — DeepSeek R1, Claude, GPT-4, Workers AI
- **Streaming** — SSE responses for real-time agent output
- **Composable** — Chain agents into pipelines (code-review → testing → deploy)

---

## 💎 Pricing

| | Free | Pro | Team |
|:---|:---:|:---:|:---:|
| **Price** | $0/mo | $29/mo | $79/mo |
| **Agents** | 10 core | All 28 | All 28 |
| **Executions** | 50/mo | Unlimited | Unlimited |
| **RAG Search** | 100 queries | Unlimited | Unlimited |
| **Chain Pipelines** | — | ✅ | ✅ |
| **Vision & GUI Testing** | — | ✅ | ✅ |
| **Team Members** | 1 | 1 | 10 |
| **Support** | Community | Priority | Dedicated |

[**Get Started →**](https://lunaos.ai/#pricing)

---

## 📦 Installation

### From npm (recommended)

```bash
npm i -g @luna-agents/cli
```

### From source

```bash
git clone https://github.com/lunaos-ai/luna-agents.git
cd luna-agents
./setup.sh
```

### Requirements

- Node.js 18+
- Any MCP-compatible AI assistant (optional, for MCP integration)

---

## 🔗 Links

| Resource | URL |
|:---------|:----|
| 🌐 Website | [lunaos.ai](https://lunaos.ai) |
| 📚 Documentation | [docs.lunaos.ai](https://docs.lunaos.ai) |
| 🎛️ Dashboard | [agents.lunaos.ai](https://agents.lunaos.ai) |
| 📊 Status | [status.lunaos.ai](https://status.lunaos.ai) |
| 🐛 Issues | [GitHub Issues](https://github.com/lunaos-ai/luna-agents/issues) |

---

## 📄 License

MIT © [Shachar Solomon](https://github.com/shacharsol)

<p align="center">
  <sub>Built with ❤️ and a lot of AI agents.</sub>
</p>