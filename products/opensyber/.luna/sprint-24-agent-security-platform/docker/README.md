# OpenSyber Docker Configuration

## ⚠️ Important Note

**OpenSyber uses Cloudflare Workers for production deployment**, which is a serverless edge computing platform. Docker configurations provided here are primarily for:

- ✅ **Local Development** - Run web apps locally in containers
- ✅ **Testing** - Run tests in isolated environments
- ✅ **CI/CD** - Build and validate code in containers
- ❌ **NOT for Production** - Production deploys to Cloudflare Edge via `wrangler deploy`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Production (Cloudflare)                   │
├─────────────────────────────────────────────────────────────┤
│  apps/api           → Cloudflare Workers (Hono)            │
│  apps/tokenforge-api → Cloudflare Workers (Hono)            │
│  apps/web           → Cloudflare Pages (via OpenNext)       │
│  apps/tokenforge-web → Cloudflare Pages (via OpenNext)      │
│  Database           → D1 (SQLite at Edge)                   │
│  Storage            → R2 (S3-compatible)                    │
│  Cache              → KV (Key-Value store)                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Development (Docker)                      │
├─────────────────────────────────────────────────────────────┤
│  apps/web           → Docker Container (Node.js)           │
│  apps/tokenforge-web → Docker Container (Node.js)          │
│  Mock APIs          → Docker Containers (Express)          │
│  Local DB           → Docker Container (SQLite)            │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Development Environment
```bash
# Start all services
make dev

# Start specific service
make dev-web

# View logs
make logs

# Stop services
make down
```

### Testing in Docker
```bash
# Run all tests
make test

# Run specific package tests
make test-web
make test-api
```

### Building for Production
```bash
# Build Next.js apps (for Cloudflare Pages deployment)
make build
```

## Available Services

| Service | Description | Ports | Notes |
|---------|-------------|-------|-------|
| web | OpenSyber Next.js app | 3000 | Development only |
| tokenforge-web | TokenForge Next.js app | 3001 | Development only |
| mock-api | Mock API for web apps | 8787 | Simulates Workers APIs |
| db | Local SQLite database | N/A | Volume mounted |

## Production Deployment

For production, use the standard Cloudflare deployment:

```bash
# Deploy API to Workers
cd apps/api && pnpm deploy

# Deploy web to Pages
cd apps/web && pnpm deploy
```
