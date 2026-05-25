# Qestro - Claude Code Instructions

## Product Vision
AI-powered enterprise SaaS testing automation platform combining cloud orchestration with local device control. AI-first test generation, execution, and analytics for mobile (iOS/Android) and web applications. Target market: $15B+ test automation industry.

## Target
Production SaaS platform for enterprise QA teams. 99.9% uptime SLA, SOC 2 compliant, usage-based pricing. Competitors: mabl, Testim, Meticulous AI. Launch: Q1 2026.

**Domains:** qestro.io | qestro.app | app.qestro.ai

## Architecture
- **API Worker** - Hono on Cloudflare Workers, TypeScript strict mode, D1 database
- **Frontend** - React 19, Vite 7, TypeScript, Tailwind CSS, Atomic Design
- **Durable Objects** - CollaborationDO, SessionDO, TestExecutionDO, MonitoringDO
- **Playwright Service** - Express, playwright-core, Docker (port 4000)
- **CLI** - Commander, Inquirer, Chalk for developer tooling
- **MCP Connectors** - Render/Netlify deployment connectors
- **Orchestrator** - Python, CrewAI multi-agent AI orchestration
- **Database** - Cloudflare D1, KV for sessions/cache, R2 for artifacts
- **Real-time** - WebSocket via Durable Objects + Socket.io fallback

---

## Code Rules (MANDATORY)

### File Size
- Maximum **200 lines per file**. Split into focused modules if exceeded.
- Each file has a single responsibility. Name files by what they do.
- Index files only re-export. No logic in barrel files.

### Testing (Full Coverage)
- Every new `.ts` file MUST have a corresponding `.test.ts` file.
- Minimum **80% code coverage** per module. Target 90%+.
- Write tests BEFORE or ALONGSIDE implementation.
- Unit tests: Vitest (frontend), Jest (backend). Required for every service/component.
- Integration tests: Supertest for API. Required for every route.
- E2E tests: Playwright (Chromium, Firefox, WebKit, Mobile). Required for critical flows.
- Mock external dependencies. Never call real APIs in unit tests.
- Coverage thresholds: statements 80%, branches 75%, functions 80%, lines 80%.

### Security (OWASP Top 10 Compliant)
- No secrets in code. Use environment variables or Cloudflare secrets.
- Validate ALL external input at API boundaries (Zod schemas).
- Use parameterized queries only. Never concatenate SQL strings.
- Implement rate limiting on all public endpoints.
- JWT tokens must expire. Refresh tokens must rotate.
- CORS explicitly configured per environment. No wildcard in production.
- CSP headers on all pages. HTTPS only. No mixed content.
- Log security events to audit trail. Never log PII, tokens, or passwords.

### Apple HIG Design (Frontend)
- Follow Apple Human Interface Guidelines for all UI components.
- Typography: SF Pro-inspired, clean hierarchy (large titles, section headers, body).
- Spacing: 8px grid system (8, 16, 24, 32, 40, 48).
- Colors: semantic tokens. Support light/dark modes. WCAG 2.1 AA contrast.
- Touch targets: minimum 44x44px on interactive elements.
- Animations: 200-350ms duration, purposeful. Use Framer Motion.
- Glassmorphism: backdrop-blur, semi-transparent backgrounds, subtle borders.
- Loading states required for all async operations. Skeleton screens preferred.
- Responsive: mobile-first. Breakpoints at 640, 768, 1024, 1280px.

### Code Style
- TypeScript: strict mode. No `any`. ESLint + Prettier enforced.
- React: functional components + hooks only. No class components.
- Frontend: Atomic Design (atoms/, molecules/, organisms/, templates/, pages/).
- Backend services: one service per file in `/backend/src/services/`.
- Naming: descriptive, no abbreviations. `validateTestExecution` not `valTE`.
- Error handling: always explicit. No silent catches. Return typed errors.
- Imports: group by external, internal, types. Alphabetical within groups.

### Git & Commits
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Each commit must pass lint + test + build.
- Never commit `.env`, credentials, wrangler secrets, or API keys.
- PR must include: description, test plan, and linked task.

### Architecture Paths
- Worker entrypoint: `src/index.ts`.
- Backend entry: `backend/src/index.ts`.
- Routes in `backend/src/routes/` and `src/routes/`.
- Services in `backend/src/services/` and `src/services/`.
- Frontend components: `frontend/src/components/` (Atomic Design).
- Types in `src/types/` and `backend/src/types/`.
- No circular imports. Services depend on types, routes depend on services.
- API versioning: prefix all endpoints with `/api/v1/`.
- Database migrations: versioned in `drizzle/`, forward-only.

---

## Skills for Claude (Project Completion Checklist)

### Sprint 1: Stabilization & Cleanup
- [ ] Audit all files for 200-line limit. Split oversized files.
- [ ] Remove standalone-worker-*.js duplicates and backup files.
- [ ] Fix all TypeScript strict mode errors across backend/frontend/workers.
- [ ] Ensure `npm test` passes with 0 failures.
- [ ] Remove unused test/debug files.

### Sprint 2: Test Coverage to 80%+
- [ ] Add unit tests for all 74 backend services.
- [ ] Add unit tests for all frontend components (32 pages).
- [ ] Add integration tests for all 48 API routes.
- [ ] Add E2E tests for critical flows (auth, projects, test execution).
- [ ] Configure coverage reporting in CI (target 80% minimum).

### Sprint 3: Security Hardening
- [ ] Run OWASP dependency check on all packages.
- [ ] Audit every route for Zod input validation.
- [ ] Verify JWT implementation and token rotation.
- [ ] Add rate limiting to any unprotected endpoints.
- [ ] Add CSP + security headers middleware.

### Sprint 4: Frontend (Apple HIG)
- [ ] Implement HIG design system (tokens, components, layout).
- [ ] Apply Apple HIG to all 32 frontend pages.
- [ ] Implement dark mode with semantic color tokens.
- [ ] WCAG 2.1 AA audit and fixes.
- [ ] Responsive layouts (desktop, tablet, mobile).

### Sprint 5: CI/CD & Launch
- [ ] Complete GitHub Actions pipeline (lint, test, build, deploy).
- [ ] Add staging + production deployment with approval gate.
- [ ] Set up uptime monitoring (99.9% SLA tracking).
- [ ] Generate OpenAPI 3.1 spec for all endpoints.
- [ ] Landing page live at qestro.io.

---

## Quick Reference

| Component | Location | Tech |
|-----------|----------|------|
| Worker Entry | `src/index.ts` | Hono/CF Workers |
| Backend Entry | `backend/src/index.ts` | Hono |
| Backend Routes | `backend/src/routes/` | Hono |
| Backend Services | `backend/src/services/` | TypeScript |
| Frontend App | `frontend/src/` | React 19/Vite 7 |
| Playwright Svc | `playwright-service/` | Express |
| CLI | `cli/` | Commander |
| MCP Connectors | `mcp/` | MCP SDK |
| Orchestrator | `orchestrator/` | Python/CrewAI |
| Durable Objects | `src/durable-objects/` | CF DO |
| Types | `src/types/` | TypeScript |
| E2E Tests | `tests/e2e/` | Playwright |
| Migrations | `drizzle/` | SQL |

## Commands
```bash
npm run dev                 # Start all services
npm run dev:frontend        # Frontend on port 3000
npm run dev:backend         # Backend with tsx watch
npm test                    # All tests
npm run test:e2e            # Playwright E2E
npm run lint                # ESLint all code
npm run build               # Production build
npm run deploy:prod         # Production deploy
npm run db:migrate:remote   # Run DB migrations
```
