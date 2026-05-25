---
name: opensyber-runtime-skills
description: Use when a user is building a runtime security skill for OpenSyber agents — a Node.js worker_thread module installable from the marketplace. Covers manifest format, handler structure, message protocol, and marketplace publishing.
---

# OpenSyber Runtime Skills

A **runtime skill** in OpenSyber is a Node.js module that runs as a `worker_thread` inside a hosted agent. It listens for messages from the agent daemon and posts results back. Skills are sandboxed and distributed via the marketplace at https://opensyber.cloud/marketplace.

## When to use this skill

User wants to: "build an OpenSyber skill", "publish to the OpenSyber marketplace", "create a runtime security module", "write a worker_thread skill", "extend an OpenSyber agent".

## Disambiguation

This is **not** about Anthropic Agent Skills (the markdown-instruction format). Runtime skills are executable Node.js code that runs on a Hetzner VM inside the agent process. Different concept, same word.

## Anatomy of a skill

```
my-skill/
├── manifest.json     # Metadata + permissions
└── index.js          # Worker thread handler
```

## manifest.json

```json
{
  "name": "My Skill",
  "slug": "my-skill",
  "version": "1.0.0",
  "description": "One-sentence summary of what this skill does.",
  "entrypoint": "index.js",
  "permissions": {
    "network": ["api.example.com"],
    "filesystem": ["./data/"],
    "env": ["MY_API_KEY"]
  },
  "author": "your-handle",
  "minAgentVersion": "0.2.0",
  "status": "live"
}
```

Permissions are enforced by the agent sandbox. Anything not listed is denied. The `status` field can be `live`, `ready` (needs env config), or `coming-soon` (manifest only, no implementation yet).

## index.js handler

```js
const { parentPort } = require('node:worker_threads')

console.log('[my-skill] Started')

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'my_event_type') return

    try {
      const result = await doWork(msg.data)
      parentPort.postMessage({
        type: 'my_result',
        data: result,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      parentPort.postMessage({ type: 'error', skill: 'my-skill', message: err.message })
    }
  })
}

async function doWork(input) {
  // Skill logic here
  return { ok: true }
}
```

## Common message types

| Inbound (agent → skill) | Outbound (skill → agent) |
|-------------------------|--------------------------|
| `security_event` | `triage_result` |
| `finding` | `remediation` |
| `llm_input` | `defence_result` |
| `scan_request` | `scan_result` |
| `incident` | `incident_report` |

## LLM-powered skills

Use the shared LLM client at `../shared/llm.js`. It auto-detects `CLAWPIPE_API_KEY` (OpenSyber's Claw Gateway, 30-50% cost reduction) and falls back to direct Anthropic/OpenAI calls.

```js
const { askLLM, parseJSON } = require('../shared/llm.js')

const SYSTEM_PROMPT = `You are a security triage specialist...`
const { text, usage } = await askLLM(SYSTEM_PROMPT, userPrompt)
const result = parseJSON(text)
```

## Publishing to marketplace

1. `pnpm skill:test` — local validation
2. `pnpm skill:bundle` — packages to `.tar.gz`
3. `pnpm skill:publish --slug my-skill` — uploads to R2, creates `marketplace_submissions` row
4. Wait for security scan + manual review (`status: pending → scanning → reviewing → approved`)
5. Once `approved`, your skill appears in the public marketplace and you receive 70% revenue share on paid installs

## Best practices

- **One responsibility per skill.** A "log analyzer + Slack notifier + IAM scanner" is three skills.
- **Fail open by default for guards.** If a guard skill cannot reach its dependency, allow the action and log loudly. Blocking on guard failure creates outages.
- **Buffer + batch.** If your skill calls an LLM, buffer findings for ~10s and batch — saves cost and reduces rate-limit hits.
- **Cap input size.** Refuse messages over a known threshold (100K chars is a reasonable default).
- **No mutable global state.** Each agent restart creates a fresh worker_thread; do not rely on in-memory persistence between runs.

## Do not

- Do not call `process.exit()` from a skill. Let the agent supervisor manage lifecycle.
- Do not bypass the permissions in `manifest.json`. The sandbox rejects unlisted network/filesystem access.
- Do not commit secrets. Use env vars declared in `permissions.env`.
- Do not invent skill APIs. The message protocol is what is documented here; if a feature is missing, file an issue.
