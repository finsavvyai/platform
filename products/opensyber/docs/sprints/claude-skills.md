# Claude Skills for OpenSyber + TokenForge

## What This Document Is

A complete mapping of Claude Code skills (agents, slash commands, tool
patterns) to every sprint task across all 10 sprints and both products.

---

## Infrastructure & DevOps Skills

### /docker — Container Development
- **When:** Sprint 1 (Dockerfile), Sprint 2 (skill sandbox)
- **Tasks:** Write Dockerfile, optimize layers, security hardening
- **Agent:** `luna-agents:luna-docker`

### /deploy — Cloudflare Deployment
- **When:** Every sprint (deploy API + web after changes)
- **Tasks:** `wrangler deploy`, OpenNext build, D1 migrations
- **Agent:** `luna-agents:luna-deployment`

### /cloudflare — Workers & D1 Configuration
- **When:** Sprint 1 (secrets), Sprint 4 (rate limit), Sprint 7 (new worker), Sprint 10 (versioning)
- **Tasks:** KV namespaces, secrets, D1 migrations, cron triggers, new Workers
- **Agent:** `luna-agents:luna-cloudflare`

---

## Backend & API Skills

### /api — API Route Generation
- **When:** Sprint 1 (compute), Sprint 4 (vault), Sprint 7 (TokenForge API), Sprint 8 (org routes), Sprint 9 (SSO + admin)
- **Tasks:** Hono routes, middleware, auth, Zod validation, pagination
- **Agent:** `luna-agents:luna-api-generator`

### /database — Schema & Migrations
- **When:** Sprint 1 (machineId), Sprint 4 (credentials), Sprint 7 (TF tenants), Sprint 8 (orgs + roles), Sprint 9 (SSO configs), Sprint 10 (uptime + residency)
- **Tasks:** Drizzle schema, D1 migrations, index optimization
- **Agent:** `luna-agents:luna-database`

---

## Frontend & UI Skills

### /ui-fix — Component Bug Fixes
- **When:** Sprint 3 (CRUD), Sprint 5 (polish), Sprint 7 (TF dashboard), Sprint 8 (team UI)
- **Tasks:** Fix broken components, layout issues, client errors
- **Agent:** `luna-agents:luna-ui-fix`

### /hig — Apple Human Interface Guidelines
- **When:** ALL sprints — every new UI component must be validated
- **Tasks:** Validate design, spacing, typography, color, empty states
- **Agent:** `luna-agents:luna-hig` or `apple-hig-ui-advisor`

### /ui-test — Visual Component Testing
- **When:** Sprint 3 (modals), Sprint 5 (E2E), Sprint 7 (TF pages), Sprint 8 (team pages)
- **Tasks:** Screenshot tests, interaction tests, responsive tests
- **Agent:** `luna-agents:luna-ui-test`

### /seo — Search Engine Optimization
- **When:** Sprint 5 (launch), Sprint 7 (TokenForge launch)
- **Tasks:** Meta tags, Open Graph, sitemap, structured data
- **Agent:** `luna-agents:luna-seo`

---

## Quality & Testing Skills

### /test — Unit Test Generation
- **When:** EVERY sprint — every new file needs tests
- **Tasks:** Generate vitest tests for services, components, utils
- **Agent:** `unit-test-generator`

### /testing — Integration Testing
- **When:** Sprint 2 (skill flow), Sprint 5 (E2E), Sprint 7 (TF integration), Sprint 8 (RBAC), Sprint 10 (security audit)
- **Tasks:** API integration tests, cross-service tests, Playwright E2E
- **Agent:** `luna-agents:luna-testing-validation`

### /code-review — Code Quality Review
- **When:** End of EVERY sprint before deployment
- **Tasks:** Review patterns, security, performance, 200-line limit
- **Agent:** `luna-agents:luna-code-review`

---

## Security Skills

### /auth — Authentication & Authorization
- **When:** Sprint 1 (gateway tokens), Sprint 4 (vault), Sprint 6 (TokenForge ECDSA), Sprint 8 (RBAC), Sprint 9 (SSO/SAML)
- **Tasks:** Token generation, encryption, RBAC middleware, SAML parsing, OIDC flow
- **Agent:** `luna-agents:luna-auth`

---

## Planning & Architecture Skills

### /plan — Implementation Planning
- **When:** Start of EVERY sprint, before any complex feature
- **Tasks:** Break down tasks, identify files, plan approach
- **Agent:** `Plan` or `luna-agents:luna-task-planner`

### /design — Technical Architecture
- **When:** Sprint 1 (compute), Sprint 2 (sandbox), Sprint 6 (adapter pattern), Sprint 8 (multi-tenancy), Sprint 9 (SSO)
- **Tasks:** System design, data flow, component architecture
- **Agent:** `design-architect`

### /enterprise — Enterprise Patterns
- **When:** Sprint 8 (RBAC), Sprint 9 (SSO), Sprint 10 (scale)
- **Tasks:** Multi-tenancy, RBAC design, SSO integration, data residency
- **Agent:** `enterprise-patterns-advisor`

### /execute — Task Execution
- **When:** During sprints, for systematic implementation
- **Tasks:** Work through task lists methodically
- **Agent:** `luna-agents:luna-task-executor`

### /requirements — Requirements Analysis
- **When:** Sprint 6 (TokenForge product scope), Sprint 8 (enterprise requirements)
- **Tasks:** Analyze feature requirements, identify gaps, define scope
- **Agent:** `luna-agents:luna-requirements-analyzer`

---

## Documentation Skills

### /docs — Documentation Generation
- **When:** Sprint 5 (OpenSyber docs), Sprint 7 (TokenForge npm README + docs)
- **Tasks:** Getting started, API reference, integration guides, JSDoc
- **Agent:** `luna-agents:luna-documentation`

### /user-guide — User Guide Creation
- **When:** Sprint 5 (onboarding docs), Sprint 7 (TF integration guide)
- **Tasks:** Step-by-step guides with screenshots
- **Agent:** `luna-agents:luna-user-guide`

---

## Monitoring & Observability

### /monitoring — Observability Setup
- **When:** Sprint 4 (security score), Sprint 5 (error tracking), Sprint 7 (TF usage tracking), Sprint 10 (SLA monitoring)
- **Tasks:** Error tracking, alerting, metrics, uptime
- **Agent:** `luna-agents:luna-monitoring-observability`

### /analytics — Usage Analytics
- **When:** Sprint 7 (TokenForge usage), Sprint 9 (admin billing dashboard), Sprint 10 (enterprise metrics)
- **Tasks:** Usage tracking, billing metrics, MRR charts
- **Agent:** `luna-agents:luna-analytics`

---

## Billing & Payments

### /lemonsqueezy — Payment Integration
- **When:** Sprint 5 (OpenSyber billing verification), Sprint 7 (TokenForge billing)
- **Tasks:** LemonSqueezy products, variants, webhooks, checkout
- **Agent:** `luna-agents:luna-lemonsqueezy`

---

## Post-Launch

### /post-launch — Post-Launch Review
- **When:** After Sprint 5 (MVP launch), after Sprint 7 (TF launch), after Sprint 10 (enterprise launch)
- **Tasks:** Performance review, user feedback, bug triage
- **Agent:** `luna-agents:luna-post-launch-review`

---

## Sprint-to-Skills Matrix (All 10 Sprints)

| Sprint | Primary Skills | Secondary Skills |
|---|---|---|
| 1. Runtime | docker, deploy, api, database, plan | test, auth |
| 2. Skills | api, test, design, docker | code-review, monitoring |
| 3. CRUD | ui-fix, hig, test, ui-test | code-review |
| 4. Security | auth, test, api, database | monitoring, code-review |
| 5. Launch | testing, docs, deploy, monitoring, seo | hig, post-launch, lemonsqueezy |
| 6. TF Standalone | design, api, test, auth | enterprise, code-review |
| 7. TF Product | deploy, cloudflare, hig, docs, lemonsqueezy | seo, analytics, post-launch |
| 8. RBAC + Teams | enterprise, auth, database, api, test | ui-fix, hig |
| 9. SSO + Admin | auth, api, design, test, docs | enterprise, analytics |
| 10. Scale | monitoring, testing, deploy, enterprise | post-launch, code-review |

---

## Recommended Workflow Per Task

```
1.  Read the sprint task description
2.  /plan — plan the implementation approach
3.  /design — if architectural decisions needed
4.  Write code (max 200 lines per file)
5.  /test — generate unit tests
6.  Run: pnpm typecheck && pnpm test
7.  /code-review — review before committing
8.  /hig — validate any UI changes
9.  Commit with descriptive message
10. Mark task [x] in sprint doc
11. Move to next task
```

## Build & Deploy Verification

After each sprint section:
```bash
pnpm typecheck        # TypeScript clean
pnpm test             # All tests pass
pnpm build            # Full build succeeds

# Deploy OpenSyber:
cd apps/api && pnpm deploy
cd apps/web && find .open-next -delete 2>/dev/null; pnpm build && pnpm deploy

# Deploy TokenForge (sprints 7+):
cd apps/tokenforge-api && pnpm deploy
cd apps/tokenforge-web && find .open-next -delete 2>/dev/null; pnpm build && pnpm deploy
```

## Security Verification (Every Sprint)

```bash
# Check no secrets in code:
grep -r "sk_live\|sk_test\|HETZNER.*=\|Bearer " apps/ packages/ --include="*.ts" --include="*.tsx" -l

# Check file sizes (200 line limit):
find apps/ packages/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20

# Check test coverage:
pnpm test -- --coverage
```
