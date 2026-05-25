# Changelog

All notable changes to FinSavvyAI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes.

## [1.1.0] - 2026-03-13

### Added

- **Test Coverage Overhaul**
  - Python test coverage: 88% to 97% (all critical modules at 100%)
  - Go desktop-app coverage: 62% to 92%
  - Zero file-size violations (previously 13 files over 200-line limit)

- **Apple HIG Design System**
  - Unified typography, spacing, and color system across Control Hub, Chat UI, and Dashboard
  - Loading indicators, empty states, and error feedback on all screens
  - Full dark mode support via `prefers-color-scheme`
  - Interaction state polish (hover, focus, active) across all web UIs

- **Production Operations**
  - SLO definitions and error budget tracking
  - AlertManager configuration with routing and escalation rules
  - Grafana dashboards for cluster health, request latency, and provider routing
  - Helm charts for Kubernetes deployment (`helm/finsavvyai/`)
  - Load testing suite (50/100/200 concurrent requests)
  - Disaster recovery test suite with backup/restore validation

- **API and Platform**
  - API versioning support with `/api/versions` endpoint
  - Version headers on all responses (`X-API-Version`, `X-API-Supported-Versions`)
  - Deprecation headers for retired API versions
  - 32 Playwright tests for standalone Chat UI

- **Phase 8 — Viral Growth & Production Readiness**
  - `GET /v1/compat` — machine-readable OpenAI compatibility matrix
  - `GET /health?verbose=true` — setup completion percentage
  - OpenAI-compatible response headers: `openai-version`, `openai-processing-ms`, `x-request-id`
  - `finsavvyai doctor` and `finsavvyai quickstart` CLI commands
  - Multi-stage Docker build with non-root user and `HEALTHCHECK`
  - One-click deploy via Railway and Render
  - `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
  - `.env.example` fully documented across 7 sections

### Fixed

- Notebook routes returning 500 on missing source parameters
- LMStudio provider async mock failures in test suite
- Security headers middleware not applying `X-Content-Type-Options` on error responses
- Rate limiter edge case with concurrent sliding window cleanup

### Changed

- `pyproject.toml`: `requires-python` raised to `>=3.11`; heavy deps moved to `[local]` extras
- `Dockerfile` default `CMD` changed to `src.api.gateway`
- README.md rewritten for v1.1.0 launch with streamlined install and feature overview
- `.gitignore`: removed `.github/` exclusion so CI workflows are committed

### Migration Guide

**Switching from direct OpenAI SDK to FinSavvyAI — change one line:**

```python
# Before
client = OpenAI(api_key="sk-...")

# After
client = OpenAI(base_url="http://localhost:8080/v1", api_key="any")
```

**LangChain:**

```python
ChatOpenAI(base_url="http://localhost:8080/v1", api_key="any")
```

## [1.0.0] - 2025-02-14

### Added
- **Core System**
  - Distributed AI cluster with master-worker architecture
  - Intelligent request routing with task type detection
  - Circuit breaker pattern for fault tolerance
  - Rate limiting with sliding window algorithm
  - Request queue for high load scenarios
  - Connection pooling and session reuse
  - Request caching with configurable TTL

- **API Gateway**
  - OpenAI-compatible `/v1/chat/completions` endpoint
  - `/v1/models` endpoint aggregating models from all workers
  - Authentication with bcrypt-hashed API keys
  - CORS with configurable origins
  - Rate limiting headers
  - Request ID tracking for distributed tracing

- **Inference Engine**
  - llama-cpp-python integration
  - CPU/GPU/Metal acceleration support
  - Model loading/unloading at runtime
  - Streaming responses via Server-Sent Events
  - Token counting and usage reporting
  - Model health checks

- **Observability**
  - Prometheus metrics export
  - Structured JSON logging with correlation IDs
  - W3C Trace Context propagation
  - Distributed tracing with span collector
  - Grafana dashboard templates
  - Alertmanager integration
  - Audit logging for security events

- **Desktop Application**
  - Cross-platform macOS/Windows/Linux support (Go backend)
  - Real-time cluster monitoring via WebSocket
  - Node management (start/stop/restart)
  - Model management (download/delete/configure)
  - Service control (master/gateway/worker)
  - Connection settings with configurable base URL
  - Apple HIG-compliant dark UI design

- **iOS Application**
  - Native SwiftUI interface
  - Cluster status monitoring
  - Node and model management
  - Service control
  - WebSocket real-time updates with exponential backoff reconnection
  - Offline mode with cached data
  - Secure Keychain credential storage
  - Pull-to-refresh on all views
  - VoiceOver accessibility support

- **Deployment**
  - Docker Compose for local development
  - Production Docker Compose stack
  - systemd service deployment scripts
  - Cloudflare Tunnel integration for secure remote access
  - Cloudflare Worker proxy
  - Automated backup/restore scripts

- **Testing**
  - 127 unit tests with 88% coverage on core modules
  - Integration tests for full request flow
  - Load tests (50/100/200 concurrent requests)
  - Production smoke tests
  - Security scan with 7 test categories

- **Documentation**
  - API versioning guide
  - Production topology documentation
  - Incident response playbooks
  - Operational runbooks

### Changed
- Rewrote LoadBalancer with connection pooling and node caching
- Optimized rate limiter with deque-based sliding window
- Reimplemented request queue with heapq for O(log N) priority insertion
- Added parallel health checks in gateway
- Pre-compiled regex patterns in intelligent router

### Security
- bcrypt hashing for API key storage
- SHA256 migration from plain keys
- Configurable CORS origins
- Request size limits
- Auth validation caching (5-min TTL)
- API key file permissions (0o600)
- Security scan integration in CI

### Performance
- Connection pooling (20 connection limit, 10 per host)
- Request caching with 15s TTL
- Auth validation cache (5-min TTL)
- Pre-compiled regex patterns
- O(1) rate limiter cleanup
- O(log N) priority queue operations

## [0.9.0] - 2024-12-01

### Added
- Initial cluster architecture
- Basic master-worker communication
- Simulated inference responses

### Changed
- N/A (initial release)

## [0.1.0] - 2024-11-01

### Added
- Project foundation
- Basic configuration system
- Logging infrastructure
