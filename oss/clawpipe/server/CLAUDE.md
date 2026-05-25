# FinSavvyAI — Distributed LLM Cluster Management — CLAUDE.md

> **Portfolio Tracker**: Open Source + Commercial SaaS | **Readiness**: 92% | **Category**: SHIP

## Mission
Drop-in OpenAI API replacement with multi-provider routing, agent governance, and policy enforcement—self-hosted or cloud-based LLM cluster management with full observability.

## Code Map & Index

### Multi-Component Architecture (600 files)
```
llm/
├── src/                         # Core Python services
│   ├── api/
│   │   ├── gateway.py          # OpenAI-compatible API gateway (port 8080)
│   │   ├── routes/             # API endpoints (v1/chat/completions, v1/models, etc.)
│   │   └── middleware/         # Auth (API keys), rate limiting, CORS, logging
│   ├── core/
│   │   ├── master_server.py    # Orchestrator (port 8000)
│   │   ├── config.py           # Config parsing + validation
│   │   ├── logger.py           # Structured logging
│   │   └── health.py           # Health check aggregation
│   ├── workers/
│   │   ├── worker_node.py      # Worker process (port 8001+N)
│   │   ├── registry.py         # Worker registration + heartbeat
│   │   └── pool.py             # Thread pool for skill execution
│   ├── providers/              # LLM provider abstractions
│   │   ├── openai_provider.py  # OpenAI (primary)
│   │   ├── anthropic_provider.py # Claude (fallback)
│   │   ├── ollama_provider.py  # Local Ollama
│   │   ├── openhands_provider.py # Agent execution
│   │   └── base.py             # Provider interface
│   ├── channels/               # Multi-channel ingress
│   │   ├── http.py             # REST API
│   │   ├── websocket.py        # WebSocket (streaming)
│   │   ├── grpc.py             # gRPC (low latency)
│   │   └── sse.py              # Server-sent events
│   ├── policy/
│   │   ├── engine.py           # Policy evaluation
│   │   ├── policies/           # Built-in policies (cost, safety, latency)
│   │   └── analyzer.py         # Request analysis for policy enforcement
│   ├── cli/
│   │   ├── finsavvyai_cli.py  # Main CLI entry point
│   │   ├── commands/           # install, status, logs, config, etc.
│   │   └── docker_helper.py    # Docker run helpers
│   ├── chat/
│   │   ├── index.html          # Standalone chat UI
│   │   ├── js/                 # Chat client
│   │   └── css/                # Styling
│   ├── dashboard/
│   │   ├── server.py           # Python Flask dashboard (port 3000)
│   │   ├── templates/          # HTML templates
│   │   └── static/             # CSS, JS
│   ├── scripts/
│   │   ├── security_scan.py   # OWASP + dependency checks
│   │   ├── install.sh          # Installation script
│   │   └── health_check.py    # Diagnostic script
│   └── tests/
│       ├── unit/               # Unit tests (pytest)
│       ├── integration/        # Integration tests
│       └── e2e/               # End-to-end tests (playwright)
│
├── packages/
│   └── control-hub-node/       # Node.js control hub (port 9090)
│       ├── src/
│       │   ├── index.js        # Express server
│       │   ├── routes/         # Management endpoints
│       │   ├── services/       # Provider management, policy config
│       │   └── db/             # SQLite or in-memory store
│       ├── package.json        # Zero external deps (pure stdlib)
│       └── tests/
│
├── desktop-extension/          # Desktop App — Go + HTML (port 8888)
│   ├── main.go                 # GTK/Cocoa native window
│   ├── frontend/               # Embedded HTML UI
│   └── Makefile
│
├── ios-app/                    # iOS App — Swift + SwiftUI
│   ├── FinSavvyAI/
│   │   ├── App.swift           # App entry point
│   │   ├── Views/              # SwiftUI screens
│   │   ├── Models/             # Data structures
│   │   ├── Services/           # API client, local persistence
│   │   └── Utils/              # Logging, formatting
│   ├── FinSavvyAITests/        # XCTest tests
│   └── FinSavvyAI.xcodeproj/
│
├── cloudflare-api/             # Cloudflare Workers — Node.js (Edge)
│   ├── src/
│   │   ├── index.js            # Hono app
│   │   ├── routes/             # API endpoints
│   │   ├── middleware/         # Auth, CORS
│   │   └── db/                 # D1 + KV access
│   └── wrangler.toml
│
├── deploy/                     # Infrastructure & Deployment
│   ├── docker/
│   │   ├── Dockerfile          # Multi-stage build
│   │   └── docker-compose.yml  # Local dev (all services)
│   ├── terraform/              # Cloud infrastructure
│   ├── kubernetes/             # K8s manifests (optional)
│   ├── systemd/                # systemd service files
│   └── env/                    # Environment templates
│
├── observability/              # Monitoring Stack
│   ├── prometheus/             # Metrics collection
│   │   └── prometheus.yml      # Config
│   ├── grafana/                # Dashboards (port 3000)
│   │   └── dashboards/         # JSON dashboard definitions
│   ├── alertmanager/           # Alert routing
│   └── jaeger/                 # Distributed tracing (optional)
│
└── docs/
    ├── README.md               # Quick start, features, architecture
    ├── INSTALLATION.md         # Docker, systemd, Homebrew
    ├── API.md                  # OpenAI compatibility reference
    ├── CONFIGURATION.md        # Provider setup, policy engine
    ├── TROUBLESHOOTING.md      # Common issues + solutions
    └── examples/               # curl examples, SDK samples
```

### Key Files Index
| File | Purpose | Lines |
|------|---------|-------|
| `src/api/gateway.py` | OpenAI-compatible API gateway | ~220 |
| `src/core/master_server.py` | Orchestrator, provider routing, policy enforcement | ~250 |
| `src/workers/worker_node.py` | Async worker, skill execution | ~180 |
| `src/policy/engine.py` | Policy evaluation (cost, safety, latency gates) | ~200 |
| `src/providers/openai_provider.py` | OpenAI client wrapper | ~120 |
| `src/providers/anthropic_provider.py` | Anthropic Claude integration | ~110 |
| `src/cli/finsavvyai_cli.py` | Main CLI (install, status, logs) | ~180 |
| `packages/control-hub-node/src/index.js` | Control hub API (no deps) | ~160 |
| `ios-app/FinSavvyAI/Views/ContentView.swift` | Main iOS UI | ~140 |
| `deploy/docker/docker-compose.yml` | Local dev orchestration | ~80 |

### API Endpoint Map
```
OpenAI-Compatible Endpoints:
POST   /v1/chat/completions     # Main completion endpoint
GET    /v1/models               # List available models
POST   /v1/completions          # Legacy completions
POST   /v1/embeddings           # Embedding generation
GET    /v1/compat               # Compatibility report

Management Endpoints:
GET    /health                  # Health check (JSON)
GET    /health?verbose=true     # Detailed diagnostics
POST   /config                  # Update configuration
GET    /config                  # Fetch current config
GET    /metrics                 # Prometheus metrics
GET    /providers               # List connected providers
GET    /policies                # List active policies
POST   /policy/evaluate         # Test policy against request
GET    /logs                    # Stream server logs
```

### Database Schema (30+ tables)
```
Providers:
- providers (id, type, api_key_hash, model, status)
- provider_usage (date, provider_id, requests, tokens_in, tokens_out, cost)

Policies:
- policies (id, name, rule_json, enabled)
- policy_evaluations (id, policy_id, request_id, passed, details)

Requests:
- requests (id, timestamp, model, tokens_in, tokens_out, latency_ms, provider, status)
- request_logs (id, request_id, level, message, timestamp)

Workers:
- workers (id, host, port, status, load, last_heartbeat)
- worker_skills (worker_id, skill_name, status)

Channels:
- channels (id, type, config_json, enabled)
- channel_throughput (channel_id, date, requests, errors)

Configuration:
- config_keys (key, value, updated_at, updated_by)
```

## Development Guidelines

### Code Design Standards
- **Max 200 lines per file** — enforced in CI
- **Single Responsibility** — one provider class, one policy rule, one route handler
- **Type Safety** — Python type hints on all functions, Dataclasses for structured data
- **Error Handling** — structured errors with correlation IDs, never swallow exceptions
- **Naming** — descriptive (e.g., `evaluate_cost_policy` not `eval_cost`)
- **No Magic Values** — constants in `src/core/constants.py`
- **Dependency Injection** — pass config, logger, providers as constructor params
- **Async/Await** — `async def` for I/O-bound operations (providers, HTTP)

### Architecture Patterns
**Request Flow**:
```
Incoming request (HTTP, WebSocket, gRPC)
↓
AuthN: Validate API key (D1 or in-memory cache)
↓
AuthZ: Check rate limits + quota
↓
Policy Engine: Evaluate all active policies
  - Cost gate: estimated cost ≤ budget?
  - Safety gate: request matches safety policy?
  - Latency gate: estimated latency ≤ threshold?
↓
Provider Routing: Select provider (load-balanced, fallback chain)
↓
Invoke Provider: OpenAI, Claude, Ollama, etc.
↓
Emit Metrics: request_latency, tokens_used, cost, status
↓
Response: OpenAI-compatible JSON
```

**Provider Chain (Fallback)**:
```
Primary: OpenAI (lowest latency, highest cost)
↓
Fallback 1: Anthropic Claude (mid latency, mid cost)
↓
Fallback 2: Ollama (local, free)
↓
Error: Return error with retry-after header
```

### Code Review Checklist
- [ ] No file exceeds 200 lines
- [ ] All functions have type hints and docstrings
- [ ] Error handling with correlation IDs
- [ ] No secrets in code (use env vars or secret manager)
- [ ] Follows OWASP Top 10 (no SQL injection, XSS, etc.)
- [ ] Rate limiting enforced on all public endpoints
- [ ] Tests written (unit + integration coverage ≥95%)
- [ ] Dependency audit passed (`pip-audit`, `npm audit`)
- [ ] Accessible UI (WCAG AA for web surfaces)

## Testing Strategy

### Unit Tests — 95%+ Coverage
- **Framework**: pytest + pytest-asyncio (Python), XCTest (iOS), Jest (Node.js)
- **Naming**: `test_openai_provider_routes_to_fallback_on_rate_limit()`
- **Structure**: Arrange → Act → Assert
- **Mocking**: Mock HTTP clients, providers, external APIs
- **Run**: `pytest --maxfail=1 --cov=src --cov-fail-under=95`

### Integration Tests
- Test API endpoints with real D1 (miniflare) or SQLite
- Test provider routing with stubbed LLM responses
- Test policy evaluation against realistic requests
- Test CLI commands with isolated environment
- Run: `pytest tests/integration/ --maxfail=1`

### E2E/Browser Tests — Critical Flows
- **Tool**: Playwright for web UIs, XCTest for iOS
- **Test these flows**:
  1. Docker: `docker run` → health check → curl chat/completions → response
  2. Pip: `pip install finsavvyai` → `finsavvyai quickstart` → API responds
  3. CLI: Configure providers → `finsavvyai status` → list providers + load
  4. Dashboard: View request logs → filter by provider → export CSV
  5. Mobile: View provider status → trigger manual health check → view logs
  6. Homebrew: `brew install finsavvyai` → `finsavvyai doctor` → setup validation
  7. Policy: Set cost cap $1/day → send request → verify gate enforcement
  8. Fallback: Disable OpenAI → send request → confirm Claude fallback
  9. Desktop App: GUI provider config → test endpoint → view results
  10. Observability: Monitor Grafana dashboard → confirm metrics populated
- **Personas**:
  - Dev (localhost, single provider, testing)
  - SRE (self-hosted Docker, 3+ providers, policy enforcement)
  - Enterprise (cloud SaaS, audit logs, SSO)
- **Run**: `npx playwright test` (web), `xcodebuild test` (iOS)

### Test File Naming
- Unit: `tests/unit/test_openai_provider.py`, `tests/unit/test_policy_engine.py`
- Integration: `tests/integration/test_gateway_routing.py`
- E2E: `tests/e2e/test_docker_quickstart.e2e.py`, `tests/e2e/test_cli.e2e.py`
- Browser: `tests/e2e/test_dashboard.browser.test.ts` (Playwright)

## Commands
```bash
# Python environment
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Local development (Docker)
docker-compose up -d              # Start all services
docker-compose logs -f api        # Watch API logs
curl http://localhost:8080/v1/models # Test API

# API Gateway
python src/api/gateway.py --port 8080 --log-level debug

# Master Server
python src/core/master_server.py --config config.yaml

# Worker Node
python src/workers/worker_node.py --master-url http://localhost:8000 --port 8001

# CLI
finsavvyai quickstart             # Interactive setup
finsavvyai status                 # Check provider status
finsavvyai config list            # Show current config
finsavvyai config set openai_key $API_KEY
finsavvyai logs --provider openai --tail 50
finsavvyai doctor                 # Diagnostic check

# Testing
pytest tests/unit/ --cov=src --cov-fail-under=95
pytest tests/integration/ --maxfail=1
npx playwright test               # Web UI tests
xcodebuild test -scheme FinSavvyAI # iOS tests

# Dependency scans
pip-audit                         # Python security
npm audit --audit-level=high      # Node.js security

# Security scan
python scripts/security_scan.py

# Build
docker build -t finsavvyai:latest .
pip install --upgrade build && python -m build  # PyPI package
npm run build                     # Node.js packages

# Deploy
docker push finsavvyai:latest     # Push to Docker Hub
twine upload dist/*               # Publish to PyPI
npm publish                       # npm publish
brew tap finsavvyai/tap && brew install finsavvyai # Homebrew
```

## What's Done vs What's Left

**Done**:
- OpenAI-compatible API gateway
- Multi-provider support (OpenAI, Claude, Ollama, OpenHands)
- Policy engine (cost, safety, latency gates)
- CLI with `quickstart`, `status`, `logs`, `doctor` commands
- Chat UI (standalone HTML)
- Dashboard (Python Flask)
- Control Hub (Node.js, no external deps)
- Desktop App (Go)
- iOS App (SwiftUI)
- Docker + docker-compose
- Observability (Prometheus + Grafana)
- Installation scripts (pip, Homebrew, Docker)
- **Circuit breaker for providers** (resilience against failures)
- **Response cache layer** (LRU + TTL, hash-based keys, hit/miss metrics)
- **High-throughput load tests** (1000+ concurrent requests, cache effectiveness, multi-provider distribution)

**Left** — **PRIORITIES**:
1. **Production Hardening** (Readiness: 92%)
   - ~~Load testing (10K req/s)~~ ✓ Added comprehensive load test suite
   - Database query optimization
   - Redis integration (distributed cache)
   - ~~Circuit breaker for providers~~ ✓ Already implemented
   - Graceful degradation

2. **Enterprise Features**
   - SAML/OIDC SSO
   - Audit logging (all requests)
   - Custom billing models
   - Data residency + encryption
   - SLA monitoring

3. **AI Enhancements**
   - Cost prediction (before execution)
   - Latency prediction
   - Provider auto-selection based on criteria
   - Fine-tuning support

4. **Kubernetes Support**
   - Helm charts
   - HPA (horizontal pod autoscaling)
   - Service mesh integration (Istio)

## Key Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| API Gateway | Python aiohttp | OpenAI-compatible endpoints |
| Master Server | Python aiohttp | Orchestration, routing, policy |
| Worker Nodes | Python aiohttp | Async task execution |
| CLI | Python argparse | Command-line interface |
| Chat UI | HTML/CSS/JS | Standalone chat interface |
| Dashboard | Flask + SQLite | Request monitoring, config |
| Control Hub | Node.js express | Provider management API |
| Desktop App | Go + GTK/Cocoa | Native GUI |
| iOS App | Swift + SwiftUI | Native mobile app |
| CF Edge | Cloudflare Workers + D1 | Edge-deployed API |
| Database | SQLite (local) or PostgreSQL (cloud) | Persistence |
| Cache | In-memory (local) or Redis (cloud) | Rate limiting, config |
| Monitoring | Prometheus + Grafana | Metrics, dashboards |
| Tracing | Jaeger (optional) | Distributed tracing |
| Distribution | Docker, PyPI, Homebrew, npm | Package distribution |

## Competitors & Market Context
**Competitors**: Ollama, vLLM, LiteLLM, llama.cpp
**Differentiator**: Multi-provider + policy engine + agent governance
