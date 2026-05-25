# 🌙 LunaOS Skills for OpenClaw 🦞

> Access 53 specialized AI coding agents from your OpenClaw assistant — now with native engine integration

## ⚡ What's new in v0.3.0

**Native OpenClaw Integration** — all tools now route through dedicated `/openclaw/tools/*` endpoints in the LunaOS Engine API, providing:

- 🔧 **Native tool endpoints** — `luna_run`, `luna_chain`, `luna_search`, `luna_index`
- 📊 **Built-in analytics** — gateway health, skill execution metrics, session tracking
- 🔐 **Tier-aware access** — free/pro agent gating enforced server-side
- 🔄 **Session persistence** — all gateway sessions tracked in D1 for audit/analytics
- ⚡ **Improved SSE streaming** — token-level streaming for `luna_run` and `luna_chain`

## What's included

| Skill | Agent(s) | Use Case |
|-------|----------|----------|
| `luna-code-review` | `code-review` | Deep code analysis, bug detection, best practices |
| `luna-security-audit` | `365-security` | OWASP scanning, vulnerability detection, hardening |
| `luna-test-writer` | `testing-validation` | Unit, integration, and e2e test generation |
| `luna-architect` | `design-architect` | System design, tech stack, scalability patterns |
| `luna-docs-generator` | `documentation` | API docs, README generation, JSDoc/TSDoc |
| `luna-full-review` | Chain: 4 agents | Multi-agent review: code → security → perf → docs |
| `luna-rag-search` | RAG engine | Semantic search across indexed codebases |

## Quick Setup

```bash
# Install the plugin
openclaw plugins install @lunaos/openclaw-plugin

# Set your API key
openclaw config set plugins.entries.lunaos.config.apiKey "luna_key_xxx"
```

## Tools

### 🤖 `luna_run` — Run a single agent

```
Use luna_run to review this code for bugs:
<paste code>
```

Available agents: `365-security`, `analytics`, `api-generator`, `auth`, `cloudflare`, `code-review`, `database`, `deployment`, `design-architect`, `docker`, `documentation`, `glm-vision`, `hig`, `lemonsqueezy`, `monitoring-observability`, `openai-app`, `post-launch-review`, `rag-enhanced`, `rag`, `requirements-analyzer`, `run`, `seo`, `task-executor`, `task-planner`, `testing-validation`, `ui-fix`, `ui-test`, `user-guide`

### 🔗 `luna_chain` — Multi-agent chains

```
Use luna_chain with the security-audit preset to audit this code:
<paste code>
```

Chain presets: `full-review`, `new-feature`, `deploy`, `security-audit`, `api-design`

### 🔍 `luna_search` — Semantic codebase search

```
Use luna_search to find: "database connection pooling implementation"
```

### 📦 `luna_index` — Index files for search

```
Use luna_index to index the src/ directory of my project
```

## API Endpoints

All tool endpoints are available at `https://api.lunaos.ai/openclaw/tools/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/openclaw/tools` | List all available tools |
| `POST` | `/openclaw/tools/run` | Execute a single agent |
| `POST` | `/openclaw/tools/chain` | Execute a multi-agent chain |
| `POST` | `/openclaw/tools/search` | Semantic RAG search |
| `POST` | `/openclaw/tools/index` | Index files for RAG |
| `GET` | `/openclaw/tools/agents` | List all agents with tiers |
| `GET` | `/openclaw/tools/chains` | List chain presets |

### Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/openclaw/analytics/overview` | Dashboard overview |
| `GET` | `/openclaw/analytics/gateways` | List registered gateways |
| `GET` | `/openclaw/analytics/sessions` | Session history |
| `GET` | `/openclaw/analytics/skills` | Skill execution breakdown |

## Gateway Management

Register a remote OpenClaw Gateway to dispatch agents to your local machine:

```bash
# Register your Gateway
curl -X POST https://api.lunaos.ai/openclaw/register \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "gatewayUrl": "wss://my-machine.tail12345.ts.net:18789",
    "token": "your_gateway_token",
    "label": "Home Mac"
  }'

# Check Gateway status
curl https://api.lunaos.ai/openclaw/status \
  -H "Authorization: Bearer $LUNAOS_API_KEY"

# Dispatch an agent to your Gateway
curl -X POST https://api.lunaos.ai/openclaw/dispatch \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "Review my auth middleware in src/middleware/auth.ts"
  }'
```

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key. Get one at https://agents.lunaos.ai/dashboard/api-keys
- `LUNAOS_API_URL`: (Optional) Override API URL (default: `https://api.lunaos.ai`)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw Plugin                         │
│  luna_run  │  luna_chain  │  luna_search  │  luna_index     │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP / SSE
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               LunaOS Engine API (Cloudflare Worker)         │
│                                                             │
│  /openclaw/tools/*     → Native tool endpoints              │
│  /openclaw/analytics/* → Usage metrics & analytics          │
│  /openclaw/register    → Gateway registration               │
│  /openclaw/dispatch    → Remote agent dispatch (WebSocket)  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   D1 (SQL)   │  │   KV Cache   │  │  Vectorize   │      │
│  │  Executions  │  │   Gateway    │  │  Code Index   │      │
│  │  Sessions    │  │   Configs    │  │  Embeddings   │      │
│  │  Analytics   │  │              │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT — LunaOS
