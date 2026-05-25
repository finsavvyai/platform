# OpenSyber — Managed AI Agent Security Platform

Deploy a secured AI agent in 60 seconds with real-time security monitoring, audited skill marketplace, and compliance.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| API | Hono on Cloudflare Workers |
| Auth | Auth.js (NextAuth v5) — Google, GitHub, LinkedIn, Microsoft |
| Database | Cloudflare D1 (SQLite) — ~103 tables via Drizzle ORM |
| Cache | Cloudflare KV |
| Storage | Cloudflare R2 |
| Compute | Hetzner Cloud — per-tenant VMs (1 CPU, 1GB, 20GB) |
| Sessions | TokenForge — ECDSA P-256 device-bound sessions |
| Payments | LemonSqueezy — subscriptions + marketplace revenue |
| AI Gateway | Claw Gateway — multi-provider LLM proxy (Anthropic/OpenAI/Workers AI) |
| Email | Resend API |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start all services in dev mode
pnpm dev

# Or start individually
cd apps/api && pnpm dev       # API on Cloudflare Workers (wrangler)
cd apps/web && pnpm dev       # Web on http://localhost:3000
```

## Project Structure

```
opensyber/
├── apps/
│   ├── api/                 # Cloudflare Worker (Hono) — 263 routes
│   ├── web/                 # Next.js 16 — 116 routes, 165 components
│   ├── agent/               # Node.js daemon — runs on Hetzner VMs
│   ├── claw-gateway/        # AI gateway — multi-provider LLM proxy
│   ├── tokenforge-api/      # TokenForge API
│   ├── tokenforge-web/      # TokenForge dashboard
│   ├── tokenforge-proxy/    # TokenForge proxy worker
│   └── redirects/           # Redirect handler
├── packages/
│   ├── db/                  # Drizzle ORM + D1 — 39 migrations
│   ├── shared/              # Types, constants, plan configs
│   ├── claw-sdk/            # AI gateway client SDK
│   ├── auth/                # Auth.js handlers
│   ├── skill-sdk/           # Skill definition + testing
│   ├── tokenforge/          # Device-bound session SDK
│   ├── ui/                  # Shared React components
│   └── ...
├── skills/                  # 6 AI skills + 3 bundled examples
└── docs/                    # Architecture, API, sprint history
```

## Environment

Required in `.env.local`:
```
NEXT_PUBLIC_API_URL=https://api.opensyber.cloud
AUTH_SECRET=<random-secret>
```

Optional (for full functionality):
```
LEMON_SQUEEZY_API_KEY=...
RESEND_API_KEY=...
ANTHROPIC_API_KEY=...
# Sentry client + server error reporting (web app). If unset, Sentry is a no-op.
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_ORG=opensyber
SENTRY_PROJECT=web
SENTRY_AUTH_TOKEN=...   # only needed to upload source maps from CI
```

## Deployment

```bash
# API
cd apps/api && wrangler deploy

# Web
cd apps/web && wrangler pages deploy

# AI Gateway
cd apps/claw-gateway && wrangler deploy

# Database migrations
cd packages/db && pnpm db:migrate
```

## Testing

```bash
pnpm test                    # All unit tests
cd apps/web && npx playwright test  # E2E tests (194 specs)
cd apps/claw-gateway && npx playwright test  # Gateway API tests (36 specs)
```

## Current Pricing

| Plan | Price | Instances | Skills |
|---|---|---|---|
| Starter Shield | $0/mo | 1 | 3 verified |
| Team | $299/mo | 3 | Unlimited |
| Professional | $799/mo | 10 | Unlimited + AI |
| Enterprise | $2,499/mo | Unlimited | All + SSO |
| Mission Defender | $9,999/mo | Unlimited | All + SLA |
