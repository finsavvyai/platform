# AI Integration Guide — OpenSyber

How to use the Claw AI Gateway across OpenSyber and the portfolio.

## Architecture

```
Any Project → @opensyber/claw-sdk → claw-gateway (CF Worker) → LLM Provider
                                          │
                                    Durable Object
                                    (session state)
```

**Gateway URL:** `https://claw-gateway.broad-dew-49ad.workers.dev`
**Custom domain:** `https://claw.opensyber.cloud` (when DNS configured)

## SDK Quick Start

```typescript
import { ClawClient } from '@opensyber/claw-sdk'

const claw = new ClawClient({
  projectId: 'opensyber',
  apiKey: process.env.CLAW_API_KEY!,
  endpoint: 'https://claw-gateway.broad-dew-49ad.workers.dev',
})

// One-shot prompt
const response = await claw.prompt('Analyze this vulnerability...')

// Simple text answer
const text = await claw.ask('What is CVE-2024-3094?')

// Streaming
for await (const event of claw.stream('Generate a report...')) {
  // event.data contains StreamEventData
}

// Multi-turn session
const session = await claw.createSession({
  system: 'You are a security analyst.',
})
const turn1 = await session.message('What risks exist?')
const turn2 = await session.message('How do I fix the first one?')
await session.close()
```

## Model Aliases

| Alias | Provider | Model ID |
|---|---|---|
| `opus` | Anthropic | claude-opus-4-6 |
| `sonnet` | Anthropic | claude-sonnet-4-6 |
| `haiku` | Anthropic | claude-haiku-4-5-20251001 |
| `gpt-4o` | OpenAI | gpt-4o |
| `gpt-4o-mini` | OpenAI | gpt-4o-mini |
| `llama-70b` | Workers AI | @cf/meta/llama-3.3-70b-instruct-fp8-fast |

## Gateway API

### Public (no auth)
```
GET /health → { status, service, version, timestamp }
```

### Authenticated (Bearer + X-Project-Id)
```
POST /v1/prompt          → one-shot prompt (or stream with Accept: text/event-stream)
POST /v1/sessions        → create multi-turn session
POST /v1/sessions/:id/message → send message to session
GET  /v1/sessions/:id    → get conversation history
GET  /v1/sessions/:id/info → session metadata
POST /v1/sessions/:id/compact → compress history
DELETE /v1/sessions/:id  → close session
GET  /v1/sessions        → list active sessions
```

### Request Format
```json
{
  "prompt": "Your question here",
  "system": "Optional system prompt",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "maxTokens": 8192,
  "stream": false,
  "tools": []
}
```

### Response Format
```json
{
  "sessionId": "",
  "text": "Response text",
  "content": [{ "type": "text", "text": "Response text" }],
  "usage": { "inputTokens": 30, "outputTokens": 50 },
  "stopReason": "end_turn"
}
```

## Registering New Projects

```bash
cd apps/claw-gateway
./scripts/register-project.sh <project-id> "<Project Name>" [provider] [model]

# Examples:
./scripts/register-project.sh opensyber "OpenSyber"
./scripts/register-project.sh mcpoverflow "MCPOverflow" openai gpt-4o
./scripts/register-project.sh qestro "Qestro" anthropic claude-sonnet-4-6
```

## AI Skills Development

Skills that use LLM reasoning follow this pattern:

```javascript
// skills/my-ai-skill/index.js
const { parentPort } = require('node:worker_threads')
const { askLLM, parseJSON } = require('../shared/llm.js')

const SYSTEM_PROMPT = `You are a security analyst. Respond in JSON: { ... }`

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'security_event') return
    const { text } = await askLLM(SYSTEM_PROMPT, JSON.stringify(msg.data))
    const analysis = parseJSON(text)
    parentPort.postMessage({ type: 'enriched_finding', analysis })
  })
}
```

### Manifest for AI Skills
```json
{
  "name": "My AI Skill",
  "slug": "my-ai-skill",
  "version": "1.0.0",
  "entrypoint": "index.js",
  "permissions": {
    "network": ["api.anthropic.com"],
    "filesystem": ["./data/"],
    "env": ["LLM_API_KEY", "LLM_PROVIDER"]
  },
  "author": "opensyber",
  "minAgentVersion": "0.2.0"
}
```

### Existing AI Skills

| Skill | Purpose |
|---|---|
| `ai-reasoning-engine` | Root cause analysis + risk scoring |
| `ai-triage` | Batch finding prioritization |
| `ai-remediation` | Fix scripts + rollback procedures |
| `ai-compliance-writer` | SOC2/ISO/HIPAA/GDPR evidence |
| `ai-threat-intel` | CVE enrichment via NVD/CIRCL |
| `ai-incident-responder` | Attack chain correlation |

All bundled as "AI Security Analyst" ($99/mo premium bundle).

## Shared LLM Client

`skills/shared/llm.js` provides `askLLM(system, prompt, maxTokens)`:
- Reads `LLM_PROVIDER` env (default: `anthropic`)
- Reads `LLM_API_KEY` env (required)
- Reads `LLM_MODEL` env (optional override)
- Returns `{ text, usage: { input, output } }`
- Supports Anthropic and OpenAI providers

## Gateway Infrastructure

| Component | Location | Purpose |
|---|---|---|
| Worker | `apps/claw-gateway/src/index.ts` | Hono app + routing |
| Auth | `src/middleware/auth.ts` | SHA-256 API key validation |
| LLM Proxy | `src/services/llm-proxy.ts` | Multi-provider routing |
| Session DO | `src/session-do.ts` | Durable Object with KV state |
| Routes | `src/routes/` | prompt, sessions, health |
| KV: PROJECT_KEYS | `f1b64fb4d02a47ff9a9f82dda0af73d1` | Project configs |
| KV: USAGE | `68b561482503452db3da7c349332d1f4` | Usage metering |

## Secrets

Set via `wrangler secret put`:
- `ANTHROPIC_API_KEY` — Claude API access
- `OPENAI_API_KEY` — GPT API access (optional fallback)
