---
name: opensyber-claw-sdk
description: Use when a user wants to call LLMs (Anthropic, OpenAI, Workers AI) through the OpenSyber Claw Gateway — a shared AI proxy with caching, sessions, and project-scoped API keys. Covers ClawClient usage, streaming, multi-turn sessions, and cost savings.
---

# OpenSyber Claw SDK

Claw is OpenSyber's shared AI gateway — a Cloudflare Worker + Durable Objects setup that proxies LLM calls for all portfolio projects through one unified interface. The `@opensyber/claw-sdk` TypeScript client is how applications call it. 30–50% cost reduction vs direct provider calls via prompt caching + smart routing.

## When to use this skill

User mentions: "Claw Gateway", "ClawClient", "@opensyber/claw-sdk", "Claw session", "shared LLM proxy", "prompt caching", "AI gateway", "CLAWPIPE_API_KEY".

## Quickstart

```ts
import { ClawClient } from '@opensyber/claw-sdk'

const claw = new ClawClient({
  baseUrl: 'https://claw.opensyber.cloud',
  apiKey: process.env.CLAW_API_KEY,
  project: 'my-project-slug',
})

// One-shot prompt
const result = await claw.prompt({
  model: 'opus',
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Summarize this finding...' }],
})

console.log(result.text)
```

## Model aliases

The SDK provides stable aliases that route to the latest model in each family:

| Alias | Resolves to (May 2026) |
|-------|------------------------|
| `opus` | claude-opus-4-7 |
| `sonnet` | claude-sonnet-4-6 |
| `haiku` | claude-haiku-4-5 |
| `gpt-4o` | gpt-4o (OpenAI) |
| `llama` | Workers AI Llama 3.3 |

Use aliases instead of pinned model IDs unless you have a specific reason to pin (eval reproducibility).

## Streaming

```ts
const stream = await claw.stream({
  model: 'sonnet',
  messages: [{ role: 'user', content: longPrompt }],
})

for await (const chunk of stream) {
  process.stdout.write(chunk.delta)
}
```

The stream parser handles SSE framing and yields `{ delta, type, usage }` events.

## Multi-turn sessions

Sessions persist conversation state in a Durable Object with SQLite. Useful for long agent runs.

```ts
const session = await claw.sessions.create({
  model: 'opus',
  system: 'You are a security analyst...',
})

await session.send('Triage finding A')
await session.send('Now correlate with finding B')

const history = await session.history()
await session.close()
```

Sessions are billed per-token but reuse cached system prompts — meaningful savings on multi-turn flows.

## Prompt caching

Claw automatically caches stable prefixes (`system` and early `messages`) for Anthropic models with `cache_control` markers, and uses OpenAI's cached_input pricing for GPT models. No client changes needed. Verify by checking `result.usage.cacheRead` vs `usage.cacheWrite`.

## Project scoping

Every API key is bound to one project (`my-project-slug`). Lets the gateway:
- Attribute usage and cost per project
- Apply per-project rate limits
- Issue dashboards split by team

Register a project via the gateway admin script:

```bash
cd apps/claw-gateway
./scripts/register-project.sh my-project "My Project"
# Returns the API key — store it as CLAW_API_KEY in your env
```

## Server middleware

The gateway authenticates every request with SHA-256 hashed API keys + timing-safe comparison. Auth lives in `apps/claw-gateway/src/middleware/`. Project ↔ key mapping is in KV.

## Integration with OpenSyber skills

The shared LLM helper at `skills/shared/llm.js` already prefers Claw when `CLAWPIPE_API_KEY` is set in the agent env. Means runtime skills like `ai-triage` automatically get Claw's cost savings without code changes.

```js
// inside a runtime skill — no Claw import needed
const { askLLM } = require('../shared/llm.js')
const { text, usage } = await askLLM(systemPrompt, userPrompt)
// Auto-routes through Claw if CLAWPIPE_API_KEY env present
```

## Do not

- Do not pin model IDs in user-facing copy. Use aliases — the gateway swaps the underlying model when new versions ship.
- Do not store the Claw API key on the client. It is server-only.
- Do not implement your own streaming SSE parser. Use `claw.stream()` — the SDK handles edge cases (heartbeats, half-frames, reconnect).
- Do not bypass session close. Open sessions accrue idle costs until TTL expires.
