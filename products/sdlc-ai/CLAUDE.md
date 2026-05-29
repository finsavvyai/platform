# SDLC.ai - Claude Code Instructions

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules). Extracted from `products/queryflux/sdlc-ai/` on 2026-05-29.

## Product Vision
Enterprise-grade Secure Data Learning Platform with AI/ML capabilities, zero-trust security, and full compliance (GDPR, HIPAA, PCI-DSS). Multi-tenant architecture with Go API gateway, Python RAG service, Rust vector search, and Cloudflare edge deployment.

## Target
Production SaaS platform serving regulated enterprises (finance, healthcare, government). 99.9% uptime SLA, SOC 2 / HIPAA / GDPR / PCI-DSS compliant. Zero-trust security model. Multi-tenant data isolation.

**Domain:** sdlc.ai

## Architecture
- **API Gateway** - Go (Chi router, GORM), JWT auth, rate limiting, multi-tenant middleware
- **RAG Service** - Python (FastAPI, Pydantic), async AI/ML pipeline, document processing
- **Vector Core** - Rust (Tokio, Actix), high-performance vector search and embeddings
- **Admin UI** - Next.js, TypeScript, Tailwind CSS
- **DLP Service** - Data Loss Prevention scanning and policy enforcement
- **LLM Gateway** - AI model routing and orchestration
- **Database** - PostgreSQL (multi-tenant), Redis (caching, token blacklist)
- **Compliance** - Policy engine, audit logging, OPA integration
- **Observability** - Prometheus metrics, OpenTelemetry tracing, Grafana dashboards
- **Deployment** - Cloudflare Workers, Docker, Terraform

---

## Code Rules (MANDATORY)

### File Size
- Maximum **200 lines per file**. Split into focused modules if exceeded.
- Each file has a single responsibility. Name files by what they do.
- Index files only re-export. No logic in barrel files.

### Testing (Full Coverage)
- Every new `.go` file MUST have a corresponding `_test.go` file.
- Every new `.py` file MUST have a corresponding `test_*.py` file.
- Every new `.rs` file MUST have a corresponding `_test.rs` or test module.
- Every new `.ts` file MUST have a corresponding `.test.ts` file.
- Minimum **80% code coverage** per module. Target 90%+.
- Write tests BEFORE or ALONGSIDE implementation.
- Mock external dependencies. Never hit real services in unit tests.
- Test categories: unit, integration, e2e.
- All tests must pass before any commit.

### Security (OWASP Top 10 + Zero-Trust)
- No secrets in code. Use environment variables or secrets manager (Vault).
- NEVER commit `.env.production` or `.env.staging` files.
- Validate ALL external input at system boundaries. Sanitize before use.
- Use parameterized queries only. Never concatenate SQL strings.
- ALWAYS filter by `tenant_id` in multi-tenant queries. No cross-tenant leaks.
- JWT tokens must expire. Refresh tokens must rotate. Check blacklist (Redis).
- Enforce HTTPS/TLS 1.3 everywhere. No plaintext HTTP.
- Apply rate limiting on all public endpoints.
- Log security events to audit trail. Never log PII, tokens, or passwords.
- CSP headers on all HTML responses. X-Frame-Options: DENY.
- Generate unique salts for all password hashing (Argon2).
- CORS must be explicitly configured. No wildcard in production.

### Apple HIG Design (Admin UI)
- Follow Apple Human Interface Guidelines for all UI components.
- Typography: SF Pro-inspired, clean hierarchy (large titles, section headers, body).
- Spacing: 4px base grid (4, 8, 12, 16, 24, 32, 48, 64).
- Colors: semantic tokens (primary, secondary, success, warning, destructive). Dark mode required.
- Touch targets: minimum 44x44px on interactive elements.
- Animations: 200-300ms ease-in-out. No jarring transitions.
- Glassmorphism for overlays: backdrop-blur + translucent backgrounds.
- Accessibility: WCAG 2.1 AA. Full keyboard navigation.

### Code Style
- **Go**: `gofmt`, `golint`, `go vet`, `golangci-lint`. Structured logging with `slog`. Repository pattern for data access. Context propagation for tracing.
- **Python**: Type hints required. Pydantic for validation. Async/await for I/O. `ruff` for linting.
- **Rust**: Idiomatic ownership. Error handling with Result types. `clippy` for linting.
- **TypeScript**: strict mode. No `any`. ESLint + Prettier enforced.
- Naming: descriptive, no abbreviations. `validateTenantAccess` not `valTA`.
- Error handling: always explicit. No silent catches. Return typed errors.

### Git & Commits
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Each commit must pass lint + test + build.
- Never commit `.env`, credentials, or API keys.
- PR must include: description, test plan, and linked task.

### Architecture Paths
- Gateway entry: `services/gateway/cmd/server/main.go`.
- Auth server: `services/gateway/cmd/auth-server/main.go`.
- Gateway routes: `services/gateway/api/`.
- Gateway internal: `services/gateway/internal/` (domain, infrastructure, middleware).
- RAG entry: `services/rag/app/main.py`.
- Vector entry: `services/vector-core/src/main.rs`.
- Admin UI: `services/admin-ui/`.
- No circular imports. API versioning: `/api/v1/`.
- Database migrations: versioned in `database/migrations/`, forward-only.

---

## Skills for Claude (Project Completion Checklist)

### Sprint 1: Stabilization & Security Fixes
- [ ] Fix CRITICAL: empty salt in Argon2 password hashing.
- [ ] Fix CRITICAL: remove hardcoded credentials from env files.
- [ ] Fix HIGH: incomplete JWT service initialization.
- [ ] Audit all files for 200-line limit. Split oversized files.
- [ ] Fix all lint errors across Go, Python, Rust, TypeScript.

### Sprint 2: Test Coverage to 80%+
- [ ] Add Go tests for all gateway handlers, services, and middleware.
- [ ] Add Python tests for RAG service (FastAPI endpoints, document processing).
- [ ] Add Rust tests for vector-core (search, embeddings).
- [ ] Add TypeScript tests for Admin UI components.
- [ ] Configure coverage reporting in CI (target 80% minimum).

### Sprint 3: Compliance & Security Hardening
- [ ] Run OWASP dependency check (Go, Python, Rust, Node).
- [ ] Verify tenant isolation on every database query.
- [ ] Audit JWT flow: signature validation, expiry, blacklist, rotation.
- [ ] Add rate limiting to all unprotected endpoints.
- [ ] Validate GDPR/HIPAA/PCI-DSS compliance controls.
- [ ] Penetration test auth and data access flows.

### Sprint 4: Frontend (Apple HIG)
- [ ] Implement HIG design system for Admin UI.
- [ ] Build compliance dashboard, tenant management, audit logs.
- [ ] Implement dark mode with semantic color tokens.
- [ ] WCAG 2.1 AA audit and fixes.

### Sprint 5: CI/CD & Launch
- [ ] Complete CI pipeline (lint, test, build, security scan, deploy).
- [ ] Add staging + production deployment with approval gate.
- [ ] Set up Prometheus/Grafana monitoring.
- [ ] Generate OpenAPI spec for gateway endpoints.
- [ ] Landing page live at sdlc.ai.

---

## Quick Reference

| Component | Location | Tech |
|-----------|----------|------|
| Gateway Entry | `services/gateway/cmd/server/main.go` | Go/Chi |
| Auth Server | `services/gateway/cmd/auth-server/main.go` | Go/JWT |
| Gateway API | `services/gateway/api/` | Go |
| Gateway Internal | `services/gateway/internal/` | Go |
| RAG Service | `services/rag/app/main.py` | Python/FastAPI |
| Vector Core | `services/vector-core/src/main.rs` | Rust/Actix |
| Admin UI | `services/admin-ui/` | Next.js |
| DLP Service | `services/dlp/` | Python |
| LLM Gateway | `services/llm-gateway/` | TypeScript |
| Compliance | `compliance-platform/` | Go |
| Database | `database/migrations/` | PostgreSQL |
| Deployment | `deployments/` | Terraform/CF |
| Docs | `docs/` | Markdown |

## Commands
```bash
npm run dev                 # Start all services
npm run dev:gateway         # Go gateway on port 8000
npm run dev:rag             # Python RAG on port 8001
npm run dev:vector          # Rust vector service
npm test                    # All tests
npm run test:gateway        # Go tests
npm run test:rag            # Python tests (pytest)
npm run test:vector         # Rust tests (cargo test)
npm run lint                # Lint all services
npm run security:scan       # Security audit all languages
npm run docker:dev          # Docker development stack
```
