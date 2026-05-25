# PipeWarden Architecture

## System Overview

PipeWarden is a modular Go application with an embedded web dashboard. All components are designed for minimal external dependencies.

```
┌──────────────────────────────────────────────────────────────┐
│                    HTTP API Layer (Router)                   │
│         (FastAPI-style with middleware: Auth, CORS, Logging) │
└──────────────┬───────────────────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    v          v          v
┌────────┐ ┌──────────┐ ┌─────────────┐
│Handler │ │Middleware│ │  Service    │
│ Layer  │ │  Layer   │ │   Layer     │
└────────┘ └──────────┘ └─────────────┘
    │          │          │
    └──────────┼──────────┘
               │
    ┌──────────┴──────────────────┐
    │                             │
    v                             v
┌─────────────────────┐   ┌──────────────────┐
│ Integration Manager │   │  Analysis Engine │
│                     │   │                  │
├ GitHub Provider    │   ├ Heuristic Rules  │
├ GitLab Provider    │   ├ Claude AI        │
├ Bitbucket Provider │   ├ Report Generator │
└─────────────────────┘   └──────────────────┘
    │                             │
    └──────────────┬──────────────┘
                   │
            ┌──────v──────┐
            │   Storage   │
            │   (SQLite)  │
            └─────────────┘
```

## Core Modules

### 1. HTTP API Layer (`internal/handlers/`)

REST endpoints with automatic request validation.

**File Structure (≤200 lines each):**
- `analysis_handler.go` - POST /api/v1/analyze
- `connection_handler.go` - CRUD operations for provider connections
- `result_handler.go` - GET analysis results
- `export_handler.go` - SARIF export
- `trends_handler.go` - Analytics endpoints

**Authentication:**
- JWT validation on all protected endpoints
- Token generation via `/api/v1/auth/login` (credentials in config)
- Token refresh with `/api/v1/auth/refresh`

### 2. Middleware Layer (`internal/middleware/`)

Cross-cutting concerns applied to all routes.

**Components:**
- `auth_middleware.go` - JWT validation (Bearer token)
- `cors_middleware.go` - CORS policy enforcement
- `logging_middleware.go` - Request/response logging with request ID
- `rate_limit_middleware.go` - Per-IP rate limiting (1000 req/5min)
- `error_middleware.go` - Consistent error response formatting

### 3. Integration Manager (`internal/integrations/`)

Unified interface for multiple CI/CD providers.

**Provider Interface:**
```go
type Provider interface {
    Authenticate() error
    ListRepositories() ([]Repository, error)
    FetchRuns(owner, repo string, limit int) ([]PipelineRun, error)
    GetRunDetails(runID string) (*PipelineRun, error)
    GetStepLogs(runID, stepID string) (string, error)
}
```

**Providers (each ≤200 lines):**
- `github/github.go` - GitHub Actions API client
- `gitlab/gitlab.go` - GitLab CI API client
- `bitbucket/bitbucket.go` - Bitbucket Pipelines client

**Manager (`manager.go`):**
- Connection lifecycle management
- Connection pooling and reuse
- Automatic retry on transient failures
- Rate limit tracking per provider

### 4. Analysis Engine (`internal/analysis/`)

Two-stage pipeline: heuristic → Claude AI.

**Stage 1: Heuristic Analysis** (`heuristic.go`)

5 scanning categories, each ≤50 lines:

1. **Branch Security**: Direct pushes to main/master/release branches
2. **Run Status**: Failed/timed-out pipelines, skipped runs
3. **Step Security**: Failed security-scan, SAST, linting steps
4. **Timing Anomalies**: Steps <1s or >30m (suggests skip/stub)
5. **Missing Checks**: SAST, linting, testing, dependency scanning

**Stage 2: Claude AI** (`claude.go`)

- Semantic analysis of pipeline YAML/config
- Context-aware remediation suggestions
- Risk prediction (ML-based)
- Anomaly detection via embedding similarity
- Token usage tracking for billing

**Reporter** (`reporter.go`)

- Generates Finding objects from heuristic + AI results
- Assigns severity levels (critical/high/medium/low/info)
- Enriches with CWE mappings and remediation
- Creates SARIF reports

### 5. Storage Layer (`internal/storage/`)

SQLite database with schema versioning.

**Schema:**
```sql
-- Connections
CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    credentials BLOB NOT NULL, -- Encrypted
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analysis Results
CREATE TABLE results (
    id TEXT PRIMARY KEY,
    connection_id TEXT REFERENCES connections(id),
    repository TEXT NOT NULL,
    branch TEXT NOT NULL,
    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    findings_json TEXT NOT NULL,
    tokens_used INT DEFAULT 0
);

-- Audit Log
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    resource TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Operations:**
- Connection CRUD (encrypted credential storage)
- Result persistence with JSON findings
- Audit logging for compliance
- Automatic cleanup of old results (>90 days)

### 6. Configuration (`internal/config/`)

Environment-based configuration with validation.

**Config Structure:**
```go
type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Auth     AuthConfig
    Analysis AnalysisConfig
    Vault    VaultConfig
    Billing  BillingConfig
    Features FeatureConfig
}
```

## Data Flow

### Analysis Request Flow

```
1. POST /api/v1/analyze
   ↓
2. AuthMiddleware validates JWT
   ↓
3. RequestValidator checks {connection_id, owner, repo}
   ↓
4. AnalysisService.Queue(ctx, req)
   ├─ Query Connection from storage
   ├─ Get Provider from manager
   └─ Schedule goroutine for async processing
   ↓
5. Return {result_id, status: "queued"}
   ↓
6. Background goroutine processes:
   ├─ Provider.FetchRuns(owner, repo, limit=100)
   ├─ HeuristicAnalyzer.AnalyzeRun(run)
   ├─ (Optional) ClaudeAnalyzer.AnalyzeRun(run, context)
   ├─ Reporter.GenerateFindings(heuristic_result, claude_result)
   ├─ Storage.SaveResult(findings)
   └─ AuditLogger.LogEvent("analysis_completed")
   ↓
7. GET /api/v1/results/{result_id} retrieves completed result
```

### Provider Connection Flow

```
1. POST /api/v1/connections
   ↓
2. Validate platform + credentials
   ↓
3. Call Provider.Authenticate() (test connection)
   ↓
4. If OK: Encrypt + store in SQLite
   ↓
5. Add to IntegrationManager's connection pool
   ↓
6. Return {connection_id}
```

## Security Architecture

### Credential Management

- **Storage**: SQLite with AES-256 encryption at rest
- **Transmission**: HTTPS only (TLS 1.3+)
- **Rotation**: Support for credential refresh via API
- **Audit**: Every credential access logged

### Authentication & Authorization

- **JWT**: HS256 signed tokens with 24h expiry
- **Claims**: User ID, roles, scopes
- **Refresh**: POST /api/v1/auth/refresh for new token
- **Admin**: Role-based access control (RBAC)

### Input Validation

All API inputs validated via Pydantic-like schemas:

```go
type AnalyzeRequest struct {
    ConnectionID string `json:"connection_id" validate:"required,uuid"`
    Owner        string `json:"owner" validate:"required,min=1,max=255"`
    Repo         string `json:"repo" validate:"required,min=1,max=255"`
}
```

### Rate Limiting

- Per-IP: 1000 requests per 5 minutes
- Per-token: 10,000 analyses per day (Pro tier)
- Per-provider: Respects official API rate limits

### Audit Logging

Every operation logged with:
- Timestamp
- Actor (user/token ID)
- Event type (analysis_started, connection_added, etc.)
- Resource (connection_id, result_id)
- Status (success/failure)

## Performance Optimizations

### Caching

- **In-Memory**: Connection metadata, recent results (1000 entries)
- **SQLite**: Indexed queries on (connection_id, analyzed_at)
- **TTL**: 1 hour for provider API responses

### Concurrency

- **Goroutines**: Async analysis processing
- **Channels**: Work queue for background jobs
- **Semaphore**: Max 10 concurrent analyses

### Database

- **Indexes**: connection_id, analyzed_at, severity
- **Partitioning**: Results by month (>1M records)
- **Vacuum**: Weekly cleanup of deleted data

## Testing Strategy

### Unit Tests (≥95% coverage)

- Scanner logic: 5 test functions per category
- Provider mocks: Each provider tested independently
- API handlers: Request/response validation
- Storage: CRUD operations and schema

### Integration Tests

- Real provider connections (optional, requires credentials)
- End-to-end analysis workflow
- Database transactions

### E2E Tests

- Full request → analysis → export flow
- SARIF output validation
- Dashboard rendering

**Test Execution:**
```bash
# Unit tests
go test -v ./internal/... -short

# Integration tests
go test -v ./internal/... -run Integration

# Coverage
go test -v ./... -cover -coverprofile=coverage.out
go tool cover -html=coverage.out
```

## Deployment Considerations

### Single Machine

- SQLite database ✓
- Embedded web server ✓
- Simple environment file ✓

### Docker

- Multi-stage build (golang:1.24 → alpine)
- SQLite volume mount for persistence
- Health check endpoint

### Kubernetes

- StatefulSet for persistence (SQLite → PVC)
- ConfigMap for non-sensitive config
- Secret-backed runtime configuration for `CLAUDE_API_KEY`, `PIPEWARDEN_VAULT_KEY`, GitHub App credentials, and billing webhooks
- HPA if scaling to multiple replicas (requires distributed locking)

### Scalability Limits

- **Single Machine**: ~100 analyses/day
- **Docker Compose**: ~1000 analyses/day (add Redis for caching)
- **Kubernetes HA**: Unlimited (with database federation)

## Future Enhancements

1. **PostgreSQL Support**: Replace SQLite for multi-replica deployments
2. **Plugin System**: Custom scanner extensions
3. **GraphQL API**: Alternative to REST
4. **Webhooks**: Event subscriptions
5. **RBAC**: Fine-grained permissions
6. **Distributed Tracing**: OpenTelemetry integration
