# LunaOS Platform — CLAUDE.md

> **Portfolio Tracker**: Product Hunt Launch April 2026 | **Readiness**: 97% | **Category**: SHIP

## Mission
Deploy scalable AI agent workflows in minutes with visual IDE, CLI orchestration, mobile management—multi-product AI agent platform shipped on Cloudflare edge infrastructure.

## Code Map & Index

### Multi-Repo Structure (10 Products)
```
lunaos-repos/
├── luna-agents/              # CLI & Agent Orchestration — Node.js + MCP
│   ├── src/
│   │   ├── cli.ts           # Commander.js CLI entry point
│   │   ├── mcp-server/      # MCP protocol implementation
│   │   ├── agents/          # Agent types, registry, lifecycle
│   │   └── transport/       # Cloudflare Workers communication
│   ├── package.json
│   └── dist/               # npm: luna-agents
│
├── lunaos-engine/           # Core API — Cloudflare Workers + Hono
│   ├── src/
│   │   ├── index.ts        # Hono app + routes
│   │   ├── routes/         # API endpoints (workflows, agents, runs, logs)
│   │   ├── services/       # Business logic (scheduling, execution, state)
│   │   ├── db/             # Prisma + D1 queries
│   │   ├── middleware/     # Auth (API keys), CORS, rate limiting
│   │   └── cron/           # Scheduled jobs (heartbeat, cleanup)
│   ├── prisma/schema.prisma # D1 schema (30+ tables)
│   ├── wrangler.toml       # Cloudflare config
│   └── api.lunaos.ai       # Production domain
│
├── lunaos-dashboard/        # Admin & Team Dashboard — Next.js 14
│   ├── src/
│   │   ├── app/            # Pages (orgs, users, billing, audit logs)
│   │   ├── components/     # 40+ React components
│   │   ├── lib/            # Services, hooks, utilities
│   │   ├── stores/         # Zustand state management
│   │   └── styles/         # Tailwind, design tokens
│   ├── next.config.js
│   └── agents.lunaos.ai    # Production domain
│
├── lunaos-studio/           # Visual IDE — Vite + React + ReactFlow
│   ├── src/
│   │   ├── pages/          # Editor, flows, runs, marketplace
│   │   ├── components/     # Canvas, nodeTypes, sidebar, inspector
│   │   ├── lib/            # Flow builder, execution simulator
│   │   ├── stores/         # Zustand (flows, nodes, selected)
│   │   └── services/       # API client, export, versioning
│   ├── vite.config.ts
│   └── studio.lunaos.ai    # Production domain
│
├── lunaos-docs/             # Documentation — VitePress
│   ├── docs/
│   │   ├── guide/          # Getting started, installation
│   │   ├── api/            # OpenAPI reference
│   │   ├── examples/       # Workflow templates, use cases
│   │   └── troubleshooting/
│   └── docs.lunaos.ai      # Production domain
│
├── lunaos-marketing/        # Landing Page — HTML/CSS/JS
│   ├── index.html          # Hero, features, pricing, CTA
│   ├── css/                # Design system
│   ├── js/                 # Analytics, animations
│   └── lunaos.ai           # Production domain (root)
│
├── lunaos-mobile/           # Mobile App — React Native / Expo
│   ├── src/
│   │   ├── screens/        # Home, flows, logs, settings
│   │   ├── components/     # Card, Button, Input, etc.
│   │   ├── services/       # API client, local cache
│   │   └── navigation/     # React Navigation routing
│   ├── app.json            # Expo config
│   └── eas.json            # EAS Build config
│
├── lunaos-infra/            # Infrastructure — Docker, Terraform, CI/CD
│   ├── docker/
│   │   ├── Dockerfile      # Multi-stage build for all services
│   │   └── docker-compose.yml # Local dev environment
│   ├── terraform/          # Cloudflare, Domain DNS
│   ├── github/workflows/   # CI/CD pipelines
│   └── scripts/            # Deployment, monitoring
│
├── openclaw-skills/         # Skill Library — TypeScript + D1
│   ├── src/
│   │   ├── skills/         # 50+ skills (HTTP, email, webhook, etc.)
│   │   ├── middleware/     # Auth, CORS
│   │   └── db/             # D1 storage for skill state
│   └── api.lunaos.ai/openclaw # Endpoint namespace
│
└── OpenHands/              # Open-Source Agent Framework
    ├── frontend/           # React IDE for agent interaction
    ├── backend/            # Python FastAPI + aiohttp
    └── docker/             # Container for agent execution
```

### Key Files Index
| File | Purpose | Lines |
|------|---------|-------|
| `luna-agents/src/cli.ts` | Main CLI entry point, command registration | ~150 |
| `lunaos-engine/src/index.ts` | Hono app setup, route mounting | ~100 |
| `lunaos-engine/src/routes/workflows.ts` | Workflow CRUD, versioning, export | ~180 |
| `lunaos-engine/src/routes/runs.ts` | Execution API, log streaming, results | ~160 |
| `lunaos-engine/packages/api/test/load.benchmark.spec.ts` | Load testing suite (1K concurrent, 10K daily) | ~400 |
| `lunaos-engine/packages/api/src/middleware/tenant-rate-limiter.ts` | Tenant-aware rate limiting (Free/Pro/Enterprise) | ~180 |
| `lunaos-engine/packages/api/src/services/audit-webhook-sender.ts` | Audit webhooks with HMAC signatures + retry | ~140 |
| `lunaos-engine/prisma/schema.prisma` | All 30+ D1 table schemas | ~350 |
| `lunaos-studio/src/pages/Editor.tsx` | Main visual editor with canvas | ~200 |
| `lunaos-studio/src/components/Canvas.tsx` | ReactFlow integration | ~180 |
| `lunaos-dashboard/src/app/teams/page.tsx` | Team management UI | ~140 |
| `lunaos-mobile/src/screens/HomeScreen.tsx` | Mobile dashboard | ~150 |

### Data Model (30+ Tables in Prisma/D1)
```
Core:
- organizations (id, name, owner_id)
- teams (id, org_id, name)
- team_members (user_id, team_id, role)

Workflows:
- workflows (id, org_id, name, definition_json, status)
- workflow_versions (id, workflow_id, version, definition_json)
- workflow_schedules (id, workflow_id, cron_expression, enabled)

Execution:
- runs (id, workflow_id, triggered_by, started_at, completed_at, status)
- run_steps (id, run_id, node_id, status, output_json, duration_ms)
- run_logs (id, run_id, level, message, timestamp)

Integrations:
- api_keys (id, org_id, name, key_hash, scopes, created_at)
- webhooks (id, org_id, url, events[], secret_hash)
- integrations (id, org_id, type, config_json)

Billing:
- subscriptions (id, org_id, plan, status, renewal_date)
- usage (id, org_id, metric, value, period)

Skills:
- skills (id, name, description, version, config_schema)
- skill_runs (id, skill_id, run_id, status, output)
```

## Development Guidelines

### Code Design Standards
- **Max 200 lines per file** — CI enforces via `find . -name '*.ts' -o -name '*.tsx' | xargs wc -l`
- **Single Responsibility** — one component per file, one handler per route
- **Type Safety** — TypeScript strict mode, Zod for API validation
- **Error Handling** — structured error responses with correlation IDs
- **Naming** — descriptive (e.g., `executeWorkflowStep` not `runStep`)
- **No Magic Values** — constants in `src/constants/` or config files
- **Dependency Injection** — constructor patterns for testability
- **Pure Functions** — side effects at route/component boundaries

### Architecture Patterns
**Request Flow (Engine API)**:
```
API Key auth (header) → validate API key in D1
↓
RBAC check: can org create workflows?
↓
Route handler → service layer → Prisma queries
↓
Response: { data: {...} } or { error: string, correlationId }
```

**Workflow Execution**:
```
Trigger (webhook, cron, manual) → create Run record
↓
For each node in workflow definition:
  - Resolve node type (HTTP, email, condition, etc.)
  - Execute skill handler
  - Record step output
  - Check error handling (retry, fallback)
↓
Emit run.completed event (webhooks, notifications)
```

**Skill Architecture**:
```
Skill manifest: name, params_schema, async handler
↓
Skill execution: validate params → invoke handler → return output
↓
Skill marketplace: publish → version → install into workflow
```

### Code Review Checklist
- [ ] No file exceeds 200 lines (split if needed)
- [ ] All functions typed with JSDoc (`@param`, `@returns`, `@throws`)
- [ ] No `any` types; use `unknown` with type guards
- [ ] API endpoints validate with Zod
- [ ] Error handlers include correlation ID
- [ ] No hardcoded secrets
- [ ] Follows existing naming conventions
- [ ] Tests written (unit + integration)
- [ ] Accessible components (ARIA labels, keyboard nav)

## Testing Strategy

### Unit Tests — 80%+ Coverage
- **Framework**: Jest (for Node.js/CLI), Vitest (for React)
- **Naming**: `describe('WorkflowExecutor', () => { it('should handle node failure with retry') })`
- **Mocking**: Mock Cloudflare D1, external APIs, timers
- **Run**: `npm run test` at repo root (monorepo)

### Integration Tests
- Test API endpoints with real D1 test database
- Test workflow execution end-to-end (engine)
- Test CLI commands with stubbed API
- Test React components with `@testing-library/react`

### E2E/Browser Tests — Critical Flows
- **Tool**: Playwright + Claude Chrome MCP
- **Test these flows**:
  1. Sign up → Create org → Create first workflow → Deploy
  2. Visual editor: drag HTTP node → add params → test endpoint
  3. Create schedule (cron) → trigger manually → view logs → export run
  4. Install skill from marketplace → use in workflow → monitor execution
  5. Team: invite member → accept → access workflow with read-only role
  6. Subscription: free trial → upgrade to Pro → verify feature unlock
  7. Webhook trigger: send POST → workflow executes → result posted back
  8. Mobile: view workflow list → trigger manually → view run logs
- **Personas**:
  - Solo dev (free tier, 1 workflow, basic skills)
  - Pro team (paid, 10 workflows, marketplace skills, team management)
  - Enterprise (custom SLA, SSO, audit logs)
- **Run**: `npx playwright test` from root
- **Coverage**: All main flows, all personas, error scenarios

### Test File Naming
- Unit: `src/services/workflow-executor.test.ts`, `src/components/Canvas.test.tsx`
- Integration: `src/routes/workflows.integration.test.ts`
- E2E: `e2e/workflow-creation.e2e.test.ts`, `e2e/skill-install.e2e.test.ts`

## Commands
```bash
# Monorepo root
npm install                     # Install all workspaces
npm run dev                     # Start all services in dev mode

# Individual services
cd luna-agents && npm run dev   # CLI in watch mode
cd lunaos-engine && npm run dev # API at localhost:8787 (Wrangler)
cd lunaos-dashboard && npm run dev # Dashboard at localhost:3000
cd lunaos-studio && npm run dev # IDE at localhost:5173
cd lunaos-docs && npm run dev   # Docs at localhost:5173
cd lunaos-mobile && npm run start # Expo

# Testing
npm run test                    # All unit tests
npm run test:integration        # Integration tests
npx playwright test             # E2E tests
npm run lint                    # ESLint all packages
npm run typecheck               # TypeScript check

# Database
npm run db:generate             # Create Prisma migration
npm run db:push                 # Push schema to D1 (local)

# Build & Deploy
npm run build                   # Build all packages
npm run deploy:engine           # Deploy API to Cloudflare
npm run deploy:dashboard        # Deploy dashboard to Pages
npm run deploy:studio           # Deploy studio to Pages
npm run deploy:docs             # Deploy docs to Pages
npm run deploy:marketing        # Deploy landing page
npm run deploy:all              # Deploy everything

# Local Infrastructure
docker-compose up -d            # Start Docker services (optional)
npm run start:local             # Start all services locally
```

## What's Done vs What's Left

**Done** (Sprints 1-3):
- Core engine with workflow execution
- Visual IDE (ReactFlow-based)
- Dashboard for team management
- 50+ skills (HTTP, email, webhook, database, etc.)
- Billing integration (LemonSqueezy)
- API key authentication
- Mobile app (Expo)
- CLI with MCP support
- Documentation site
- Marketing landing page

**Recently Completed** (Sprint 4):
- ✅ Load testing suite (`tests/load.benchmark.spec.ts`) — 1K+ concurrent workflows, 10K daily runs simulation
- ✅ Tenant-aware rate limiter (`src/middleware/tenant-rate-limiter.ts`) — Free/Pro/Enterprise tiers with KV + memory fallback
- ✅ Enhanced audit logger with webhooks (`src/services/audit-webhook-sender.ts`) — HMAC-SHA256 signatures, retry logic
- ✅ Comprehensive test coverage (audit + rate limiting tests, 95%+ coverage)
- ✅ Database migrations for audit webhooks (`migrations/020_audit_webhooks.sql`)

**Left** — **Final 3% Remaining**:
1. **Production Hardening** (In Progress)
   - Database query optimization (indexes, materialized views)
   - Security audit (OWASP Top 10 scan)
   - Performance profiling (flame graphs, memory leaks)
   - Chaos engineering tests (network failures, timeouts)

2. **Enterprise Features** (Backlog)
   - SAML/OIDC SSO integration
   - Custom roles + granular permissions
   - Data residency options (EU/US isolation)
   - SLA monitoring dashboard
   - Audit log retention policies

3. **AI Enhancements** (Nice-to-have)
   - Auto-generate workflows from natural language prompts
   - Anomaly detection in run results (statistical models)
   - Smart skill recommendations based on workflow context
   - Predictive performance alerts

4. **Marketplace Launch** (Post-launch)
   - Skill discovery + filtering UI
   - Revenue sharing (70/30 split for creators)
   - Community skill verification
   - Version management + dependency resolution

## Key Infrastructure

| Resource | Technology | Purpose |
|---|---|---|
| Database | Cloudflare D1 (SQLite) | Prisma ORM, 30+ tables |
| Compute | Cloudflare Workers | API gateway, skill execution |
| Storage | Cloudflare R2 | Workflow exports, run artifacts |
| Cache | Cloudflare KV | API keys, session tokens, rate limits |
| Webhooks | Cloudflare Queues | Event-driven execution |
| Durable Execution | Cloudflare Workflows | Long-running tasks, retries |
| Pages | Cloudflare Pages | Dashboard, Studio, Docs deployment |
| Mobile | Expo | iOS/Android native apps |
| CLI | Node.js + Commander | Agent orchestration |
| Auth | API keys (SHA-256 hashed) | Service-to-service auth |
| Billing | LemonSqueezy | Subscriptions, revenue sharing |

## Cross-Project Integration: PipeWarden

LunaOS integrates **PipeWarden** (DevSecOps orchestrator) for automated pipeline security scanning within visual workflows.

### Pipeline Security Scan Skill

New skill at `antigravity-awesome-skills/skills/pipeline-security-scan/`:
- **Type**: HTTP-based skill that calls PipeWarden API
- **Parameters**: Repository URL, CI/CD platform (GitHub/GitLab/Bitbucket), scan engine
- **Output**: Structured findings with severity, risk score, remediation tips
- **Marketplace**: Installable in any LunaOS workflow

### Scheduled Pipeline Scan Workflow

New workflow at `openclaw-skills/scheduled-pipeline-scan/`:
- **Trigger**: Cron schedule (daily, weekly, or custom)
- **Steps**:
  1. Call PipeWarden scan API for all connected repositories
  2. Triage findings via AI analysis (severity + risk scoring)
  3. Filter to critical/high-severity findings
  4. Send mobile push notifications (critical findings only)
  5. Record audit event in LunaOS dashboard
- **Notifications**: Mobile push, Slack, email, webhook options

### Mobile Push Notifications

- **Support**: Firebase Cloud Messaging (FCM) for Android, APNs for iOS
- **Triggers**: Critical pipeline security findings
- **Payload**: Finding summary + link to details dashboard
- **Storage**: Notification history in `runs` table

### Visual Workflow Architecture

```
[PipeWarden Scan] → [AI Triage] → [Filter by Severity]
                        ↓
                   [Condition Node]
                        ↓
                   Critical? ──Yes→ [Send Push Notification]
                   High?      ──Yes→ [Send Slack Alert]
                   Medium?    ──No→  [Log Audit Event]
                        ↓
                   [Update Dashboard]
```

## Competitors & Market Context
**Competitors**: n8n, Make, Zapier, Retool
**Differentiator**: Visual + CLI + Mobile + Open Source (Luna Agents) + PipeWarden DevSecOps Integration
