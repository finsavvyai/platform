# OpenClaw × LunaOS Remote Integration

## Overview

LunaOS integrates with OpenClaw **remotely** — your Luna agents running in the cloud can dispatch tasks to your OpenClaw Gateway running anywhere (home, office, server), giving them full execution power on your machine.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LunaOS Cloud API (api.lunaos.ai)                           │
│  Cloudflare Worker                                          │
│                                                             │
│  POST /openclaw/register    ← Register your Gateway         │
│  POST /openclaw/dispatch    ← Fire-and-forget dispatch      │
│  POST /openclaw/dispatch/stream ← Dispatch + stream results │
│  POST /openclaw/exec        ← Remote shell command          │
│  POST /openclaw/message     ← Send chat message             │
│  GET  /openclaw/status      ← Check Gateway connectivity    │
│  GET  /openclaw/sessions    ← List active sessions          │
└──────────────────────┬──────────────────────────────────────┘
                       │ WebSocket (wss://)
                       │ via Tailscale / SSH tunnel / VPN
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Your OpenClaw Gateway (any machine)                        │
│  ws://127.0.0.1:18789 → exposed as wss:// remotely          │
│                                                             │
│  Tools: exec, read/write, browser, web_search, cron,       │
│         memory, sessions_spawn, device control              │
│  Messaging: WhatsApp, Telegram, Slack, Discord, Signal      │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Guide

### Step 1: Expose your OpenClaw Gateway

**Option A: Tailscale Funnel (recommended)**
```bash
# On your OpenClaw machine
tailscale funnel 18789
# Gateway accessible at wss://your-machine.tail12345.ts.net:18789
```

**Option B: SSH tunnel**
```bash
# From your cloud/remote machine to your OpenClaw machine
ssh -N -L 18789:127.0.0.1:18789 user@your-openclaw-host
```

**Option C: Direct wss:// (with TLS)**
```bash
# Set a gateway token for authentication
export OPENCLAW_GATEWAY_TOKEN="your-secure-token"
openclaw gateway --bind 0.0.0.0
```

### Step 2: Register your Gateway with LunaOS

```bash
curl -X POST https://api.lunaos.ai/openclaw/register \
  -H "Authorization: Bearer YOUR_LUNA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gatewayUrl": "wss://your-machine.tail12345.ts.net:18789",
    "token": "your-openclaw-gateway-token",
    "label": "Home Mac"
  }'
```

Response:
```json
{
  "success": true,
  "gatewayId": "a1b2c3d4",
  "label": "Home Mac",
  "health": { "status": "ok" },
  "message": "Gateway registered and verified"
}
```

### Step 3: Use it

**Via CLI:**
```bash
# Remote OpenClaw via direct URL
luna run code-review --openclaw-url wss://your-machine.tail12345.ts.net:18789

# Remote via environment variables
export OPENCLAW_GATEWAY_URL=wss://your-machine.tail12345.ts.net:18789
export OPENCLAW_GATEWAY_TOKEN=your-token
luna run code-review --openclaw

# Through LunaOS cloud API (uses registered gateway)
luna run code-review --cloud --target openclaw
```

**Via API:**
```bash
# Dispatch a Luna agent to your remote OpenClaw
curl -X POST https://api.lunaos.ai/openclaw/dispatch \
  -H "Authorization: Bearer YOUR_LUNA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "Review src/api.ts for security vulnerabilities"
  }'

# Dispatch and stream results via SSE
curl -N https://api.lunaos.ai/openclaw/dispatch/stream \
  -H "Authorization: Bearer YOUR_LUNA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "security-audit",
    "context": "Full security audit of the project"
  }'

# Remote shell command
curl -X POST https://api.lunaos.ai/openclaw/exec \
  -H "Authorization: Bearer YOUR_LUNA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "command": "npm test" }'

# Check gateway status
curl https://api.lunaos.ai/openclaw/status \
  -H "Authorization: Bearer YOUR_LUNA_TOKEN"
```

---

## API Reference

### POST /openclaw/register
Register your OpenClaw Gateway. LunaOS verifies connectivity before saving.

| Field | Type | Required | Description |
|---|---|---|---|
| `gatewayUrl` | string | ✅ | `wss://` or `ws://` URL |
| `token` | string | ✅ | Gateway auth token |
| `label` | string | | Human label ("Home Mac") |
| `setDefault` | boolean | | Set as default gateway (default: true) |

### POST /openclaw/dispatch
Fire-and-forget: dispatches a Luna agent as a sub-session. Returns immediately with session info.

| Field | Type | Required | Description |
|---|---|---|---|
| `agent` | string | ✅ | Luna agent slug |
| `context` | string | ✅ | Task context/code |
| `model` | string | | Override LLM model |
| `gatewayId` | string | | Specific gateway (if multiple) |
| `timeoutSeconds` | number | | Max execution time (default: 300) |

### POST /openclaw/dispatch/stream
Same as dispatch but keeps the SSE connection open and streams results as they appear.

**SSE Events:**
- `connected` — Gateway connection established
- `spawned` — Agent session created (includes sessionKey, runId)
- `token` — Agent output text
- `heartbeat` — Polling status
- `done` — Execution complete
- `error` — Error occurred

### POST /openclaw/exec
Execute a shell command on the remote machine.

### POST /openclaw/message
Send a chat message to the Gateway's active agent.

### GET /openclaw/status
Check if your registered Gateway is reachable.

### GET /openclaw/sessions
List active sessions on your Gateway.

---

## What This Enables

| Scenario | How |
|---|---|
| **"Review my code and fix bugs"** | Luna code-review agent dispatched to your OpenClaw → analyzes code → applies fixes via `edit` tool |
| **"Run security audit and patch vulnerabilities"** | Luna 365-security agent → finds issues → OpenClaw runs `npm audit fix` |
| **"Generate tests and verify they pass"** | Luna testing agent → writes tests → OpenClaw saves files → runs `npm test` |
| **"Deploy to production"** | Luna deployment agent → generates deploy script → OpenClaw executes it |
| **"Schedule daily code review"** | Luna agent + OpenClaw `cron` → automated daily analysis |
| **"Research and summarize"** | Luna agent → OpenClaw `web_search` + `web_fetch` → researches topic |
| **"Send me results on WhatsApp"** | OpenClaw routes agent output to your WhatsApp/Telegram/Slack |

---

## Files

### Server-side (LunaOS API)
| File | Description |
|---|---|
| `packages/api/src/routes/openclaw.ts` | All /openclaw/* routes — register, dispatch, dispatch/stream, exec, message, status, sessions |
| `packages/api/src/worker.ts` | Mounts openclawRoutes at /openclaw |

### Client-side (Luna CLI)
| File | Description |
|---|---|
| `cli/src/core/openclaw-client.ts` | WebSocket client with typed OpenClaw protocol, supports local + remote |
| `cli/src/commands/run.ts` | `--openclaw`, `--openclaw-url`, `--openclaw-token` flags |

### OpenClaw Skills (for OpenClaw → Luna direction)
| File | Description |
|---|---|
| `openclaw-skills/luna-*/SKILL.md` | 7 ready-to-use skills |
| `openclaw-skills/index.ts` | Plugin registering luna_run, luna_chain, luna_search, luna_index |
| `openclaw-skills/openclaw.plugin.json` | Plugin manifest |

---

## Security

- **wss:// required for remote** — Plain ws:// only allowed for localhost
- **Gateway token** — Stored encrypted in KV, sent in WebSocket handshake
- **LunaOS auth** — All /openclaw/* endpoints require JWT/API key auth
- **Device pairing** — OpenClaw's native device approval system applies
- **Tailscale recommended** — Zero-config WireGuard mesh for secure remote access
