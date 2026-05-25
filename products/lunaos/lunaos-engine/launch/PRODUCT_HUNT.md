# Product Hunt Launch — LunaOS

> **Schedule**: Tuesday, 12:01 AM PT
> **Category**: Developer Tools / AI / Productivity

---

## Listing Details

### Tagline (60 chars)

```
28 AI agents for your entire software development lifecycle
```

### Short Description (260 chars)

```
LunaOS gives you 28 specialized AI agents — from code review to deployment to monitoring. One CLI command. One API. Works with DeepSeek, Claude, GPT-4, and Workers AI. Replace your scattered dev scripts with a composable AI pipeline that covers requirements → design → code → test → deploy → monitor.
```

### Description (Full)

```
👋 Hey Product Hunt!

We built LunaOS because we were tired of copy-pasting between ChatGPT, Copilot, and custom scripts for different dev tasks.

**LunaOS is 28 specialized AI agents, each purpose-built for one stage of the SDLC.**

Instead of one generic assistant, you get:
• A code-review agent that understands security patterns
• A testing agent that generates real test suites
• A deployment agent that creates production-ready configs
• A monitoring agent that sets up alerting and dashboards
• ...and 24 more for requirements, design, docs, SEO, auth, databases, Docker, etc.

**How it works:**
```
npx @luna-agents/cli run code-review
```

That's it. It reads your codebase, sends it to the specialized agent, and streams the results back. You can chain agents into pipelines:

```
luna chain full-review  # code-review → testing → security
```

**What makes it different:**
1. **Edge-native** — API runs on Cloudflare Workers (200+ PoPs, <10ms cold start)
2. **Multi-provider** — DeepSeek R1 (default, fast + cheap), Claude 3.5, GPT-4, Workers AI
3. **Composable** — Chain agents into DAG pipelines with data flow between nodes
4. **RAG-powered** — Semantic search across your codebase for context-aware responses
5. **MCP-native** — Works with Claude Desktop, Windsurf, Cline, Zed, and any MCP client

**Free tier**: 10 agents, 50 executions/month
**Pro**: $29/mo — all 28 agents, unlimited, chain pipelines
**Team**: $79/mo — 10 seats, shared analytics

Built by a solo developer over 40 days with heavy AI pair programming. Every line of infra, every test, every deploy — all shipped with Luna agents eating their own dog food. 🌙

Try it now: `npx @luna-agents/cli run code-review`
```

---

## First Comment (by Maker)

```
Hey PH 👋

I'm Shachar, the solo developer behind LunaOS.

The idea started simple: I wanted specialized AI agents instead of generic chatbots. A code review agent should know about OWASP Top 10, not just "looks good." A testing agent should generate actual Vitest/Jest suites, not pseudocode.

So I built 28 of them. Each has a persona, domain expertise, and specific output format.

The fun part? I used LunaOS to build LunaOS. The code review agent caught 3 real security issues. The testing agent generated 40% of the test suite. The deployment agent created the Cloudflare Worker configs.

Some numbers:
- 28 AI agents covering the full SDLC
- 5 LLM providers (DeepSeek, Claude, GPT-4, OpenAI, Workers AI)
- <200ms API cold start on Cloudflare Workers
- 11 D1 database tables
- Zod validation on every endpoint
- Sentry error tracking on every unhandled exception
- Live status page at status.lunaos.ai

Free tier is genuinely useful — 10 agents, 50 runs/month, no credit card. Give it a try:

npm i -g @luna-agents/cli
luna run code-review

Would love your feedback! What agents would you add? 🌙
```

---

## Images / Gallery

1. **Hero** — CLI screenshot showing `luna run code-review` with streaming output
2. **Dashboard** — agents.lunaos.ai showing agent catalog grid
3. **Architecture** — The diagram from the README (CLI → API → Agents → LLMs)
4. **Status Page** — status.lunaos.ai showing all greens
5. **Pricing** — The 3-tier pricing table from the landing page

---

## Topics / Tags

- `Developer Tools`
- `Artificial Intelligence`
- `Productivity`
- `SaaS`
- `Open Source`
- `CLI`
- `Code Review`

---

## Maker Checklist

- [ ] Create Product Hunt account (maker mode)
- [ ] Upload 5 gallery images (1200x900px recommended)
- [ ] Set thumbnail (gif or image, 240x240px)
- [ ] Schedule for Tuesday 12:01 AM PT
- [ ] Prepare upvote request for personal network
- [ ] Set up ProductHunt webhook → Discord #launches channel
- [ ] Have 3+ hunter/supporter comments pre-drafted
