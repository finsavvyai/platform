# API Reference

The LunaOS API is available at `https://api.lunaos.ai`. All endpoints return JSON and use standard HTTP status codes.

## Base URL

```
https://api.lunaos.ai
```

## Authentication

All API requests (except public endpoints) require authentication via one of:

| Method | Header | Format |
|--------|--------|--------|
| **JWT Token** | `Authorization: Bearer <token>` | Obtained from `/auth/login` |
| **API Key** | `Authorization: Bearer lnos_live_...` | Generated from `/api-keys` |

## Rate Limits

Rate limits are applied per-user/key and vary by tier:

| Tier | Limit | Window |
|------|-------|--------|
| Free | 60 req/min | 1 minute |
| Pro | 600 req/min | 1 minute |
| Team | 6,000 req/min | 1 minute |

Rate limit headers are included on every response:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1707500460
Server-Timing: total;dur=45
```

## Response Format

All responses follow a consistent format:

### Success

```json
{
  "data": { ... }
}
```

### Error

```json
{
  "error": "Description of the error",
  "code": "error_code",
  "detail": "Additional details (development only)"
}
```

## Endpoints Overview

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `GET` | `/health` | ❌ | Service health check |
| `POST` | `/auth/signup` | ❌ | Create account |
| `POST` | `/auth/login` | ❌ | Get JWT token |
| `GET` | `/auth/me` | ✅ | Current user info |
| `GET` | `/agents/list` | ❌ | List all agents |
| `POST` | `/agents/execute` | ✅ | Run an agent (SSE) |
| `GET` | `/chains` | ✅ | List chain presets |
| `POST` | `/chains/execute` | ✅ | Run a chain (SSE) |
| `POST` | `/rag/index` | ✅ | Index code for RAG |
| `POST` | `/rag/search` | ✅ | Search indexed code |
| `POST` | `/billing/checkout` | ✅ | Start Stripe checkout |
| `GET` | `/billing/subscription` | ✅ | Current subscription |
| `GET` | `/billing/usage` | ✅ | Monthly usage stats |
| `POST` | `/billing/cancel` | ✅ | Cancel subscription |
| `POST` | `/billing/portal` | ✅ | Stripe customer portal |
| `POST` | `/api-keys` | ✅ | Generate API key |
| `GET` | `/api-keys` | ✅ | List API keys |
| `DELETE` | `/api-keys/:id` | ✅ | Revoke an API key |

## Security

The API enforces enterprise-grade security:

- **HSTS** with 1-year max-age, includeSubDomains, preload
- **Content Security Policy** with strict source restrictions
- **X-Frame-Options: DENY** — prevents clickjacking
- **X-Content-Type-Options: nosniff** — prevents MIME sniffing
- **Cross-Origin isolation** (COOP, COEP, CORP)
- **Audit logging** for all security-relevant events

## Next Steps

- **[Authentication →](/api/authentication)** — Signup, login, JWT tokens
- **[Agents →](/api/agents)** — Execute agents with streaming
- **[Chains →](/api/chains)** — Multi-agent workflows
- **[Billing →](/api/billing)** — Subscriptions and usage
- **[API Keys →](/api/api-keys)** — Programmatic access
