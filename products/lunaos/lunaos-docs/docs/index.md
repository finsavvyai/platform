---
layout: home

hero:
  name: "LunaOS"
  text: "AI-Powered Development Intelligence"
  tagline: "28 specialized AI agents for your entire SDLC — code review, testing, security, deployment, and more."
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: Agent Catalog
      link: /agents/
    - theme: alt
      text: API Reference
      link: /api/

features:
  - title: 28 AI Agents
    details: From code review to security hardening — each agent is a domain expert trained on real-world engineering patterns.
  - title: Luna Pipe Language
    details: Compose agents into pipelines with >>, ~~, try/catch, loops, and variables. One line does what scripts take hundreds.
  - title: RAG-Enhanced Context
    details: Point agents at your codebase for deep understanding. Vectorize + AI search finds relevant code automatically.
  - title: Multi-Provider LLMs
    details: Choose your preferred LLM — DeepSeek, Claude, GPT-4o — with automatic fallback and cost optimization.
  - title: Editor Integration
    details: VS Code extension and IntelliJ plugin — run agents, write Luna pipes, and view logs without leaving your editor.
  - title: Edge-First Architecture
    details: Runs entirely on Cloudflare's global edge. Sub-20ms cold starts across 300+ locations. D1, KV, Vectorize, Workers AI.
---

## Quick Start

```bash
# Install the CLI
npm install -g luna-agents

# Run your first agent
luna run code-review --context "Review this PR for security issues"

# Or use Luna pipes
luna pipe "req >> des >> plan >> go *5 >> (rev ~~ test ~~ sec) ?>> ship"
```

Or use the **REST API** directly:

```bash
curl -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent": "code-review", "context": "Review this function for SQL injection"}'
```

## Products

| Product | URL | Purpose |
|---------|-----|---------|
| **CLI** | `npm i -g luna-agents` | Terminal agent orchestration |
| **Dashboard** | [agents.lunaos.ai](https://agents.lunaos.ai) | Web management console |
| **Studio** | [studio.lunaos.ai](https://studio.lunaos.ai) | Visual workflow builder |
| **Mobile** | App Store / Play Store | Monitor and trigger on the go |
| **VS Code** | Marketplace | Editor integration |
| **IntelliJ** | Marketplace | JetBrains IDE integration |
| **API** | [api.lunaos.ai](https://api.lunaos.ai) | REST API for everything |

## Pricing

| | Free ($0) | Pro ($29/mo) | Team ($79/mo) |
|---|---|---|---|
| **Commands** | Unlimited | Unlimited | Unlimited |
| **API Keys** | BYOK | Managed keys | Managed keys |
| **MCP Servers** | — | 33 pre-configured | 33 pre-configured |
| **RAG + Visual QA** | — | Included | Included |
| **Rate Limit** | 60 req/min | 600 req/min | 6,000 req/min |
| **Team + SSO** | — | — | SSO/SAML, audit logs |
| **Support** | Community | Priority | Dedicated + SLA |
