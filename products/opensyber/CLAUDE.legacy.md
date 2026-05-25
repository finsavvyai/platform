# OpenSyber — CLAUDE.md

> **Portfolio Tracker**: Product Hunt Launch Q2 2026 | **Readiness**: 82% | **Category**: SHIP

## Mission
Deploy a secured AI agent in 60 seconds with real-time security monitoring, audited skill marketplace, and compliance—managed AI agent hosting platform for security-conscious developers.

## Code Map & Index

### Directory Structure
```
opensyber/                        # ~31K TS/TSX files | 782 test files | 39 migrations
├── apps/                         # 8 applications
│   ├── claw-gateway/             # CF Worker (Hono) — AI gateway for all portfolio projects
│   │   ├── src/
│   │   │   ├── routes/           # /v1/prompt, /v1/sessions (4 route files)
│   │   │   ├── services/         # LLM proxy (Anthropic/OpenAI/Workers AI)
│   │   │   ├── middleware/       # Project API key auth (SHA-256 + timing-safe)
│   │   │   └── session-do.ts     # Durable Object with SQLite session state
│   │   ├── scripts/              # Project registration helpers
│   │   └── wrangler.toml
│   ├── api/                      # CF Worker (Hono) — 263 route files, 388 source files
│   │   ├── src/
│   │   │   ├── routes/           # 263 endpoints (agents, admin, AI, CSPM, alerts, marketplace…)
│   │   │   ├── services/         # 158 service files (attack-paths, alerts, discovery, remediation…)
│   │   │   ├── lib/              # Core utilities (crypto, tokenization, gating)
│   │   │   ├── middleware/       # Auth, RBAC, rate limiting
│   │   │   ├── cron/             # Scheduled tasks
│   │   │   └── test/             # Unit + integration tests
│   │   └── wrangler.toml
│   ├── web/                      # Next.js 16 — 452 source files
│   │   ├── src/
│   │   │   ├── app/              # 43 page directories (dashboard, admin, marketplace…)
│   │   │   ├── components/       # 165 React components across 20 directories
│   │   │   ├── hooks/            # Custom React hooks
│   │   │   ├── i18n/             # Internationalization (5 locales)
│   │   │   ├── lib/              # Services + utilities (13 directories)
│   │   │   └── __tests__/        # Component tests
│   │   └── next.config.ts
│   ├── agent/                    # Node.js daemon — 14 source files
│   │   ├── src/
│   │   │   ├── index.ts          # Main entry
│   │   │   ├── monitors/         # 12 monitoring modules
│   │   │   ├── security/         # Security implementations
│   │   │   ├── services/         # Service layer
│   │   │   └── skills/           # Skill execution runtime
│   │   └── package.json
│   ├── tokenforge-api/           # CF Worker (Hono) — 40 source files
│   │   └── src/
│   │       ├── routes/           # 34 route directories
│   │       ├── lib/
│   │       ├── middleware/
│   │       └── services/
│   ├── tokenforge-web/           # Next.js — 73 source files
│   │   └── src/
│   │       ├── app/              # 15 page directories
│   │       ├── components/       # 5 component directories
│   │       └── lib/              # 7 service directories
│   ├── tokenforge-proxy/         # CF Worker — 2 source files
│   └── redirects/                # CF Worker — redirect handler
├── skills/                       # 9 marketplace skills (6 AI + 3 bundled examples)
│   ├── ai-reasoning-engine/      # Core AI analysis — root cause, risk scoring
│   ├── ai-triage/                # Batch finding prioritization by actual risk
│   ├── ai-remediation/           # Fix generation with rollback procedures
│   ├── ai-compliance-writer/     # SOC 2/ISO 27001/HIPAA/GDPR evidence generation
│   ├── ai-threat-intel/          # CVE + OSINT enrichment via NVD/CIRCL APIs
│   ├── ai-incident-responder/    # Multi-step attack chain investigation
│   ├── shared/                   # Shared LLM client (multi-provider)
│   └── ai-security-analyst-bundle.json  # Premium bundle ($99/mo)
├── packages/                     # 10 packages
│   ├── claw-sdk/                 # AI gateway client SDK — 7 source files
│   │   └── src/
│   │       ├── client.ts         # ClawClient: prompt, ask, stream, sessions
│   │       ├── session.ts        # ClawSession: multi-turn conversations
│   │       ├── stream.ts         # SSE parser + text collector
│   │       ├── providers.ts      # Model aliases (opus/sonnet/gpt-4o/llama)
│   │       ├── http.ts           # Shared HTTP helpers
│   │       └── types.ts          # All interfaces
│   ├── db/                       # Drizzle ORM + D1 — 39 migrations
│   │   ├── src/
│   │   │   ├── schema/           # 38 schema files → ~103 tables
│   │   │   ├── queries/          # Service layer queries
│   │   │   └── index.ts          # Schema barrel export
│   │   ├── migrations/           # 39 versioned SQL migrations (0001–0025)
│   │   └── drizzle.config.ts
│   ├── shared/                   # Types, constants, plan configs — 53 files
│   │   ├── src/
│   │   │   ├── types/            # 16 type directories
│   │   │   ├── constants/        # 24 constant directories
│   │   │   ├── data/             # 7 data directories
│   │   │   └── utils/            # 5 utility modules
│   │   └── package.json
│   ├── tokenforge/               # TokenForge SDK — 44 files
│   │   ├── client/               # Browser SDK (Web Crypto API)
│   │   ├── server/               # Framework-agnostic middleware
│   │   ├── adapters/             # Hono, Express, Next.js adapters
│   │   ├── react/                # React bindings
│   │   └── shared/               # Shared types
│   ├── tokenforge-sdks/          # Multi-language SDKs
│   │   ├── go/                   # Go SDK
│   │   ├── kotlin/               # Kotlin SDK
│   │   ├── python/               # Python SDK
│   │   ├── swift/                # Swift SDK
│   │   ├── react-native/         # React Native SDK
│   │   └── mcp/                  # MCP integration
│   ├── auth/                     # Auth.js handlers (callbacks, token, providers)
│   ├── cli/                      # CLI tooling
│   ├── skill-sdk/                # Skill definition SDK + testing framework
│   ├── ui/                       # Shared React components (Button, Card, Badge, MetricCard…)
│   └── vscode-extension/         # VS Code extension — 20 files
├── docs/
│   ├── README.md                 # Project overview + quick start (updated April 2026)
│   ├── API.md                    # API reference — Auth.js + gateway token flows
│   ├── ARCHITECTURE.md           # System architecture — D1/KV/R2/Hetzner
│   ├── AI-GUIDANCE.md            # Claw SDK, gateway, AI skill development guide
│   └── sprints/                  # 24 sprint docs (historical headers added)
└── .luna/                        # Extended sprints (sprint-24 through sprint-34)
```

### Codebase Stats (audited April 2026)
| Metric | Count |
|--------|-------|
| Total TS/TSX files | ~31,300 |
| Source files (non-test) | ~970 across apps |
| Test files | 782 |
| API route files | 263 |
| API service files | 158 |
| Web components | 165 |
| Web page directories | 43 |
| DB schema files | 38 (~103 tables) |
| DB migrations | 39 |
| Sprint docs | 34 (sprint-1 through sprint-34) |
| Packages | 10 |
| Apps | 8 |
| AI skills | 6 (premium bundle) |
| Claw SDK source files | 7 |
| Claw Gateway source files | 8 |

### Key Files Index
| File | Purpose |
|------|---------|
| `apps/claw-gateway/src/index.ts` | Claw AI gateway — shared LLM service for all portfolio projects |
| `apps/claw-gateway/src/session-do.ts` | Durable Object with SQLite for AI conversation sessions |
| `apps/claw-gateway/src/services/llm-proxy.ts` | Multi-provider LLM routing (Anthropic/OpenAI/Workers AI) |
| `packages/claw-sdk/src/client.ts` | ClawClient — prompt, stream, sessions for any project |
| `skills/shared/llm.js` | Shared LLM client for AI skills (multi-provider) |
| `skills/ai-security-analyst-bundle.json` | Premium AI bundle definition ($99/mo, 6 skills) |
| `apps/api/src/middleware/auth.ts` | Auth.js HMAC-SHA256 JWT validation + Hono auth middleware |
| `apps/api/src/routes/agents.ts` | POST/GET agent CRUD, skill installation |
| `apps/api/src/routes/gateway.ts` | X-Gateway-Token verification, step execution |
| `apps/api/src/routes/health.ts` | Health endpoint, metrics aggregation |
| `apps/api/src/services/attack-paths/` | Graph-based attack surface analysis |
| `apps/api/src/services/alerts/` | Alert prioritization, remediation events |
| `packages/db/src/schema/` | 38 schema files, ~103 Drizzle ORM table definitions |
| `packages/tokenforge/client/` | Device-bound session SDK (Web Crypto) |
| `apps/web/src/components/` | 165 React components across 20 directories |
| `apps/web/src/app/dashboard/` | Main dashboard with metrics + shortcuts |

## Development Guidelines

### Code Design Standards
- **Max 200 lines per file** — enforced in CI via `find . -name '*.ts' -o -name '*.tsx' | xargs wc -l`
- **Single Responsibility** — one component per file, one route handler per endpoint
- **Type Safety** — strict TypeScript, no `any`, use `unknown` + type guards
- **Error Handling** — never swallow errors, use typed Result patterns (`{ success, data, error }`)
- **Naming** — descriptive, no abbreviations (e.g., `calculateMonthlyRevenue` not `calcMR`)
- **No Magic Values** — all literals in `packages/shared/src/constants/`
- **Dependency Injection** — constructor patterns for testability (especially for Auth.js, Hetzner, D1 access)
- **Pure Functions First** — side effects only at route/component boundaries

### Architecture Patterns
**Monorepo Layering** (Turborepo + pnpm):
1. **Layer 1 (Packages)** — `db`, `shared`, `ui`, `auth`, `skill-sdk`, `tokenforge`, `tokenforge-sdks`, `cli`, `vscode-extension` — no dependencies on apps
2. **Layer 2 (Apps)** — `api`, `tokenforge-api`, `tokenforge-proxy`, `redirects` — can depend on packages
3. **Layer 3 (Web/Agent)** — `web`, `tokenforge-web`, `agent` — can depend on all

**Request Flow (OpenSyber)**:
```
Auth.js JWT → authMiddleware → c.get('userId') → RBAC check → DB operation
↓
Response format: { data: {...} } or { error: string, message: string }
```

**Gateway Token Flow (Agent ↔ API)**:
```
Agent: X-Gateway-Token + X-Instance-Id headers
↓
API: KV lookup (gateway:{instanceId}:token)
↓
TokenForge: ECDSA P-256 device binding (optional for extra security)
```

### Code Review Checklist
- [ ] No file exceeds 200 lines (split if needed)
- [ ] All public functions have JSDoc with `@param`, `@returns`, `@throws`
- [ ] No `any` types; use `unknown` where needed with type guards
- [ ] Error cases explicitly handled (no try/catch without re-throw)
- [ ] No hardcoded secrets, URLs, or credentials
- [ ] Follows existing naming (camelCase for functions, PascalCase for components/classes)
- [ ] Tests written (unit + integration as needed)
- [ ] Zod schemas for all API request bodies
- [ ] Permissions checked on every write operation (`requirePermission()`)

## Testing Strategy

### Unit Tests — Full Coverage Required
- **Framework**: Vitest (configured in `package.json` workspaces)
- **Coverage Target**: 95% lines, 90% branches
- **Naming**: `describe('AgentService', () => { it('should validate agent config when missing skills') })`
- **Structure**: Arrange → Act → Assert
- **Mocking**: Mock Auth.js, Hetzner, LemonSqueezy, Resend (never mock the thing under test)
- **Run**: `pnpm test` (runs all packages), `pnpm --filter @opensyber/api test`

### Integration Tests
- Test API endpoints end-to-end via `hono/testing` (no real Auth.js/Hetzner)
- Test database operations with miniflare + D1 test database
- Test auth webhook payloads (user.created, org.updated)
- Test external service integrations with stub responses (LemonSqueezy, Resend, Fly.io)

### E2E Tests — Critical User Flows
- **Tool**: Playwright + Claude Chrome MCP
- **Coverage**: All personas, all key workflows
- **Flows to test**:
  1. Signup (Auth.js OAuth) → Create org → Create first agent → View dashboard
  2. Install public skill → Configure params → Deploy agent → Execute skill
  3. View logs → Create alert rule → Verify notification delivered
  4. Add team member (invite) → Accept invite → Verify RBAC enforcement
  5. Upgrade to Pro → Verify billing webhook → Check plan enforcement
  6. Agent heartbeat failure → Auto-remediate with Hetzner API
  7. TokenForge: Device binding setup → Session verification → Manual step-up auth
- **Personas**:
  - Free-tier solo dev (1 agent, 10 runs/day, no skills)
  - Pro team lead (5 agents, 1K runs/month, skill marketplace access)
  - Enterprise admin (SSO, SAML, audit logs, custom SLA)
  - Skill marketplace creator (publish skill → earn revenue)
- **Run**: `npx playwright test` from `apps/web`
- **Visual Regression**: Screenshot comparison on dashboard, settings pages

### Test File Naming
- Unit: `src/lib/tokenizer.test.ts`, `src/services/agent-monitor.test.ts`
- Integration: `src/routes/agents.integration.test.ts`
- E2E: `e2e/agent-install-skill.e2e.test.ts`, `e2e/billing-upgrade.e2e.test.ts`
- Browser: `browser/device-binding.browser.test.ts`

## Commands
```bash
# Dev (all projects)
pnpm install                    # Install all deps
pnpm dev                        # Start API + Web + agent in watch mode

# OpenSyber API
cd apps/api && pnpm dev         # Local API with wrangler
cd apps/api && pnpm deploy      # Deploy to Cloudflare production

# OpenSyber Web
cd apps/web && pnpm dev         # Local dev server (http://localhost:3000)
cd apps/web && pnpm build       # Build for Cloudflare
cd apps/web && pnpm deploy      # Deploy to Cloudflare Pages

# Claw Gateway (AI service for all portfolio projects)
cd apps/claw-gateway && pnpm dev    # Local gateway with wrangler
cd apps/claw-gateway && pnpm deploy # Deploy to Cloudflare production
cd apps/claw-gateway && ./scripts/register-project.sh opensyber "OpenSyber"

# Claw SDK
cd packages/claw-sdk && pnpm build  # Build SDK
cd packages/claw-sdk && pnpm test   # Test SDK

# TokenForge API
cd apps/tokenforge-api && pnpm dev
cd apps/tokenforge-api && pnpm deploy

# TokenForge Web
cd apps/tokenforge-web && pnpm dev
cd apps/tokenforge-web && pnpm deploy

# Database
cd packages/db && pnpm db:generate   # Create new migration
cd packages/db && pnpm db:migrate    # Apply migrations to D1
cd packages/db && pnpm db:push       # Sync schema with D1

# TokenForge SDK
cd packages/tokenforge && pnpm build  # Build SDK
cd packages/tokenforge && pnpm test   # Test SDK (90%+ required)

# Tests
pnpm test                       # Run all tests
pnpm test --watch               # Watch mode
pnpm lint                       # ESLint all packages
pnpm typecheck                  # TypeScript check
```

## What's Done vs What's Left

**Done** (Sprints 1-23):
- Sprint 1: Agent Runtime (Hetzner container orchestration)
- Sprint 2: Skill Installation & Real-time Monitoring
- Sprint 3: Dashboard CRUD & UI Completion
- Sprint 4: Security Hardening & Credential Vault
- Sprint 5: Production Launch & E2E Testing
- Sprint 6: TokenForge Standalone (SDK + adapters + storage backends)
- Sprint 7: TokenForge Product (landing, dashboard, billing integration)
- Sprint 8: Enterprise RBAC & Teams
- Sprint 9: Enterprise SSO & Admin Panel
- Sprint 10: Enterprise Hardening & Scale
- Sprint 11: CSPM + Prowler Integration
- Sprint 11b: Skill SDK
- Sprint 12: Credential Lifecycle Management
- Sprint 13: Risk Intelligence
- Sprint 14: Attack Graph Analysis
- Sprint 15: SaaS Posture Management
- Sprint 16: AI Intelligence Layer
- Sprint 17: Remediation Engine
- Sprint 18: Multicloud Support
- Sprint 19: Marketplace v2
- Sprint 20: Enterprise Exit Prep
- Sprint 21: Platform Connect
- Sprint 22: Platform Data
- Sprint 23: OpenAgent PLG

**In Progress / Left** (Sprints 24-34 in .luna/):
1. **Agent Security Platform** (Sprints 24-26)
   - Agent security platform hardening
   - Agent attack path analysis
   - AI agent compliance framework

2. **Marketplace & Enterprise** (Sprints 27-28)
   - Marketplace ecosystem expansion
   - Enterprise exit prep

3. **Full CNSP Coverage** (Sprints 29-33)
   - Full CSPM implementation
   - SaaS posture management v2
   - Credential lifecycle v2
   - AI intelligence v2
   - Remediation engine v2

4. **Series A Exit** (Sprint 34)
   - Series A readiness and exit preparation

## Key Infrastructure

| Resource | Technology | Purpose |
|---|---|---|
| Database | Cloudflare D1 (SQLite) | ~103 tables across 38 schema files (Drizzle ORM) |
| Auth | Auth.js | JWT (HMAC-SHA256), 4 OAuth providers (Google, GitHub, LinkedIn, Microsoft) |
| Payments | LemonSqueezy | Subscriptions (Free, Pro, Team, Enterprise) |
| Email | Resend API | Alerts, invitations, security notifications |
| Storage | Cloudflare R2 | Skill packages (.tar.gz), logs, backups |
| Cache | Cloudflare KV | Gateway tokens, health metrics, rate limit counters |
| Compute | Hetzner Cloud API | Per-user VMs (1 CPU, 1GB RAM, 20GB SSD) |
| Container | Docker (node:22-slim) | Agent runtime with security tools (osquery, seccomp) |
| Session Security | TokenForge | Device-bound ECDSA P-256 sessions (non-extractable keys) |
| AI Gateway | Cloudflare Worker + Durable Objects | Shared LLM proxy for 43 portfolio projects (claw-gateway) |
| AI Skills | 6 AI skills (premium bundle) | LLM-powered finding analysis, triage, remediation, compliance |
| AI SDK | @opensyber/claw-sdk | TypeScript client for AI gateway (prompt, stream, sessions) |
| Monitoring | Cloudflare Analytics + Sentry | Error tracking, performance analytics |
| Notifications | Slack, PagerDuty, Discord, Teams, OpsGenie | Alert delivery |

## Cross-Project Integration: PipeWarden

OpenSyber integrates pipeline security findings from **PipeWarden** (DevSecOps orchestrator) via webhook receivers and skill integrations.

### Pipeline Security Scanner Skill

New skill at `skills/pipeline-security-scanner/`:
- **Manifest**: SKILL.md with parameters (repo URL, platform, engine)
- **Handler**: Executes PipeWarden scans and returns structured findings
- **README**: Integration guide for pipeline security scanning
- **Installation**: Installable from skill marketplace

### Webhook Receiver & Audit Endpoints

#### Finding Ingestion Webhook
- **Route**: `apps/api/src/routes/integrations/pipewarden.ts`
- **Verification**: HMAC-SHA256 signature validation
- **Payload**: Security findings from PipeWarden scans
- **Processing**: Stores findings in D1, triggers AI triage skill

#### Scan Event Audit Endpoint
- **Route**: `apps/api/src/routes/integrations/audit.ts`
- **Events**: scan_completed, finding_created, severity_changed
- **Retention**: Audit log in D1 for compliance

### PipeWarden Types Package

- **Location**: `packages/types/src/pipewarden.ts`
- **Exports**: Finding, ScanResult, SeverityLevel, RiskScore types
- **Usage**: Shared types across OpenSyber API, skills, and dashboard

### AI Triage Integration

- Findings from PipeWarden feeds into `ai-triage` skill
- Risk scoring + prioritization by actual severity
- Remediation suggestions via `ai-remediation` skill
- Audit trail for all triaged findings

## Competitors & Market Context
**Competitors**:
- Hugging Face Spaces (compute but no security)
- Replit (IDE, not security focused)
- Lambda Labs (GPU compute only)
- Modal (serverless, good UX, weak security)

**Differentiators**:
- Security-first (TokenForge device binding)
- Skill marketplace (70/30 revenue split)
- Compliance (SAML, audit logs, data residency)
- Developer UX (60-second setup)
- PipeWarden integration for unified pipeline security
