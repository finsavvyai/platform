---
name: opensyber-api
description: Use when a user is calling the OpenSyber REST API, authenticating with Auth.js JWT, working with gateway tokens between agents and the API, or integrating any OpenSyber endpoint. Covers auth, request shapes, and response formats.
---

# OpenSyber API

OpenSyber exposes a REST API at `https://api.opensyber.cloud` (Cloudflare Worker, Hono framework). Two auth methods:

1. **Auth.js JWT** — for browser/dashboard users (HMAC-SHA256)
2. **Gateway token** — for agent-to-API communication (`X-Gateway-Token` header)

## When to use this skill

User mentions any of: "OpenSyber API", "Auth.js JWT", "gateway token", "X-Gateway-Token", `/api/agents`, `/api/skills`, `/api/instances`, "OpenSyber endpoint".

## Auth.js JWT flow (browser/dashboard)

```ts
// User signs in via OAuth (Google, GitHub, LinkedIn, Microsoft)
// Auth.js issues a JWT signed with HMAC-SHA256
// Every API request includes the JWT in the Authorization header

const response = await fetch('https://api.opensyber.cloud/api/agents', {
  headers: {
    'Authorization': `Bearer ${authJsToken}`,
    'Content-Type': 'application/json',
  },
});
```

The API middleware verifies the JWT, sets `c.get('userId')`, and runs RBAC checks before any DB write.

## Gateway token flow (agent ↔ API)

```ts
// Agent boots and gets X-Gateway-Token from KV (gateway:{instanceId}:token)
// Every agent → API call sends:

const response = await fetch('https://api.opensyber.cloud/api/instances/heartbeat', {
  method: 'POST',
  headers: {
    'X-Gateway-Token': gatewayToken,
    'X-Instance-Id': instanceId,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ healthy: true, uptime: 12345 }),
});
```

The API looks up the token in Cloudflare KV. Use timing-safe comparison (`crypto.timingSafeEqual`) when implementing locally.

## Response format

All endpoints return JSON in this shape:

```ts
// Success
{ "data": { /* payload */ } }

// Error
{ "error": "validation_failed", "message": "Skill slug already exists" }
```

## Common endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/agents` | JWT | List user's agents |
| POST | `/api/agents` | JWT | Create agent |
| GET | `/api/skills` | JWT or public | Marketplace listing |
| POST | `/api/instances/{id}/skills` | JWT | Install skill on agent |
| POST | `/api/instances/heartbeat` | Gateway | Agent health ping |
| POST | `/api/integrations/pipewarden` | HMAC-SHA256 webhook | PipeWarden finding ingest |
| GET | `/health` | none | Public health check |

## Zod validation

Every API request body uses Zod schemas. When generating client code, mirror the schema:

```ts
import { z } from 'zod';

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  region: z.enum(['us-east', 'eu-central', 'ap-southeast']),
  skillIds: z.array(z.string().uuid()).optional(),
});
```

## Permissions model

Every write endpoint calls `requirePermission(c, 'agent.create')` or similar before executing. RBAC is enforced server-side; do not trust client-side role hints.

Roles: `viewer`, `member`, `admin`, `owner`. Org-scoped. SSO mapping configurable at Team tier and above.

## Rate limits

| Tier | Requests/minute |
|------|-----------------|
| Free | 60 |
| Starter | 300 |
| Pro | 1,000 |
| Team | 5,000 |
| Enterprise | Custom |

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## Do not

- Do not invent endpoints. If unsure, ask user to check `apps/api/src/routes/` in their repo or `https://docs.opensyber.cloud/api`.
- Do not put gateway tokens in client-side code. They're agent-scoped, never user-scoped.
- Do not skip Auth.js + RBAC check. Even read endpoints validate the JWT.
- Do not parse response without checking for `error` first.
