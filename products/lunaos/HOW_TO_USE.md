# LunaOS — How to Use Each Product (5-Minute Tour)

You have 6 products. Here's what each one is, when to use it, and exactly how.

---

## 1. luna-agents (CLI) — Use This First

**What it is**: A Claude Code plugin that gives you 235 slash commands for every development task.

**Who it's for**: You, the developer, working in your terminal.

**How to install**:
```bash
npm install -g luna-agents
```

**How to use** (in any project directory):
```bash
cd your-project
luna-setup              # One-time setup
```

Then in Claude Code, you can use any command:
```
/luna-agents:plan       # Break a feature into tasks
/luna-agents:go         # Implement next task
/luna-agents:test       # Run tests
/luna-agents:ship       # Deploy
/luna-agents:cmds       # See all 235 commands
```

**When to use**: Every time you're writing code. This is your daily driver.

**Demo**: Open any project → `luna-agents:feature "add dark mode"` → watch it plan, implement, test, and PR.

---

## 2. lunaos-marketing (lunaos.ai) — Public Landing Page

**What it is**: The website people visit to learn about LunaOS.

**Who it's for**: Potential users discovering your product.

**How to use**:
- Visit: https://lunaos.ai
- Share the link in marketing/social posts
- Point prospective users here

**What to edit**: `lunaos-marketing/index.html` — hero copy, features, pricing.

**When to use**: When you want to drive signups. Share on Product Hunt, HN, Twitter, LinkedIn.

---

## 3. lunaos-docs (docs.lunaos.ai) — Documentation Site

**What it is**: Developer documentation for the API, CLI, and agents.

**Who it's for**: Developers who already signed up and want to integrate.

**How to use**:
- Visit: https://docs.lunaos.ai
- Read: Getting Started → API Reference → Agent Catalog
- Copy curl examples directly

**What to edit**: `lunaos-docs/docs/**/*.md` — VitePress markdown files.

**When to use**: When users ask "how do I call the API?" — send them to `docs.lunaos.ai/api`.

---

## 4. agents.lunaos.ai — Dashboard (Admin UI)

**What it is**: Web dashboard where users manage their account, agents, billing, and see analytics.

**Who it's for**: Paying users managing their LunaOS workspace.

**How to use**:
1. Sign up at https://lunaos.ai → redirects to `agents.lunaos.ai/auth/signup`
2. Log in → `/dashboard`
3. Pages:
   - `/dashboard` — Overview (recent executions, usage)
   - `/dashboard/agents` — Browse 28 agents, run any of them
   - `/dashboard/chains` — Build multi-step workflows
   - `/dashboard/api-keys` — Create/revoke API keys
   - `/dashboard/billing` — Upgrade plan, view invoices
   - `/dashboard/kb` — Knowledge base (upload docs for RAG)
   - `/dashboard/repos` — Connect GitHub repos for indexing
   - `/dashboard/analytics` — Usage charts

**When to use**: As the user, after signing up. Every day to check execution history.

---

## 5. studio.lunaos.ai — Visual IDE

**What it is**: Drag-and-drop canvas for building agent workflows visually (like n8n but for AI).

**Who it's for**: Users who prefer visual tools over writing code.

**How to use**:
1. Visit https://studio.lunaos.ai
2. Click a node from the sidebar (HTTP, Agent, Condition, etc.)
3. Drag it onto the canvas
4. Connect nodes with lines
5. Click a node → inspector sidebar → configure params
6. Click "Test Run" → see execution flow
7. Click "Save" → export as JSON → deploy via API

**What to build**:
- **Demo flow**: Pre-loaded with 4 sample nodes so you can click around immediately
- **Product Map**: Hierarchical planning view (Dossier-inspired)

**When to use**: When you want to build a workflow without writing code. Good for non-developers on your team.

---

## 6. api.lunaos.ai — The Engine API

**What it is**: The backend that actually runs everything. REST API on Cloudflare Workers.

**Who it's for**: Developers integrating LunaOS into their own apps.

**How to use** (get an API key first from dashboard):

```bash
# Health check (no auth)
curl https://api.lunaos.ai/health

# List available agents
curl https://api.lunaos.ai/agents/list

# Run a single agent
curl https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "function login(pw) { return pw === '\''admin'\''; }",
    "useRag": false
  }'

# Run agents in parallel (NEW — today's ship)
curl https://api.lunaos.ai/agents/swarm \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "agents": ["code-review", "security-audit", "test-writer"],
    "context": "Review this login function",
    "strategy": "consensus"
  }'

# Get billing status
curl https://api.lunaos.ai/billing/plans
```

**When to use**: When you want to integrate LunaOS into your own app, CI/CD pipeline, or automation.

---

## The Full User Journey

Here's how a new user experiences LunaOS:

```
1. See marketing site (lunaos.ai)
      ↓
2. Click "Get Started Free"
      ↓
3. Sign up on dashboard (agents.lunaos.ai/auth/signup)
      ↓
4. Onboarding: connect GitHub, pick agents
      ↓
5. Try first agent via dashboard UI
      ↓
6. Create API key for their own scripts
      ↓
7. Read docs (docs.lunaos.ai) for API examples
      ↓
8. Either:
   a. Use dashboard daily (non-dev)
   b. Build visual workflow in Studio (mixed)
   c. Install CLI (npm i -g luna-agents) for terminal use (dev)
   d. Integrate API into their app
      ↓
9. Monitor usage in dashboard analytics
      ↓
10. Upgrade to Pro when they hit limits
```

---

## Which Product Do You Show New Users?

| User type | Start them at | Why |
|-----------|--------------|-----|
| **Solo developer** | `npm i -g luna-agents` | Fastest value, no signup |
| **Startup team** | studio.lunaos.ai | Visual, no-code onboarding |
| **Enterprise** | Dashboard + API | Governance, team mgmt |
| **Indie hacker** | Marketing → Dashboard | Full product tour |

---

## Record Your Own Demo (3 options)

### Option A: Quick Loom recording (easiest)
1. Install Loom (loom.com/download) — 5 min setup
2. Record yourself walking through each product in a tab
3. Upload, share the link

### Option B: Using your existing CodeRailFlow tool
```bash
cd coderailflow
npx playwright test flows/lunaos-tour.spec.ts  # if it exists
```

### Option C: Your custom recorder with OpenAI TTS (already in your stack)
You built one before for AMLiQ. Check:
```bash
ls /Users/shaharsolomon/dev/projects/portfolio/luna-os/scripts/ | grep -i record
```

---

## TL;DR — 30-Second Product Summary

**LunaOS = 6 ways to use the same AI agents**:

1. **CLI** (`luna-agents`) — developers who live in the terminal
2. **Marketing** (lunaos.ai) — discovery
3. **Docs** (docs.lunaos.ai) — learning
4. **Dashboard** (agents.lunaos.ai) — day-to-day admin
5. **Studio** (studio.lunaos.ai) — visual building
6. **API** (api.lunaos.ai) — integration into other tools

All powered by the same engine → 28 agents → Gemma 4 (free) / Claude (paid) LLM routing.
