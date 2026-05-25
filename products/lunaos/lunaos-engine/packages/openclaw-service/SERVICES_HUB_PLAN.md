# OpenClaw Services Hub — Implementation Plan

> **Goal**: Users see, connect, configure, and manage ALL OpenClaw-enabled services
> from the Luna dashboard — not just channels, but agents, chains, RAG, gateways,
> analytics, and every capability that Claws enable.

---

## Vision

```
┌───────────────────────────────────────────────────────────────┐
│                    Luna Dashboard — Services Hub              │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 🤖 Agents│ │ 🔗 Chains│ │ 🔍 RAG   │ │ 🌐 Gateways     │ │
│  │ 28 active│ │ 5 presets│ │ 3 indexes│ │ 2 connected      │ │
│  │ Configure│ │ Build    │ │ Manage   │ │ Register         │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 💬 Slack │ │ 📱 WA    │ │ 🎮 Disc  │ │ ✈️ Telegram      │ │
│  │ ✅ Active│ │ ⏳ Setup │ │ ➕ Add   │ │ ✅ Active        │ │
│  │ 142 msgs │ │          │ │          │ │ 89 msgs          │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 🔗 Webhk │ │ 📊 Anlyt │ │ 🛡️ Keys │ │ ⚙️ Settings      │ │
│  │ 3 hooks  │ │ Live     │ │ 2 active │ │ Preferences      │ │
│  │ Create   │ │ Dashboard│ │ Generate │ │ Configure        │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## What's Done ✅

### Backend (OpenClaw Service — Cloudflare Worker)

| Component | File | Status |
|-----------|------|--------|
| Service types + AppEnv | `src/types.ts` | ✅ |
| Auth middleware (JWT/API Key/Service Key) | `src/middleware/auth.ts` | ✅ |
| Tool routes (agent exec, chains, RAG) | `src/routes/tools.ts` | ✅ |
| Gateway management routes | `src/routes/gateways.ts` | ✅ |
| Analytics routes | `src/routes/analytics.ts` | ✅ |
| Cross-platform bridge | `src/routes/bridge.ts` | ✅ |
| **Channel connections (self-service)** | `src/routes/channels.ts` | ✅ |
| **Channel DB migration** | `src/migrations/001_channels.sql` | ✅ |
| Worker entrypoint | `src/index.ts` | ✅ |
| LunaOS client (Service Binding + HTTP) | `api/src/services/openclaw-client.ts` | ✅ |
| OpenHands bridge | `openhands-ai-engine/src/services/openclaw-bridge.ts` | ✅ |
| OpenHands Luna routes | `openhands-ai-engine/src/index.ts` | ✅ |
| TS compilation | 0 errors | ✅ |
| Wrangler build | 129KB / 30KB gzip | ✅ |

---

## What's Next — The Services Hub

### Phase 1: Services Registry API (Backend)
**New file: `src/routes/services.ts`**

A unified `/services` endpoint that returns ALL available OpenClaw services as a catalog
the dashboard can render. Each service has status, configuration, and actions.

```
GET /services           → List all service categories with status
GET /services/:id       → Get specific service config + capabilities
PATCH /services/:id     → Enable/disable or configure a service
POST /services/:id/test → Test a specific service
```

**Service categories to expose:**

1. **Agents** — List of 28+ agents, each user can enable/disable, set defaults, customize prompts
2. **Chains** — Multi-agent pipeline presets, users can create custom chains
3. **RAG/Search** — Manage vector indexes, view indexed files, trigger reindexing
4. **Gateways** — Already done via `/gateways`, wrap in services catalog
5. **Channels** — Already done via `/channels`, wrap in services catalog
6. **Analytics** — Already done via `/analytics`, wrap in services catalog
7. **API Keys** — Manage API keys for programmatic access
8. **Webhooks** — Custom webhook endpoints (subset of channels)
9. **Providers** — LLM provider config (which API keys are set, default provider)
10. **Billing/Usage** — Usage quotas, plan limits, upgrade prompts

### Phase 2: LunaOS Engine API Routes
**New/updated file: `api/src/routes/openclaw-services.ts`**

Proxy routes from the LunaOS API to the OpenClaw service, so the dashboard
can call the LunaOS API and reach all OpenClaw capabilities.

```
GET  /api/services                    → Services catalog overview
GET  /api/services/agents             → Agent catalog + user preferences
GET  /api/services/channels           → Channel connections
POST /api/services/channels/connect   → Connect a channel
GET  /api/services/gateways           → Gateway connections
GET  /api/services/analytics          → Usage analytics
GET  /api/services/providers          → LLM provider status
POST /api/services/:category/:action  → Generic service action
```

### Phase 3: Dashboard UI (Luna Frontend)
**New pages in the LunaOS dashboard:**

1. **`/services`** — Services Hub home
   - Grid/card layout showing all service categories
   - Each card shows: icon, name, status indicator, quick stats, action button
   - Real-time health indicators (green/yellow/red)
   
2. **`/services/agents`** — Agent Catalog
   - Browse all 28+ agents with descriptions
   - Toggle agents on/off per user
   - Set default agent, customize system prompts
   - View per-agent usage stats
   
3. **`/services/channels`** — Channel Connections
   - "Connect Slack" / "Connect Discord" buttons with OAuth flow
   - WhatsApp / Telegram setup wizards
   - Custom webhook creation
   - Per-channel message stats and test buttons
   
4. **`/services/chains`** — Multi-Agent Chains
   - Visual chain builder (drag agent nodes)
   - Preset chains (full-review, security-pipeline, etc.)
   - Custom chain creation and testing
   
5. **`/services/rag`** — Knowledge Base
   - View indexed files/repos
   - Trigger manual reindexing
   - Search preview within dashboard
   
6. **`/services/gateways`** — Gateway Management
   - Register remote gateways
   - Health check + ping
   - View gateway execution history
   
7. **`/services/analytics`** — Usage Dashboard
   - Total executions, by agent, by channel, by provider
   - Response time trends
   - Token usage and costs
   - Export capabilities
   
8. **`/services/keys`** — API Key Management
   - Generate / revoke API keys
   - Per-key usage stats
   - Key scoping (which services each key can access)

9. **`/services/providers`** — LLM Provider Config
   - Add API keys for DeepSeek, Anthropic, OpenAI
   - Set default provider
   - Test provider connectivity
   - View per-provider usage

---

## Execution Order

| Step | What | Est. |
|------|------|------|
| 1 | ✅ Channel connections API | Done |
| 2 | Services registry API (`src/routes/services.ts`) | ~1h |
| 3 | LunaOS proxy routes (`api/src/routes/openclaw-services.ts`) | ~30m |
| 4 | D1 migration for services/preferences | ~15m |
| 5 | Dashboard Services Hub page | ~2h |
| 6 | Dashboard Channel connection page | ~1.5h |
| 7 | Dashboard Agent catalog page | ~1h |
| 8 | Dashboard Analytics page | ~1h |
| 9 | Dashboard Settings/Keys pages | ~1h |
| 10 | Deploy and test | ~30m |

---

## Architecture

```
                    ┌──────────────────────┐
                    │   Luna Dashboard     │
                    │   (Next.js/Vite)     │
                    └─────────┬────────────┘
                              │  HTTP
                    ┌─────────▼────────────┐
                    │   LunaOS Engine API  │
                    │   /api/services/*    │
                    └─────────┬────────────┘
                              │  Service Binding / HTTP
                    ┌─────────▼────────────┐
                    │   OpenClaw Service   │
                    │   /services          │
                    │   /channels          │
                    │   /tools             │ ── D1 + KV + Vectorize
                    │   /gateways          │
                    │   /analytics         │
                    │   /bridge            │
                    └─────────┬────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │  Slack   │    │  WA     │    │ Discord │ ...
         │Workspace│    │Business │    │ Server  │
         └─────────┘    └─────────┘    └─────────┘
```
