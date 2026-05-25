# OpenSyber Architecture

## System Overview

```
┌────────────────────────────────────────────────────────────────┐
│  Users (Browser)                                                │
│  Dashboard, Marketplace, Admin Panel                           │
└───────────────────────┬────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌───────────────────────────────────────────────────────────────┐
│  Cloudflare Edge                                               │
│                                                                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Web App     │  │ API Worker   │  │ Claw Gateway         │ │
│  │ (Pages)     │  │ (Hono)       │  │ (AI Proxy)           │ │
│  │ Next.js 16  │  │ 263 routes   │  │ Claude/GPT/Workers AI│ │
│  └─────────────┘  └──────┬───────┘  └──────────────────────┘ │
│                           │                                    │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐       │
│  │ D1       │  │ KV       │  │ R2     │  │ Durable  │       │
│  │ (SQLite) │  │ (Cache)  │  │ (Blobs)│  │ Objects  │       │
│  │ 103 tbl  │  │ Tokens   │  │ Skills │  │ Sessions │       │
│  └──────────┘  └──────────┘  └────────┘  └──────────┘       │
└───────────────────────────────────────────────────────────────┘
                        │
                        │ Gateway Token Auth
                        ▼
┌───────────────────────────────────────────────────────────────┐
│  Hetzner Cloud (per-tenant VM)                                 │
│                                                                │
│  ┌─────────────────────┐  ┌──────────────────────────────┐   │
│  │ OpenSyber Agent     │  │ Docker Container             │   │
│  │ (Node.js daemon)    │  │ (node:22-slim + osquery)     │   │
│  │                     │  │                              │   │
│  │ - Health monitor    │  │ Skills run in Worker threads │   │
│  │ - Security monitor  │  │ - Sandboxed network         │   │
│  │ - Shell auditor     │  │ - Sandboxed filesystem      │   │
│  │ - Network monitor   │  │ - Credential isolation      │   │
│  │ - Firewall (iptbl)  │  │ - 64MB memory limit         │   │
│  └─────────────────────┘  └──────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
Browser → Auth.js (OAuth: Google/GitHub/LinkedIn/Microsoft)
       → HMAC-SHA256 JWT issued
       → API validates via authMiddleware → c.get('userId')
       → RBAC check → DB operation → JSON response

Agent  → X-Gateway-Token + X-Instance-Id headers
       → KV lookup (gateway:{instanceId}:token)
       → Timing-safe comparison → proceed
```

## Data Layer

| Store | Technology | Purpose |
|---|---|---|
| Primary DB | Cloudflare D1 (SQLite) | 103 tables, Drizzle ORM, 39 migrations |
| Cache | Cloudflare KV | Gateway tokens, rate limits, health metrics |
| Blob Storage | Cloudflare R2 | Skill packages (.tar.gz), audit logs |
| Session State | Durable Objects | AI conversation sessions (claw-gateway) |

## Skill Execution Model

Skills run as isolated Node.js Worker threads inside Docker on Hetzner VMs:

1. Agent reads `manifest.json` — declares network, filesystem, env permissions
2. Runner spawns Worker with **only** declared env vars (host env stripped)
3. Network restricted to declared domains (iptables allowlist)
4. Filesystem restricted to declared paths (path traversal blocked)
5. 47 sensitive env keys permanently blocked (AWS, Azure, GCP, tokens)
6. Skills communicate via `parentPort.postMessage()`

## AI Gateway (Claw)

Shared LLM proxy serving all portfolio projects:

- **Gateway Worker** — auth, rate limiting, usage metering
- **Durable Objects** — session state with KV storage
- **AI Gateway** — provider fallback (Anthropic → OpenAI → Workers AI)
- **Client SDK** — `@opensyber/claw-sdk` (zero-dependency TypeScript)

## Key Security Properties

- 5-layer defense in depth (network, filesystem, credential, process, supply chain)
- Timing-safe token comparison
- UNC6426 attack prevention (credential isolation)
- Known exfiltration domain blocking
- Source code scanning on skill submission
- Verification pipeline (pending → scanning → reviewing → approved)
