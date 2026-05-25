# Agents API

Execute AI agents and retrieve the agent catalog.

## List Agents

Get all available agents with their tier and description.

```http
GET /agents/list
```

**Response (200):**

```json
{
  "agents": [
    {
      "slug": "code-review",
      "name": "Code Review Agent",
      "role": "Expert code reviewer...",
      "category": "core",
      "tier": "free"
    },
    {
      "slug": "auth",
      "name": "Authentication & Authorization Agent",
      "role": "Expert authentication specialist...",
      "category": "solution",
      "tier": "pro"
    }
  ],
  "total": 140,
  "tiers": {
    "free": 140,
    "pro": 140
  }
}
```

---

## Execute Agent

Run an agent with streaming (SSE) response.

```http
POST /agents/execute
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "agent": "code-review",
  "context": "function login(u, p) { return db.query(`SELECT * FROM users WHERE email='${u}'`) }",
  "provider": "deepseek",
  "model": "deepseek-chat"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent` | string | ✅ | Agent slug (e.g., `code-review`, `testing-validation`) |
| `context` | string | ✅ | The code, requirements, or prompt to analyze |
| `provider` | string | ❌ | LLM provider: `deepseek`, `anthropic`, `openai` (default: `deepseek`) |
| `model` | string | ❌ | Specific model (default: provider's default) |

**Response (200 SSE stream):**

```
data: {"type":"start","agent":"code-review","model":"deepseek-chat"}

data: {"type":"chunk","content":"## Security Issues\n\n### 🔴 Critical..."}

data: {"type":"chunk","content":"SQL Injection vulnerability detected..."}

data: {"type":"done","tokens":{"input":245,"output":602},"cost":"$0.0003","duration":"1.2s"}
```

**Usage Headers:**

Every execution response includes usage headers:

```http
X-RateLimit-Used: 12
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 48
X-RateLimit-Reset: 1711843260
```

---

## Pro Agent Access

When a **free** user attempts to execute a **Pro** agent:

**Response (403):**

```json
{
  "error": "Pro subscription required",
  "code": "pro_required",
  "agent": "auth",
  "agentName": "Authentication & Authorization Agent",
  "upgradeUrl": "https://agents.lunaos.ai/pricing",
  "checkoutUrl": "https://api.lunaos.ai/billing/checkout",
  "message": "🔒 Authentication & Authorization Agent is a Pro feature. Upgrade to Pro for managed keys, 33 MCP servers, RAG, and Visual QA."
}
```

---

## Example: Full Workflow

```bash
# 1. Login
TOKEN=$(curl -s -X POST https://api.lunaos.ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"pass123"}' | jq -r '.token')

# 2. List available agents
curl -s https://api.lunaos.ai/agents/list | jq '.agents[] | .slug'

# 3. Run code review (streaming)
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "'"$(cat src/app.ts)"'"
  }'

# 4. Run with API key instead
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer lnos_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"agent": "testing-validation", "context": "..."}'
```

## Supported Providers & Models

| Provider | Model | Notes |
|----------|-------|-------|
| `deepseek` | `deepseek-chat` | Default. Fast, cost-effective |
| `deepseek` | `deepseek-reasoner` | R1 reasoning model |
| `anthropic` | `claude-sonnet-4-20250514` | High quality |
| `openai` | `gpt-4o` | GPT-4 Omni |
| `openai` | `gpt-4o-mini` | Faster, cheaper |
