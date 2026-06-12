# QuantumBeam — CLAUDE.md

> **Portfolio Tracker**: `../../../portfolio-tracker.html` | **Readiness**: 76% | **Category**: BUILD

## Mission
Fraud detection engine (AMLIQ Fraud Engine) using classical machine-learning scoring (sklearn-based models; accuracy not yet benchmarked — no published metric). Real-time transaction scoring targeting sub-50ms response times at edge (Cloudflare Workers), serving fintech enterprises with SOC 2 / PCI DSS compliance as a goal.

## Code Map & Index
### Directory Structure
```
quantumbeam/
├── cmd/
│   ├── api/                      # REST API entry point (Gin router)
│   ├── api-server/               # Integrated API server
│   ├── migrate/                  # Database migrations runner
│   └── hello-server/             # Test server
├── internal/
│   ├── fraud/                    # Fraud detection engine
│   ├── ai/                       # AI/ML models and pipelines
│   ├── auth/                     # JWT auth and session management
│   ├── database/                 # GORM models and queries
│   ├── billing/                  # Stripe integration
│   ├── monitoring/               # Health checks, metrics, alerting
│   └── middleware/               # Auth, CORS, rate limiting
├── migrations/                   # SQL database migrations (versioned)
├── web/
│   ├── dashboard/               # React 18 frontend (fraud monitoring)
│   └── marketing/               # Landing page (HTML/CSS)
├── src/                         # Cloudflare Workers edge code
│   ├── index.js                 # Worker entry point (itty-router)
│   ├── routes/                  # API routes
│   └── middleware/              # CF-specific middleware
├── tests/
│   ├── integration/             # Integration tests (Go)
│   └── performance/             # Load testing and benchmarks
├── security/
│   ├── testing/                 # Security test suite
│   └── scripts/                 # Security scanning tools
├── docker-compose.yml
├── go.mod & go.sum
├── wrangler.toml                # Cloudflare Worker config
└── CLAUDE.md (this file)
```

### Key Files Index
| File | Purpose | Lines |
|------|---------|-------|
| cmd/api/main.go | API entry point, Gin setup | ~150 |
| internal/fraud/service.go | Fraud scoring logic | ~200 |
| internal/ai/models.go | ML model definitions | ~180 |
| internal/auth/jwt.go | JWT token lifecycle | ~140 |
| internal/database/models.go | GORM ORM models | ~200 |
| internal/billing/stripe.go | Stripe webhooks & pricing | ~160 |
| web/dashboard/src/app.tsx | React root component | ~120 |
| src/index.js | Cloudflare Worker handler | ~150 |

## Development Guidelines
### Code Design Standards
- **Max 200 lines per file** — split into focused modules if exceeding
- **Single Responsibility** — fraud scoring separate from auth, billing separate from ML
- **Type Safety** — strict Go typing (no interface{}), strict TypeScript (no any)
- **Error Handling** — typed errors, never silent catches, explicit Result/Either patterns
- **Naming** — descriptive (detectFraudRing, scoreTransaction, validateJWT)
- **No Magic Values** — all ports, timeouts, thresholds in constants or config files
- **Dependency Injection** — services injected via constructors for testability
- **Pure Functions First** — scoring logic returns data, side effects at handler boundaries

### Architecture Patterns
- **Go API** — Gin framework, JWT middleware, structured logging with slog
- **Fraud Engine** — Transaction → Feature extraction → ML scoring → Fraud ring detection
- **AI/ML Pipeline** — Model training offline, inference in fraud engine
- **Database** — PostgreSQL (production), async queries with connection pooling
- **Edge Layer** — Cloudflare Workers (D1 database, KV store, R2 storage)
- **Frontend** — React 18 functional components + hooks, Apple HIG design
- **Billing** — Stripe webhooks for subscription/usage events, idempotent handlers
- **Monitoring** — Prometheus metrics, structured audit logs (no PII)

### Code Review Checklist
- [ ] No Go file exceeds 200 lines (use interfaces for composition)
- [ ] No TypeScript file exceeds 200 lines (split React components)
- [ ] All public Go functions have error returns (never panic in user code)
- [ ] All React components have prop-type documentation
- [ ] No hardcoded secrets (use env vars or Cloudflare secrets)
- [ ] Input validation at system boundaries (SQL injection, XSS, etc.)
- [ ] Rate limiting on all public endpoints
- [ ] JWT tokens have expiration, refresh tokens rotate
- [ ] No PII in logs; card data tokenized via Stripe
- [ ] OWASP Top 10 checklist passed

## Testing Strategy
### Unit Tests — Full Coverage Required
- **Framework**: Go testing (go test), Jest for TypeScript/React
- **Coverage Target**: 80%+ lines (Go), 85%+ (TypeScript)
- **Run**: `go test ./...` (all Go), `npm test` (web/dashboard)
- **Test Pattern**: Every .go file has corresponding _test.go file

### Go Test Categories
- **Fraud engine tests**: Scoring accuracy, fraud ring detection, edge cases
- **Auth tests**: JWT validation, token rotation, session cleanup
- **Database tests**: GORM query correctness, transaction rollback
- **Billing tests**: Stripe webhook parsing, idempotency, price calculation
- **Middleware tests**: Rate limiting, CORS, error wrapping
- **Integration tests**: End-to-end transaction → scoring → fraud alert

### React Test Categories
- **Component tests**: Render, user interactions, prop changes
- **Hook tests**: State updates, side effects, cleanup
- **Page tests**: Navigation, data loading, error states

### Browser / Claude Chrome Extension Tests
- **Tool**: Claude in Chrome MCP + Playwright for e2e
- **Flows to test**:
  1. **Transaction Scoring**: Submit transaction via REST API → verify fraud score returned < 50ms
  2. **Dashboard Access**: Login with JWT → view fraud alerts → real-time score updates
  3. **Webhook Processing**: Trigger Stripe webhook → verify subscription updated → user limits enforced
  4. **Fraud Ring Detection**: Submit related transactions → verify ring_id grouped correctly
  5. **Rate Limiting**: Exceed rate limit → verify 429 response with retry-after header
  6. **Edge Worker**: Call /api/v1/score from Cloudflare Worker → verify D1 cache hit, sub-30ms response
- **Personas**: Enterprise SaaS customer, fraud analyst, finance manager, API consumer

## Commands
```bash
# Go API Development
go run cmd/api/main.go              # Start API server
go test ./...                       # Run all tests
go test -v ./internal/fraud/       # Test fraud engine
go vet ./...                        # Go vet checks
golangci-lint run                   # Comprehensive linting

# Database
make db-up                          # Start PostgreSQL + Redis
make db-migrate                     # Run Alembic migrations
make db-seed                        # Load test data

# Build & Deployment
go build -o bin/api cmd/api/main.go # Compile API binary
docker-compose build                # Build Docker images
docker-compose up                   # Start all services

# Cloudflare Worker
npm run dev                         # Wrangler local dev (port 8787)
npm run deploy                      # Deploy to staging
npm run deploy:prod                 # Deploy to production
wrangler tail                       # Stream live logs

# React Dashboard
cd web/dashboard
npm run dev                         # Start Next.js dev server (port 3000)
npm run build                       # Build for production
npm start                           # Start production server
npm test                            # Run Jest tests

# Security & Compliance
npm run security:audit              # OWASP dependency check
go test -run Security ./...         # Run security-specific tests
./security/scripts/run-security-tests.sh  # Full security suite
```

## What's Done vs What's Left
### Completed (76%)
- Go API server with Gin framework
- Fraud scoring engine (classical ML; accuracy not yet benchmarked)
- JWT auth with session management
- PostgreSQL database with GORM
- Stripe billing integration
- React 18 dashboard (Apple HIG design)
- Cloudflare Workers edge layer
- Docker Compose orchestration
- Structured logging with slog
- Integration tests (fraud, auth, billing)

### Remaining (24%)
- Expand test coverage to 80%+ (currently ~70%)
- E2E tests with Claude in Chrome MCP
- Complete Apple HIG implementation (dark mode, accessibility)
- Security hardening: OWASP audit, PCI DSS validation
- Performance optimization: cache strategies, query optimization
- CI/CD pipeline (GitHub Actions)
- Uptime monitoring and alerting
- Disaster recovery procedures

## Competitors & Market Context
**Target Market**: Enterprise fintech platforms ($10M+), payment processors, fraud prevention teams.

**Competitors**:
- Feedzai (ML fraud detection, enterprise)
- Kount (rules-based fraud detection)
- Stripe Radar (built-in, limited customization)
- In-house ML teams (large enterprises)

**Differentiation**:
- Classical ML scoring (Random Forest / Gradient Boosting ensemble)
- Sub-50ms response time at edge (Cloudflare Workers)
- Multi-ring fraud detection (organized fraud groups)
- SOC 2 / PCI DSS compliant out-of-box
- Modular architecture (use any component independently)

**Business Model**: SaaS pricing per transaction volume, enterprise support tiers. Target $10K MRR by Q2 2026.
