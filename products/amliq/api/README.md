# AMLIQ — AML Intelligence Platform

A complete, production-grade Anti-Money Laundering (AML) screening platform built in Go with high domain modeling, sophisticated matching algorithms, and comprehensive audit capabilities.

## Architecture

### Domain Layer (`internal/domain/`)
Rich value objects with validation:
- **Entity Models**: EntityID, TenantID, Name, Identifier, Entity
- **Screening Models**: ScreenRequest, ScreenResponse, MatchResult, MatchEvidence
- **Alert Management**: Alert, AlertStatus, AlertPriority
- **Audit Trail**: AuditEntry, AuditAction with immutable hash chain
- **Configuration**: TenantScreeningConfig, TenantConfig
- **Lists**: ListSource, ListMetadata
- **Value Objects**: Confidence, Disposition, MatchLayer

### Screening Engine (`internal/screening/`)
Cascade matching architecture with multiple algorithms:

**Active in production (registered by default in `cmd/api`):**
- **Exact Matcher**: Unicode normalization, case folding, whitespace normalization
- **Fuzzy Matcher**: Jaro-Winkler algorithm for similarity
- **Phonetic Matcher**: Soundex algorithm for name matching
- **Token Matcher**: Jaccard similarity for token-based matching

**Code-complete, gated behind feature flags (`isLayerEnabled`), pending production wiring:**
- **Embedding Matcher** (`PgvectorMatcher`): Cosine similarity for vector embeddings. Constructor exists; not yet registered via `WithEmbeddingMatcher(...)` in `cmd/api/main.go`. Roadmap: turn on per-tenant via `TenantConfig.EnableEmbedding` once the load test on pgvector at production cardinality is signed off.
- **Graph Matcher** (`GraphMatcher.MatchEntities`): Relationship traversal across known entity links. Needs a Postgres-backed `RelationshipFinder` implementation before being registered via `WithGraphMatcher(...)`. Roadmap: shell-company / UBO chain detection.

**Always-on supporting components:**
- **Scorer**: Weighted aggregation of evidence
- **Explainer**: Human-readable match explanations

### Ingestion Layer (`internal/ingestion/`)
25+ sanctions lists with generic parser framework:
- OFAC SDN, EU FSF, UN Consolidated, UK OFSI, Swiss SECO
- DFAT (Australia), Canada OSFI, Japan MOF, MAS (Singapore), HKMA
- France Tresor, Interpol Red Notices, World Bank Debarment, FBI Most Wanted
- 14+ additional lists via OpenSanctions aggregator
- PEP data from OpenSanctions with tier classification (Tier 1-4)
- Adverse media: GDELT, NewsAPI, Google News RSS
- Enforcement actions: SEC EDGAR, FCA Register

Features:
- Generic CSV/XML parser framework — new list in <50 lines of config
- Parser Registry pattern for extensibility
- List Fetcher with HTTP retry and ETag support
- Delta Engine for computing list changes (add/remove/modify)

### API Layer (`api/`)
RESTful HTTP API with comprehensive handlers:
- **Screening**: Single entity and batch screening
- **Alerts**: List, retrieve, resolve alerts
- **Configuration**: Get/update tenant screening config
- **Audit**: Immutable audit trail access
- **Lists**: Manage sanctions lists and marketplace
- **Analytics**: Dashboard and metrics endpoints
- **Health**: Health checks and readiness probes
- **PEP**: Politically Exposed Persons screening
- **Media**: Adverse media entity lookup
- **Enforcement**: Regulatory enforcement action search
- **Monitoring**: Continuous entity monitoring with webhooks
- **Cases**: Case management with SLA, four-eyes review, bulk disposition
- **Billing**: Seats, subscriptions, free-tier fallback, health check
- **Reports**: SAR/STR generation (FinCEN, UK NCA, goAML)
- **Fast Screen**: Sub-10ms payment screening + SWIFT MT103 parsing

Middleware:
- JWT/API Key Authentication
- Rate Limiting (per-client token bucket)
- Auth Rate Limiting with IP lockout
- Session Management (JWT rotation, concurrent limits)
- Security Audit Logging (SOC 2)
- Tenant Context Isolation
- CORS
- Request Logging (PII-safe)

### Storage Layer (`internal/storage/`)
Repository pattern with in-memory and PostgreSQL backends:
- EntityRepository, ScreeningRepository, AlertRepository
- AuditRepository (immutable hash chain)
- TenantRepository (multi-tenancy isolation)
- PEPRepository, MonitorRepository, CaseRepository
- SeatRepository, RelationshipRepository, ReportRepository

### Additional Packages
- `internal/crypto/` — AES-256-GCM field encryption for PII at rest
- `internal/notification/` — Webhook (retry), Email (Resend), Slack
- `internal/reports/` — SAR/STR XML generators (FinCEN, UK NCA, goAML)
- `internal/integration/` — SWIFT MT103 parser, Stripe Connect screening

### Configuration (`internal/config/`)
Environment-driven configuration:
```
PORT=8080
HOST=0.0.0.0
DATABASE_URL=postgres://localhost/aegis
REDIS_URL=redis://localhost:6379
TOKEN_SECRET=your-secret
TOKEN_EXPIRY=3600
EMBEDDING_API_KEY=sk-...
EMBEDDING_API_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

## Project Structure

```
aegis-v2/
├── cmd/
│   ├── api/main.go                 # API server entrypoint
│   └── worker/main.go              # Background worker entrypoint
├── api/                            # HTTP handlers & middleware
│   ├── handler_*.go               # Request handlers
│   ├── middleware_*.go            # Middleware
│   ├── request.go                 # Request parsing
│   ├── response.go                # Response formatting
│   ├── router.go                  # Route setup
│   └── server.go                  # HTTP server wrapper
├── internal/
│   ├── domain/                    # Rich domain models
│   ├── screening/                 # Matching engine
│   ├── ingestion/                 # List ingestion
│   ├── storage/                   # Data persistence
│   ├── config/                    # Configuration
│   └── platform/                  # Platform abstraction
├── pkg/
│   ├── errors/                    # Error types
│   ├── hash/                      # Hashing utilities
│   └── logger/                    # Logging interface
├── migrations/                     # SQL migrations
├── go.mod                         # Module definition
└── README.md                      # This file
```

## Building

### Prerequisites
- Go 1.22+
- PostgreSQL 12+ (for production)
- Redis 6+ (optional, for caching)

### Build Commands

```bash
# Build API server
go build -o bin/aegis-api ./cmd/api

# Build background worker
go build -o bin/aegis-worker ./cmd/worker

# Run tests
go test ./...

# Run specific test package
go test -v ./internal/screening/...

# Run with coverage
go test -cover ./...
```

## Running

### Development

```bash
# Run API server
PORT=8080 go run ./cmd/api/main.go

# Run worker
go run ./cmd/worker/main.go
```

### Docker

```bash
docker build -t aegis .
docker run -p 8080:8080 aegis
```

## API Endpoints

### Health
- `GET /health` - Health status
- `GET /ready` - Readiness check

### Screening
- `POST /screen` - Screen single entity
- `GET /screenings/{id}` - Get screening result
- `POST /batch` - Screen multiple entities (async)
- `GET /batch/{id}` - Get batch status

### Alerts
- `GET /alerts` - List alerts (filtered by status, priority)
- `GET /alerts/{id}` - Get alert details
- `PUT /alerts/{id}/resolve` - Resolve alert with justification

### Configuration
- `GET /config/{tenant_id}` - Get tenant config
- `PUT /config/{tenant_id}` - Update tenant config

### Audit
- `GET /audit` - List audit trail (filtered by resource)
- `GET /audit/{id}` - Get specific audit entry

### Lists
- `GET /lists` - List sanctions lists
- `GET /lists/{id}` - Get list metadata
- `POST /lists/{id}/sync` - Trigger list sync

### PEP Screening
- `POST /pep/screen` - Screen entity against PEP database
- `GET /pep` - List PEPs by country

### Adverse Media
- `GET /media/entity/{id}` - Get adverse media hits for entity

### Enforcement Actions
- `GET /enforcement/search?q=name` - Search enforcement database

### Monitoring
- `POST /monitors` - Register entity for continuous monitoring
- `GET /monitors` - List monitored entities
- `DELETE /monitors/{id}` - Stop monitoring

### Cases
- `GET /cases` - List compliance cases
- `GET /cases/{id}` - Get case detail
- `PUT /cases/{id}/review` - Four-eyes review submission
- `POST /cases/bulk-resolve` - Bulk resolve cases

### Billing
- `GET /billing/products` - List plans
- `GET /billing/health` - Billing system status
- `POST /billing/seats` - Add team seat
- `GET /billing/seats` - List seats
- `DELETE /billing/seats/{id}` - Remove seat

### Fast Payment Screening
- `POST /screen/fast` - Sub-10ms 2-layer screening for payment flows

### Reports
- `POST /reports/generate` - Generate SAR/STR report
- `GET /reports` - List generated reports

### Analytics
- `GET /analytics/dashboard` - Dashboard summary
- `GET /analytics/metrics` - Detailed metrics

## Authentication

Two authentication methods supported:

**Bearer Token**
```
Authorization: Bearer <token>
```

**API Key**
```
X-API-Key: <api_key>
```

## Request Examples

### Screen Entity
```bash
curl -X POST http://localhost:8080/screen \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "entity_name": "John Smith",
    "entity_type": "Individual",
    "transaction_id": "txn_123"
  }'
```

### Get Alerts
```bash
curl http://localhost:8080/alerts?status=Pending&priority=High \
  -H "X-API-Key: your-api-key"
```

### Resolve Alert
```bash
curl -X PUT http://localhost:8080/alerts/alr_123/resolve \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "justification": "False positive - verified identity"
  }'
```

## Testing

### Unit Tests
Every package has comprehensive table-driven tests:

```bash
go test -v ./internal/screening/
go test -v ./internal/domain/
go test -v ./api/
```

### Test Coverage
```bash
go test -cover ./... | grep coverage
```

### Example Test Pattern
```go
func TestSomething(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        expected string
    }{
        {"case1", "input1", "expected1"},
        {"case2", "input2", "expected2"},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Something(tt.input)
            if got != tt.expected {
                t.Errorf("got %v, want %v", got, tt.expected)
            }
        })
    }
}
```

## Code Quality Rules

Every file follows strict guidelines:
- **Max 100 lines per file** (including blanks, comments)
- **Every .go file has _test.go** with table-driven tests
- **No testify** - only stdlib testing package
- **Small interfaces** - 1-3 methods max
- **Value objects validate on construction** - NewXxx() → (Xxx, error)
- **No primitive obsession** - rich types (EntityID, TenantID, etc.)
- **Package names meaningful** - never "utils" or "helpers"

## Performance Considerations

- **Cascade matching**: Short-circuits when confidence exceeds threshold
- **Weighted scoring**: Configurable layer weights for business rules
- **Batch screening**: Async processing with batch status tracking
- **Rate limiting**: Per-client token bucket to prevent abuse
- **In-memory caching**: Optional Redis for frequently accessed entities
- **Index optimization**: Database indexes on common queries

## Extensibility

### Adding a New Matcher
```go
type CustomMatcher struct{}

func NewCustomMatcher() *CustomMatcher {
    return &CustomMatcher{}
}

func (cm *CustomMatcher) Match(
    query domain.Name,
    candidates []domain.Name,
) []domain.MatchEvidence {
    // Implementation
}
```

### Adding a New List Parser
```go
type MyListParser struct{}

func NewMyListParser() *MyListParser {
    return &MyListParser{}
}

func (mlp *MyListParser) Parse(data []byte) ([]domain.Entity, error) {
    // Implementation
}

// Register in registry
registry.Register(domain.ListSourceCustom, NewMyListParser())
```

## Error Handling

Rich error types with HTTP status mapping:

```go
// Create error
err := errors.New(errors.ErrInvalidInput, "entity_name required")
err.WithDetails("field 'entity_name' cannot be empty")
err.WithStatus(http.StatusBadRequest)

// In handlers
if err != nil {
    Error(w, err.Code.String(), err.Message, err.HTTPStatus)
}
```

## License

Proprietary - AMLIQ AML Screening Platform

## Support

For issues, questions, or contributions, contact the development team.
# push-ci.dev
# push-ci.dev
