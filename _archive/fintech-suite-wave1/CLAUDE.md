# FinTech Suite — CLAUDE.md

> **Portfolio Tracker**: `../../../portfolio-tracker.html` | **Readiness**: 88% | **Category**: SHIP

## Mission
Comprehensive financial technology platform suite: **PipeWarden** (CI/CD security), **QuantumBeam** (algorithmic trading), and **Enterprise Platform** (unified fintech services) serving fintech engineering teams, quant funds, and regulated financial institutions.

## Code Map & Index

### Directory Structure
```
fintech-suite/
├── pipewarden/                          # CI/CD Security Platform (TypeScript)
│   ├── src/worker/                      # Cloudflare Workers (Hono.js)
│   ├── e2e-tests/                       # 168+ Playwright E2E tests
│   ├── migrations/                      # D1 schema (forward-only)
│   └── docs/deployment/                 # Production runbooks
│
├── quantumbeam/                         # Algorithmic Trading Engine (Go)
│   ├── internal/
│   │   ├── algo/                        # Trading algorithms
│   │   ├── market/                      # Market data processing
│   │   ├── risk/                        # Risk management, portfolio
│   │   ├── order/                       # Order execution + matching
│   │   └── persistence/                 # PostgreSQL, Redis
│   ├── api/                             # gRPC services
│   ├── test/                            # Unit (Go) + E2E (Playwright)
│   ├── helm/                            # Kubernetes deployment
│   └── docs/                            # Trading rules, backtesting
│
├── fintech-enterprise-platform/         # Unified Services (Node.js)
│   ├── services/
│   │   ├── user-service/                # Identity + KYC
│   │   ├── account-service/             # Account management
│   │   ├── transaction-service/         # Transaction ledger
│   │   └── compliance-service/          # AML/KYC automation
│   ├── api-gateway/                     # Kong, rate-limiting
│   ├── integrations/                    # Bank APIs, clearing houses
│   ├── test/                            # 271+ tests
│   └── docs/deployment/                 # PCI-DSS, regulatory compliance
│
├── shared/                              # Shared Libs + Config
│   ├── types/                           # TypeScript contracts across products
│   ├── constants/                       # Feature flags, limits
│   ├── utils/                           # Crypto, retry, logging
│   └── monitoring/                      # OpenTelemetry setup
│
├── docs/
│   ├── api/                             # OpenAPI (PipeWarden, Enterprise)
│   ├── trading/                         # QuantumBeam algo spec + backtest
│   ├── compliance/                      # Regulatory policies
│   └── deployment/                      # Multi-product rollout strategy
│
├── k8s/                                 # Kubernetes (all products)
│   ├── base/                            # Deployment, Service, ConfigMap
│   ├── overlays/
│   │   ├── staging/                     # Test environment
│   │   └── production/                  # HA, auto-scaling
│   ├── istio/                           # Traffic mgmt, telemetry
│   └── monitoring/                      # Prometheus, AlertManager
│
└── docker-compose.integration.yml       # Local dev (all 3 products)
```

### Key Files Index

| File | Purpose | Lines |
|------|---------|-------|
| `pipewarden/src/worker/pipewarden-worker/src/api/v1/routes.ts` | PipeWarden API routes | <200 |
| `quantumbeam/internal/algo/portfolio.go` | Portfolio risk calculation | <200 |
| `quantumbeam/internal/market/feed.go` | Market data aggregation | <200 |
| `fintech-enterprise-platform/services/user-service/src/api.ts` | KYC/identity routes | <200 |
| `fintech-enterprise-platform/services/compliance-service/src/aml.ts` | AML check orchestration | <200 |
| `shared/types/index.ts` | Cross-product TypeScript contracts | <300 |
| `docker-compose.integration.yml` | Multi-product local environment | <150 |

## Development Guidelines

### Code Design Standards (Across All Products)
- **Max 200 lines per file** — split into modules; no exceptions
- **Single Responsibility** — one service, one algorithm, one rule
- **Type Safety** — strict TypeScript (Node.js products), full type hints (Go)
- **Error Handling** — explicit Result/Either types, typed exceptions, never silent catches
- **Naming** — domain language (Portfolio, Risk, Order, Transaction), no abbreviations
- **No Magic Values** — constants in `shared/constants/` or per-product config
- **Dependency Injection** — constructor injection for testability
- **Pure Functions First** — side effects at service layer / gRPC boundaries
- **Regulatory Compliance** — audit trails on all financial operations

### Architecture Patterns

**Inter-Product Communication**
```
PipeWarden (Edge)
    ↓
    └→ Alerts Enterprise Platform webhook

QuantumBeam (Kubernetes)
    ↓
    └→ Executes orders via Enterprise transaction-service (gRPC)

Enterprise Platform (API Gateway)
    ├→ Coordinates user/account/transaction services
    ├→ Enforces compliance (AML checks)
    └→ Manages external bank integrations
```

**Product Boundaries**
1. **PipeWarden** — standalone (no upstream dependencies), webhook alerts to Enterprise
2. **QuantumBeam** — standalone quant engine, integrates with Enterprise for order execution
3. **Enterprise Platform** — central hub (user, account, transaction, compliance services)

**Shared Contract**
- Event schema in `shared/types/events.ts` (product lifecycle events)
- Error codes in `shared/constants/errors.ts` (consistent across products)
- OpenTelemetry tracing in `shared/monitoring/` (distributed traces across products)

### Code Review Checklist (All Products)
- [ ] No file exceeds 200 lines
- [ ] All public functions have JSDoc + param/return types
- [ ] No `any` types or unsafe casts (Go: no `interface{}` without docstring)
- [ ] Error handling explicit; audit trail on financial operations
- [ ] Secrets never committed; use env validation + vaults
- [ ] Migrations forward-only (PipeWarden D1, Enterprise PostgreSQL)
- [ ] Tests cover happy + error paths; 90%+ coverage on critical modules
- [ ] Follows existing naming (camelCase functions, PascalCase types)
- [ ] No hardcoded URLs/keys; use Kubernetes ConfigMap + Secret
- [ ] Compliance checks applied (if financial transaction: logged, idempotent)

## Testing Strategy

### Unit Tests — Full Coverage Required

**TypeScript (PipeWarden, Enterprise)**
- **Framework**: Vitest
- **Coverage**: 90%+ lines, 100% on security/financial paths
- **Run**: `npm run test:unit` (per product)

**Go (QuantumBeam)**
- **Framework**: Go testing + testify
- **Coverage**: 90%+ lines, 100% on algo validation
- **Run**: `go test ./...` from quantumbeam/

**Test Files**
```
pipewarden/test/unit/
├── security/hmacVerifier.test.ts
└── services/pipelineService.test.ts

quantumbeam/test/
├── algo/portfolio_test.go
├── market/feed_test.go
└── order/execution_test.go

fintech-enterprise-platform/test/
├── user-service/
│   └── kyc.test.ts
├── compliance-service/
│   └── aml.test.ts
└── transaction-service/
    └── ledger.test.ts
```

### Integration Tests
- **Scope**: Service-to-service (especially financial paths), gRPC boundaries
- **Setup**: Docker Compose with PostgreSQL, Redis, mock bank APIs
- **Flows**:
  - PipeWarden webhook → Enterprise alert → notification sent
  - QuantumBeam order → Enterprise transaction → ledger recorded
  - KYC flow → AML check → account approved/rejected
- **Run**: `docker-compose -f docker-compose.integration.yml up && npm run test:integration`

### Browser / Claude Chrome Extension Tests
- **Tool**: Playwright + Claude in Chrome MCP
- **Coverage**: All three products' dashboards, VS Code extension
- **Flows to test**:
  1. **PipeWarden Dashboard** — risk timeline, webhook ingestion, remediation
  2. **QuantumBeam Dashboard** — portfolio overview, algo performance, drawdown alerts
  3. **Enterprise Platform** — KYC onboarding, account creation, transaction list
  4. **Cross-product flows** — PipeWarden alert → Enterprise user notification
  5. **Error scenarios** — auth failures, rate limits, service outages
- **Personas**: Free-tier (read-only), Pro (alerts/orders), Admin (compliance), Enterprise (API, custom integrations)
- **Run**:
  ```bash
  npm run test:e2e              # All Playwright E2E (all products)
  npm run test:e2e:ui          # Interactive mode
  npm run test:smoke           # Fast subset (login, core flows)
  npm run test:full            # All 271+ tests
  ```

**Key E2E Scenarios**
```
pipewarden/e2e-tests/tests/
├── pipelines.spec.ts          # Risk detection + remediation
└── webhooks.spec.ts           # Multi-provider webhook ingestion

quantumbeam/test/e2e/
├── algo.spec.ts               # Backtest → live trading flow
├── portfolio.spec.ts          # Risk limits, drawdown recovery
└── orders.spec.ts             # Place → fill → settlement

fintech-enterprise-platform/test/e2e/
├── kyc.spec.ts                # Onboarding → AML → account created
├── transactions.spec.ts       # Deposit → order → ledger entry
├── compliance.spec.ts         # AML/sanctions check, flags
└── cross-product.spec.ts      # PipeWarden alert → user notification
```

## Commands

### Development
```bash
# All products (local setup)
docker-compose -f docker-compose.integration.yml up

# Individual product dev
cd pipewarden && npm run dev
cd quantumbeam && go run ./cmd/server/main.go
cd fintech-enterprise-platform && npm run dev

# Type check all
npm run type-check
go vet ./...

# Lint all
npm run lint
```

### Testing
```bash
# All tests (all products)
npm run test

# Per-product
npm run test -w pipewarden
npm run test -w fintech-enterprise-platform
cd quantumbeam && go test ./...

# Coverage
npm run test:coverage

# E2E suite
npm run test:e2e
```

### Building & Deployment
```bash
# Build all
npm run build
docker build -f quantumbeam/Dockerfile -t fintech/quantumbeam:latest .

# Deploy to staging (Kubernetes)
kubectl apply -f k8s/overlays/staging/

# Canary deploy to production (5% traffic, 10min SLO check)
./scripts/deploy-canary.sh pipewarden
./scripts/deploy-canary.sh quantumbeam
./scripts/deploy-canary.sh enterprise-platform

# Rollback if needed
./scripts/rollback.sh pipewarden v1.0.0
```

## What's Done vs What's Left

### Completed (v1.0 MVP)
- [x] **PipeWarden** — CI/CD risk detection, GitHub/GitLab integration, 168 E2E tests
- [x] **QuantumBeam** — Basic mean-reversion algorithm, portfolio risk calc, Go backend
- [x] **Enterprise Platform** — User service (KYC), transaction ledger, basic AML check
- [x] Kubernetes deployment (staging + production)
- [x] Docker Compose for local dev (all 3 products)
- [x] OpenTelemetry tracing (cross-product)
- [x] 200-LOC policy enforced
- [x] 90%+ coverage on critical paths
- [x] 271+ total tests across products

### In Progress (v1.1 – 4-6 weeks)
- [ ] **PipeWarden** — Apple HIG dashboard redesign, WCAG 2.1 AA
- [ ] **QuantumBeam** — Advanced algos (momentum, pairs trading), backtesting UI
- [ ] **Enterprise** — Webhook retry + DLQ, regulatory report export, KYC document upload
- [ ] Multi-product alerting (all products → Enterprise notification service)
- [ ] OpenAPI/gRPC API documentation portal

### Backlog (v2.0+)
- [ ] **PipeWarden** — Custom provider integrations, remediation automation
- [ ] **QuantumBeam** — Live market data feed, paper trading, ML-based signals
- [ ] **Enterprise** — Dunning management, usage-based billing, white-label API
- [ ] Bank integration (wire transfers, ACH)
- [ ] Regulatory reports (FINRA, SEC compliance)

## Competitors & Market Context

### PipeWarden Competitors
| Feature | PipeWarden | GitHub Adv. | Snyk |
|---------|-----------|------------|------|
| CI/CD risk detection | ✅ | ⚠️ | ⚠️ |
| Multi-provider | ✅ | ❌ | ⚠️ |
| Edge-first | ✅ | ❌ | ❌ |

### QuantumBeam Competitors
| Feature | QuantumBeam | QuantConnect | Alpaca |
|---------|------------|-------------|--------|
| Own algo development | ✅ | ✅ | ❌ |
| Live trading | ✅ | ❌ | ✅ |
| Risk limits | ✅ | ⚠️ | ✅ |

### Enterprise Platform Competitors
| Feature | Enterprise | Stripe | Rippling |
|---------|-----------|--------|----------|
| Fintech-specific | ✅ | ❌ | ❌ |
| Compliance built-in | ✅ | ⚠️ | ✅ |
| Open source | ✅ | ❌ | ❌ |

**Market Differentiation**:
1. **Integrated suite** — single system for security + trading + compliance (vs. point solutions)
2. **Fintech-first** — regulatory compliance + audit trails baked in, not bolted on
3. **Developer ecosystem** — APIs + SDKs for custom integrations
4. **Kubernetes-ready** — stateless, horizontally scalable, cloud-native from day one

**Target IAS**: FinTech startups (Series A–B), quant funds, managed service providers, regulated financial institutions needing unified platform.

---

## Production Readiness Checklist

### Cross-Product
- [ ] All 271+ tests passing in CI
- [ ] Code coverage >90% on critical modules
- [ ] Security audit passed (OWASP + Go/Node dependencies)
- [ ] Kubernetes manifests validated + deployed to staging
- [ ] OpenTelemetry traces flowing to observability platform
- [ ] Alerting rules configured (error rates, SLO drift, financial anomalies)
- [ ] Incident runbooks for each product + cross-product failures
- [ ] 24/7 on-call rotation established
- [ ] Disaster recovery tested (backup/restore procedures)

### Product-Specific
- [ ] **PipeWarden** — 99.9% uptime SLA, SOC 2 audit ready
- [ ] **QuantumBeam** — Portfolio risk limits enforced, no rogue orders, audit trail
- [ ] **Enterprise** — KYC/AML compliance verified, bank integrations tested, ledger integrity

See `/docs/deployment/PRODUCTION_READINESS.md` for complete cross-product checklist.
