# TenantIQ — CLAUDE.md

> **Portfolio Tracker**: Enterprise SAAS Launch Q2 2026 | **Readiness**: 87% | **Category**: SHIP
> Last reviewed: 2026-05-04 (post-competitive push — verified against source + prod)

## Mission
**MSP control plane for managing OTHER PEOPLE'S Microsoft 365 tenants** — the part horizontal AI assistants (Claude-in-M365, Copilot) can't do at MSP scale. CIS benchmark automation with per-tenant overrides, drift attribution to actor, license-tier gating on remediation, cross-tenant rollups (backup health, benchmark, alerts), and ISO 27001 / SOC 2 / HIPAA / GDPR posture mapping. Built for managing 9–250+ Azure AD tenants concurrently, not productivity inside one.

## Competitive position vs Optimize365 (2026-05-04 push)

Public `/compare` page maps 38 features across 9 categories. **14 features unique to TenantIQ** that Optimize365 doesn't ship:
- Per-tenant CIS overrides with audit-grade justification (ScubaGear-style)
- Named drift baselines + drift attribution to actor + generic drift revert
- Mailbox rule auditor (6 BEC indicator types)
- Federated identity auditor (Entra workload identity)
- Cross-tenant trust analyzer
- SAML metadata auditor (cert expiry windows + SHA-1 + AuthnRequest signing)
- License-tier upsell on remediation block (402 with concrete cost)
- Public no-auth prospect scan
- Per-customer custom domain via DNS verification
- Dynamic time-to-complete from `remediation_log` history
- Account-deletion 33-table cascade with contract test
- AI-powered CIS control explainer (Claude, tenant-context-aware)
- ISO 27001:2022 Annex A engine (25 telemetry-evaluable + 68 organisational out-of-scope)
- CIS score trend chart with improving/regressing/stable verdict

## Production status (2026-05-04)

| Surface | Live | Version |
|---|---|---|
| API worker | api.tenantiq.app/* | `244d291e` |
| Web app | app.tenantiq.app | Pages `c67a91c4` |
| D1 prod | tenantiq-production | through migration `0019_custom_domain_verification.sql` |
| Public prospect scan | api.tenantiq.app/api/prospect/scan | live, KV-rate-limited 5/hr/IP |

## Sprint timeline (2026-05-02 → 05-04)

| Sprint | Focus | Test delta |
|---|---|---|
| 1 | DKIM multi-selector, R2 logo upload, named baselines, CIS L1/L2, mailbox-rule auditor | +11 |
| 2 | 10 CIS evaluators wired to real Graph + public prospect scan | +33 |
| 3 | License-tier upsell, dynamic time-to-complete, drift revert, SCIM filter expansion, cross-tenant + SAML auditors, custom-domain DNS verification | +75 |
| Round 5 | 4 more CIS evaluators (federated_identity, retention_*, external_tagging, admin_alert_policies) + ISO 27001 Annex A engine | +20 |
| Frontend wave | Custom-domain verification UI + logo upload UI + ISO 27001 in compliance scorecard | +0 (UI) |

**Total**: 1341 → 1480 tests, 3 deliberately skipped (stale callback contract). All passing.

## Reality Check (2026-05-04)

These numbers were grepped from the working tree. Past versions of this file were significantly under-counting.

| Metric | Real | Verify |
|---|---|---|
| API route TS files | **197** | `find apps/api/src/routes -name "*.ts" -not -name "*.test.ts" \| wc -l` |
| Web pages (`+page.svelte`) | **80** | `find apps/web/src/routes -name "+page.svelte" \| wc -l` |
| Sidebar nav links | **27** | `+layout.svelte` |
| Svelte components | **196** | `find apps/web/src/lib/components -name "*.svelte" \| wc -l` |
| D1 tables | **34** | `grep -c "sqliteTable(" packages/db/src/schema-d1.ts` |
| D1 migrations | **17** | `ls packages/db/migrations \| wc -l` |
| API unit test files | **151** (1341 cases) | `find apps/api/src -name "*.test.ts" \| wc -l` |
| Web unit test files | **18** | `find apps/web/src -name "*.test.ts" \| wc -l` |
| E2E spec files | **32** | `find tests/e2e -name "*.spec.ts" \| wc -l` |
| Cron jobs | 26 | `ls apps/api/src/cron \| wc -l` |
| Queue handlers | 8 | `ls apps/api/src/queues` |

**Honesty pass (2026-05-02)**: removed 9 `Math.random()` fabricated-metric fallbacks across `packages/ai/src/tools/{anomaly-detection,usage-heatmap,savings-leaderboard}`. Functions now return empty arrays / single-point series when historical data isn't supplied, instead of synthesizing fake trend lines. Random IDs (`anom_*`, `rpt_*`) retained — those are identifiers, not metrics.

## Code Map

### Directory Structure
```
tenantiq/
├── apps/
│   ├── api/              # Cloudflare Workers + Hono — 197 route TS files
│   │   ├── src/
│   │   │   ├── routes/   # Top-level + nested (tenants/*, platform/*, scim/*, etc.)
│   │   │   ├── lib/      # ~70 lib files: graph-client, cis/, copilot/, storage/,
│   │   │   │              # snapshots/, lifecycle/, security-stack/, ai-anthropic,
│   │   │   │              # account-deletion, auth-session, audit-logger, ssrf-guard,
│   │   │   │              # rate-limit, semantic-cache, webauthn, sentry, etc.
│   │   │   ├── middleware/ # auth, tenant-scoping, rate-limit, validation, skill-gate
│   │   │   ├── cron/     # 26 scheduled tasks (compliance-scan, drift-detection,
│   │   │   │              # nightly-backup, user-sync, sso-cert-monitor, etc.)
│   │   │   ├── queues/   # 8 consumers (scan-processor, remediation-executor,
│   │   │   │              # notifications, sync-handler, workflow-handler, etc.)
│   │   │   └── app/      # Route registration + error mapping
│   │   └── wrangler.toml # KV, D1, R2, queues (with DLQ), Durable Objects, Sentry
│   └── web/              # SvelteKit 2.15 + Svelte 5 — 80 pages, 196 components
│       ├── src/
│       │   ├── routes/   # / · /security/* · /workflows/* · /platform/admin/* ·
│       │   │              # /msp/* · /backups/* · /governance/* · /settings/* ·
│       │   │              # /skills · /pricing · /reports/* · /sdlc · /threats · …
│       │   ├── lib/
│       │   │   ├── components/ # ui/, cis/, email/, skills/, onboarding/,
│       │   │   │                # landing/, dashboard/, tenants/, ai/, …
│       │   │   ├── stores/ # auth, tenant, skills, toast, theme, …
│       │   │   ├── utils/ # format, export, sse, focus-trap, …
│       │   │   ├── api/   # client.ts (HTTP wrapper + auth)
│       │   │   └── design-system/ # Tokens, CSS variables (Apple HIG)
│       │   └── app.css   # Global CSS, animations
│       └── svelte.config.js
├── packages/
│   ├── db/               # Drizzle ORM — 34 D1 tables, 17 migrations
│   │   ├── src/
│   │   │   ├── schema-d1.ts  # 792 LOC, all 34 tables
│   │   │   ├── schema.ts     # Postgres dev mirror
│   │   │   └── queries/      # Service layer
│   │   └── drizzle.config.ts
│   ├── shared/           # Types, enums, configs (@tenantiq/shared)
│   ├── graph/            # Microsoft Graph wrapper (~700 LOC)
│   │   └── src/{client,users,groups,licenses,policies,security-alerts,reports}.ts
│   ├── ai/               # AI tools, prompts, semantic cache, smart router
│   │   └── src/tools/{anomaly-detection,usage-heatmap,savings-leaderboard,
│   │                    cost-optimizer,executive-report,license-autopilot,
│   │                    compliance-posture,health-score,onboarding-advisor}
│   └── intel/            # Alert prioritization & risk scoring
└── tests/
    ├── e2e/              # 32 Playwright specs
    └── integration/      # Real-tenant verification
```

### Key Files Index (verified LOC)
| File | Purpose | Lines |
|------|---------|-------|
| `apps/api/src/routes/cis-benchmark.ts` | CIS scan trigger, control results, history | 163 |
| `apps/api/src/lib/cis/` | CIS engine: 7 control-domain files + scanner + overrides | **1,667 total** |
| `apps/api/src/lib/account-deletion.ts` | GDPR Art. 17 cascade across 33 tables | ~160 |
| `apps/api/src/lib/ai-anthropic.ts` | Claude integration | ~140 |
| `apps/api/src/lib/graph-client.ts` | Microsoft Graph SDK wrapper | ~160 |
| `apps/api/src/routes/auth-session.ts` | JWT signing/verify, JTI deny-list, iss/aud | ~200 |
| `apps/api/src/routes/sso-callback.ts` | SAML/OIDC SSO callback | 189 |
| `apps/api/src/routes/scim/{users,groups}.ts` | SCIM 2.0 endpoints | 339 |
| `apps/api/src/routes/copilot-readiness.ts` | Copilot readiness assessment | 181 |
| `apps/api/src/routes/storage-analytics.ts` | OneDrive/SharePoint usage | 105 |
| `apps/api/src/routes/config-snapshots.ts` | Config capture | 131 |
| `apps/api/src/routes/config-drifts.ts` | Drift comparison | 94 |
| `packages/db/src/schema-d1.ts` | All 34 D1 table definitions | 792 |
| `apps/web/src/routes/+layout.svelte` | Main layout, sidebar (27 nav links) | 174 |
| `apps/web/src/routes/security/cis/+page.svelte` | CIS benchmark UI | 150 |

### Sidebar Map (27 links)
```
Quick Access:
├── Skills Hub           /skills
├── Dashboard            /
└── Health Check         /security

Management:
├── Alerts               /alerts
├── Licenses             /licenses
├── Audit & Compliance   /audit
└── Workflows            /workflows

Security:
├── CIS Benchmark        /security/cis
├── Threats              /threats
├── Behavior Analysis    /behavior
├── Email Security       /security/email
├── Compliance (Purview) /security/purview
├── Sign-in Logs         /security/signin-logs
├── AI Compliance (SDLC) /sdlc
└── Copilot Readiness    /security/copilot

Analytics:
├── AI Agent             /ai
├── Cloud Backups        /backups
├── Config Snapshots     /backups/config
└── Config History       /audit/history

Governance:
├── Workspaces           /governance
├── Storage Analytics    /governance/storage
├── User Lifecycle       /workflows/lifecycle
└── Copilot Usage        /security/copilot-usage

Enterprise:
├── MSP Benchmark        /msp
├── Team                 /team
└── Settings             /settings
```

Note: 80 pages total. Beyond sidebar: `/pricing`, `/terms`, `/privacy`, `/support`, `/changelog`, `/demo`, `/marketplace/*`, `/reports/*`, `/platform/admin/*` (10 admin sub-pages), `/settings/*` (8 sub-pages), `/workflows/*` (4 sub-pages), `/security/*` (12 sub-pages).

## Development Guidelines

### Code Design Standards
- **Max 200 lines per file** — enforced via `scripts/check-max-lines.sh`
- **Single Responsibility** — one component per `.svelte`, one endpoint family per route file
- **Type Safety** — TypeScript strict mode on API, Svelte 5 type inference
- **Error Handling** — Zod validation on API input, toast notifications on UI
- **Naming** — descriptive (e.g., `getTenantSecureScore` not `getScore`)
- **No Magic Values** — limits/thresholds in `packages/shared/src/config/`
- **Dependency Injection** — Graph client, AI client passed as params
- **Pure Functions** — side effects at route/component boundaries only
- **No fabricated metrics** — return empty state when source data is unavailable; never `Math.random()` a number that ships to a customer dashboard

### Architecture Patterns
**Auth flow**:
```
Microsoft OAuth → JWT signed (HS256/RS256) with JTI + iss=tenantiq.app + aud=tenantiq-api
↓
authMiddleware: jose.jwtVerify (dual-alg fallback) → JTI deny-list check (KV) → c.get('user')
↓
tenantScopingMiddleware: WHERE org_id = c.get('orgId') on every D1 query
```

**Data sync pipeline**:
```
Cron (26 jobs) / queue / manual → Graph API call → cache to D1 (incremental)
↓
Anomaly detection / CIS evaluator / drift detector
↓
Alerts written → notification queue → email (Resend) / Slack / Teams / web-push
```

**CIS compliance loop**:
```
Trigger scan → enumerate via Graph → evaluate 100+ controls (7 domain files)
↓
Apply per-tenant overrides → store control_status → calculate score
↓
Compare to baseline → generate remediation steps → optional auto-remediate
```

**Account deletion (GDPR Art. 17 / M365 Cert C7)**:
```
DELETE /api/account → cascade: 21 tenant_id + 6 org_id + 2 organization_id +
  3 FK-lookup + 1 root = 33 tables → KV purge by prefix → R2 object cleanup
↓
DeletionReport returned (rowsDeleted per table, KV count, R2 count, duration)
```

### Code Review Checklist
- [ ] No file exceeds 200 lines (run `scripts/check-max-lines.sh`)
- [ ] Svelte 5 features (`$state`, `$derived`, `$effect`)
- [ ] API endpoints validate input (Zod or hand-rolled)
- [ ] All DB queries scoped (`WHERE org_id = ...` or via `tenantScopingMiddleware`)
- [ ] Toast notifications for success/error
- [ ] Loading skeleton before data
- [ ] Keyboard navigation on interactive elements
- [ ] Dark mode support (CSS variables)
- [ ] Tests written (unit + integration as applicable)
- [ ] No `Math.random()` for any value that becomes a metric, score, or count

## Testing

### Unit — ≥90% line / ≥85% branch (per portfolio CLAUDE.md)
- **Framework**: Vitest 4.x. API runs `environment: 'node'` (`apps/api/vitest.config.ts`). Web uses Vitest + Svelte component tests.
- **Counts**: 151 API test files (1,341 cases), 18 web test files.
- **Mocking**: Graph API stubs, Anthropic stubs, D1 stubs. `@cloudflare/vitest-pool-workers` **not yet adopted** — see `.luna/tenantiq/leverage/workers-sdk/integration-plan.md` Phase 4.
- **Run**: `npm run test`

### Integration
- API endpoints with real D1 test database
- Graph integrations with stub responses
- Webhook payloads (LemonSqueezy, OpenClaw)
- Workflow execution lifecycle
- Run: `npm run test:integration`

### E2E (Playwright + Claude Chrome MCP)
- **Counts**: 32 spec files. Smoke suite (`cert-prep-smoke` 8 + `cert-prep-signed-in` 4) runs daily against prod via `cert-status.yml`.
- **Critical flows**:
  1. MSP login → Connect Azure tenant → Sync users/licenses → Dashboard populated
  2. Trigger CIS scan → View control results → Auto-remediate
  3. Email threat detected → View alert → Acknowledge
  4. Configure compliance workflow → Schedule → View history
  5. Copilot readiness → View scores → Export PDF
  6. Invite team member → Accept → RBAC enforced
  7. Skill install → Monitor execution
  8. Multi-tenant: Switch between 2 orgs → Verify data isolation
  9. Billing: 4 plans × 2 cycles checkout matrix (8/8 passing live)
  10. Account deletion → 33-table cascade verified
- **Personas**: MSP admin, tenant engineer, contractor, free-tier
- **Run**: `npx playwright test`

### Cert / Compliance Pipeline
- **Scripts** (`scripts/`): `cert-evidence-bundle.ts`, `check-cert-drift.ts`, `gen-architecture-diagram.ts`, `gen-cover-letter.ts`
- **Workflows** (`.github/workflows/`): `cert-status.yml` (daily smoke), `auto-bump-dates.yml`, `cert-renewal-prep.yml`

## Commands
```bash
# Dev
npm install
npm run dev                     # API + web in parallel

# API (Cloudflare Workers)
cd apps/api && npm run dev      # Local Wrangler dev
cd apps/api && npx wrangler deploy   # Deploy to prod (alias: pushci)

# Web (SvelteKit)
cd apps/web && npm run dev      # http://localhost:5173
cd apps/web && npm run build    # Build for Cloudflare Pages
npm run deploy:web              # Deploy

# Database
npm run db:generate             # Create D1 migration
npm run db:migrate:local        # Apply locally
npx wrangler d1 execute tenantiq-production --remote --command "SELECT ..."

# Tests
npm run test                    # All unit tests
npm run test:integration        # Integration
npx playwright test             # E2E
npm run lint                    # ESLint + Prettier
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

## Implementation Status

### Done (verified in source)
- **Auth surface** — Microsoft OAuth, JWT (HS256+RS256 fallback), JTI deny-list, iss/aud enforced, WebAuthn (passkeys), LinkedIn OAuth, JWKS endpoint, WS scoped tickets
- **SSO + SCIM** — `sso-callback.ts` (189) + JIT provisioning + handlers; SCIM 2.0 users + groups (~340 LOC) with full test coverage. (Earlier CLAUDE.md listed this as "Left" — outdated.)
- **CIS benchmark engine** — 1,667 LOC across 7 control-domain files (apps, audit, ci/cd, data, device, email, identity), scanner, evaluator, per-tenant overrides, federated-identity auditor, regression detector
- **Account deletion cascade** — 33 tables (verified by drift-resistant contract test)
- **Copilot Readiness** — assessment engine (99) + report (80) + types (72) + 3 routes (PDF, security, usage) + tests
- **Config Snapshot + Drift Detection** — snapshots (131), drifts (94), suppression rules, export, schedule, drift-detection cron
- **Storage Analytics** — `storage-analytics.ts` (105) + `lib/storage/` (compliance-checker, storage-analyzer, storage-scanner)
- **Platform Admin Panel** — 11 admin routes (alerts, announcements, audit, credentials, cron, metrics, notifications, overview, revenue, stats, sync) + 10 admin web pages
- **Microsoft Graph** — users, groups, licenses, mail, security-alerts, policies, reports
- **Anomaly detection** — login anomalies (impossible travel, brute force, off-hours), activity anomalies (license spikes, mass deletion, guest surge); historical trend now requires real input (no synthetic series)
- **Workflow engine** — definitions + runs tables, executor, compliance check, templates, approvals, group-cleanup, guest-review, lifecycle
- **User lifecycle** — 10 Graph step-handlers, executor, tracking, AI-suggested actions
- **Skill marketplace** — ~20 skills in catalog (`skills-data.ts`) with skill-gate middleware
- **Multi-tenant + RBAC** — org-scoped middleware on every endpoint, role enforcement (platform_admin, super_admin, tenant_admin, tenant_engineer, contractor)
- **Billing** — LemonSqueezy: 4 plans × 2 cycles, webhook HMAC verify, pre-flight 402 with tier-named error, platform-admin grant-tier (audited), Microsoft Commercial Marketplace integration
- **Cron** — 26 scheduled tasks (compliance-scan, security-scan, drift-detection, nightly-backup, user-sync, sso-cert-monitor, webhook-retry, account-purge, scheduled-snapshots, etc.)
- **Queues** — 3 producers + consumers + DLQ: `scan-results`, `remediation-jobs`, `notifications`
- **Reporting** — executive PDF, savings, audit history, report builder
- **Integrations** — ConnectWise, Datto, Kaseya, OpenClaw, generic webhook configs
- **Notifications** — push (web-push), SMS, email (Resend), Slack, Teams, Discord
- **Cert/compliance pipeline** — 4 scripts, 3 workflows, evidence bundle, daily smoke

### Soft spots
- `@cloudflare/vitest-pool-workers` not adopted (Workers-runtime tests run in Node)
- No external pen test yet
- No SOC 2 yet
- KV cross-region replication absent
- Status page single-vendor
- Web unit test coverage thin (18 files)
- ~15 stub markers (TODO/FIXME) remain in API src — track and close before launch

### Honesty Discipline
- **No-bluf scans** in `.luna/tenantiq/no-bluf-report.md` (every commit's claims verified against code)
- **Cascade contract test** ensures `deleteOrganization` hits exactly 33 tables — drift-resistant
- **Cert-drift check** fails CI when sub-processors / Graph permissions docs go out of sync with code
- **Empty-state policy** — no fabricated metrics; functions return `[]` or single-point series when historical data unavailable

## Key Infrastructure

| Resource | Technology | Purpose |
|---|---|---|
| Database | Cloudflare D1 (SQLite) | 34 tables: organizations, tenants, users_cache, licenses_cache, user_licenses, security_alerts, alerts, webhook_configs, webhook_deliveries, sso_connections, copilot_assessments, storage_analytics, config_snapshots, config_drifts, sync_jobs, platform_metrics, drift_suppression_rules, integrations, integration_mappings, partners, partner_integrations, audit_logs, backup_jobs, org_branding, tokenforge_{device_bindings,config,events}, remediation_log, tenant_audit_log, workflows, workflow_runs, ai_conversations, tf_opensyber_integrations, platform_users |
| Auth | jose (HS256 + RS256) + Microsoft OAuth + WebAuthn | JWT auth + JTI deny-list, passkeys, SAML/OIDC SSO, SCIM provisioning |
| Graph API | Microsoft Graph SDK | Users, groups, mail, security, policies, compliance, sub-processors |
| AI | Anthropic Claude API + smart-router | Security analysis, optimization, multi-provider dispatch (Anthropic/Gemini/Groq/DeepSeek) |
| Cache | Cloudflare KV | Cached tokens, scores, snapshots, drift, JTI deny-list, OAuth state |
| Storage | Cloudflare R2 | Snapshot exports, PDF reports, evidence bundles |
| Queues | Cloudflare Queues | scan-results, remediation-jobs, notifications (with DLQs) |
| Durable Objects | Cloudflare DO | WebSocket fan-out for real-time notifications |
| Webhooks | Incoming + outgoing (HMAC verified) | LemonSqueezy, OpenClaw, ConnectWise, marketplace |
| Notifications | Resend, Slack, Teams, Discord, web-push, SMS | Multi-channel alert delivery |
| Monitoring | Cloudflare Analytics, Sentry | Error tracking, performance, PII-scrubbed logs |

## Competitors & Market Context
**Competitors**: CoreView, Syskit Point, BetterCloud
**Differentiator**: AI-native analysis + MSP-first pricing (per-skill, not per-user) + per-tenant CIS overrides + skill marketplace
