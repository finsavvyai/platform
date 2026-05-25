# QueryFlux Backend — CLAUDE.md

> **Portfolio Tracker**: `../../../portfolio-tracker.html` | **Readiness**: 30% | **Category**: BUILD

## Mission
Go backend API for QueryFlux using Hexagonal (Clean) Architecture. Provides safe SQL execution, schema introspection, and AI integrations for PostgreSQL, MySQL, MongoDB, Redis, SQLite.

## Code Map & Index

### Directory Structure
```
queryflux-backend/
├── cmd/                            # Entry points
│   ├── api/                        # HTTP server (main.go)
│   └── cli/                        # CLI tool
├── internal/                       # Private packages (Hexagonal Architecture)
│   ├── domain/                     # Domain entities & business logic
│   │   ├── connection.go           # Database connection entity
│   │   ├── query.go                # SQL query entity
│   │   ├── schema.go               # Table/column metadata
│   │   ├── alert.go                # Alert rules
│   │   └── project.go              # Workspace/project
│   ├── port/                       # Interfaces (contracts for adapters)
│   │   ├── repository/             # Data persistence ports
│   │   │   ├── connection_repo.go  # Store connections
│   │   │   ├── query_repo.go       # Store queries
│   │   │   └── alert_repo.go       # Store alerts
│   │   ├── database/               # External DB access
│   │   │   ├── executor.go         # Execute queries
│   │   │   ├── introspector.go     # Get schema info
│   │   │   └── pool.go             # Connection pooling
│   │   └── ai_client.go            # AI service interface
│   ├── adapter/                    # Implementations (concrete adapters)
│   │   ├── http/                   # HTTP handlers & routes
│   │   │   ├── handler/            # Request handlers
│   │   │   │   ├── query_handler.go     # POST /api/v1/query/execute
│   │   │   │   ├── schema_handler.go    # GET /api/v1/schema
│   │   │   │   ├── connection_handler.go
│   │   │   │   └── alert_handler.go
│   │   │   ├── middleware/         # Auth, CORS, logging
│   │   │   └── request.go          # Request/response types
│   │   ├── database/               # Database drivers
│   │   │   ├── postgres.go         # PostgreSQL via pgx v5
│   │   │   ├── mysql.go            # MySQL via mysql2/go
│   │   │   ├── mongodb.go          # MongoDB driver
│   │   │   ├── redis.go            # Redis client
│   │   │   └── sqlite.go           # SQLite (better-sqlite3)
│   │   ├── repository/             # Database persistence
│   │   │   ├── connection_repo.go  # Store connections in PostgreSQL
│   │   │   └── query_repo.go       # Store queries
│   │   └── ai/                     # AI integrations
│   │       ├── openai.go           # OpenAI client
│   │       ├── gemini.go           # Google Gemini
│   │       └── local.go            # Local LLM fallback
│   ├── service/                    # Use cases (business logic orchestration)
│   │   ├── query_service.go        # ExecuteQuery, ValidateSQL
│   │   ├── schema_service.go       # GetSchema, Introspection
│   │   ├── connection_service.go   # CreateConnection, TestConnection
│   │   ├── ai_service.go           # NL→SQL, DataMasking
│   │   └── alert_service.go        # Alert evaluation
│   ├── config/                     # Configuration
│   │   ├── config.go               # Struct definition
│   │   ├── env.go                  # Load from environment
│   │   └── database.go             # DB pool config
│   ├── server/                     # HTTP server setup
│   │   ├── http.go                 # Server initialization
│   │   ├── routes.go               # Route definitions
│   │   └── response.go             # Common response types
│   ├── middleware/                 # HTTP middleware
│   │   ├── auth.go                 # JWT validation
│   │   ├── cors.go                 # CORS headers
│   │   ├── logging.go              # Structured logging (Pino)
│   │   ├── rate_limit.go           # Rate limiting
│   │   └── recovery.go             # Panic recovery
│   ├── shared/                     # Shared utilities
│   │   ├── errors.go               # Error types & handling
│   │   ├── logger.go               # Logging setup
│   │   ├── validation.go           # Input validation
│   │   └── types.go                # Common types
│   └── testing/                    # Test helpers
│       ├── fixtures.go             # Test data
│       ├── mock_db.go              # Mock database
│       └── testhelper.go           # Setup/teardown
├── migrations/                     # SQL migrations
│   ├── 001_initial_schema.sql      # Tables, indexes
│   ├── 002_add_alerts.sql
│   └── 003_add_audit_log.sql
├── pkg/                            # Public utilities (can be imported)
│   ├── logger/                     # Pino logging
│   └── config/                     # Configuration helpers
├── tests/                          # Integration tests
│   ├── query_service_test.go       # End-to-end query tests
│   ├── schema_service_test.go      # Schema introspection tests
│   ├── connection_test.go          # Connection pooling tests
│   └── integration_test.go         # Full flow tests
├── go.mod                          # Dependencies (v1.25.0)
├── go.sum                          # Dependency hashes
├── Dockerfile                      # Container image
├── Makefile                        # Build targets
└── README.md                       # Documentation
```

### Key Files Index
| File | Purpose | Language | Lines |
|------|---------|----------|-------|
| `cmd/api/main.go` | Server bootstrap, port 8080 | Go | 80 |
| `internal/service/query_service.go` | Execute, validate, cache queries | Go | 200 |
| `internal/adapter/database/postgres.go` | pgx v5 wrapper, connection pool | Go | 150 |
| `internal/adapter/http/handler/query_handler.go` | POST /api/v1/query/execute | Go | 120 |
| `internal/domain/query.go` | Query entity, validation logic | Go | 80 |
| `internal/port/database/executor.go` | Interface for query execution | Go | 40 |
| `go.mod` | Go 1.25.0, dependencies | Go | 50 |
| `migrations/001_initial_schema.sql` | Tables, RLS policies | SQL | 150 |

## Development Guidelines

### Code Design Standards
- **Max 300 lines per file** — Break complex logic into separate service methods
- **Single Responsibility** — One domain entity = one file, one port interface = one file
- **Type Safety** — Strict Go (no untyped generics), all errors must be handled
- **Error Handling** — Explicit Result pattern: `(data, error)` returns; context for all errors
- **Naming** — snake_case for variables/functions, PascalCase for public, camelCase for private
- **No Magic Values** — All constants in `config.go` or domain entities
- **Dependency Injection** — Constructor injection for all services and adapters
- **Clean Architecture** — Adapters depend on ports, ports have no dependencies

### Architecture Patterns

#### Request-to-Response Flow
```go
// HTTP Handler → Service → Adapter
1. handler.HandleQueryExecute(w, r)
   - Validate request schema
   - Extract user ID from JWT (middleware)
   - Call service.ExecuteQuery(ctx, query)

2. service.ExecuteQuery(ctx, query)
   - Validate SQL syntax
   - Check user permissions (RLS)
   - Call adapter.Execute(ctx, query)

3. adapter.Execute(ctx, query)
   - Get pooled connection
   - Execute via pgx (prepared statement)
   - Stream results (pagination)

4. Response to client
   - JSON: {data, columns, execution_time}
```

#### Error Handling Pattern
```go
// Define domain errors
type QueryError struct {
    Code    string // "SYNTAX_ERROR", "TIMEOUT", "PERMISSION_DENIED"
    Message string
    Details interface{}
}

// Service returns errors
result, err := service.ExecuteQuery(ctx, query)
if err != nil {
    return &QueryError{
        Code: "EXECUTION_FAILED",
        Message: err.Error(),
    }
}

// Handler converts to HTTP response
if err != nil {
    return http.Error(w, err.Code, http.StatusBadRequest)
}
```

#### Database Adapter Pattern
```go
type PostgresExecutor struct {
    pool *pgx.Pool
}

// Implements port.Executor interface
func (p *PostgresExecutor) Execute(ctx context.Context, query string) (*Result, error) {
    rows, err := p.pool.Query(ctx, query) // Parameterized
    // Handle result pagination, streaming
}
```

### Code Review Checklist
- [ ] No file exceeds 300 lines (split service methods if needed)
- [ ] All public functions have godoc comments
- [ ] All errors handled explicitly (no `_ = err`)
- [ ] No untyped parameters or returns (avoid `interface{}`)
- [ ] Database queries use parameterized statements (pgx prepared)
- [ ] Follows naming: snake_case (Go), PascalCase (public), camelCase (private)
- [ ] Errors wrapped with context: `fmt.Errorf("operation failed: %w", err)`
- [ ] No hardcoded secrets, URLs, or environment variables
- [ ] Tests included for service logic (>90% coverage)
- [ ] Migrations are reversible (up/down SQL pairs)

## Testing Strategy

### Unit Tests — Full Coverage Required

#### Services
- **Framework**: testify + httptest
- **Coverage Target**: 95% lines, 90% branches
- **Run**: `go test ./... -v -cover`

**Key Tests**:
- `query_service_test.go`:
  - ✅ Valid SQL execution returns results
  - ✅ Invalid SQL returns SYNTAX_ERROR
  - ✅ Long query timeout after 30s
  - ✅ Results paginated (1000 rows per page)
  - ✅ Dry-run shows query without executing

- `schema_service_test.go`:
  - ✅ Introspect PostgreSQL tables, columns, types
  - ✅ Get indexes and constraints
  - ✅ Handle schema-less databases (MongoDB)

- `connection_service_test.go`:
  - ✅ Test PostgreSQL connection (valid credentials)
  - ✅ Reject invalid host/port
  - ✅ Connection pool reuses connections
  - ✅ Idle connections closed after 5 min

- `ai_service_test.go`:
  - ✅ NL→SQL calls QueryLens API
  - ✅ Confidence score in response (0-1)
  - ✅ Timeout after 5s
  - ✅ Fallback to echo if API fails

#### Adapters
- `postgres_test.go`:
  - ✅ pgx.Pool created with correct config
  - ✅ Parameterized queries prevent SQL injection
  - ✅ Connection ping succeeds
  - ✅ Results streamed for large datasets

- `openai_test.go`:
  - ✅ API request includes schema context
  - ✅ Retry on rate limit (429)
  - ✅ Timeout after 5s
  - ✅ Response parsing (sql, confidence)

### Integration Tests
- **Setup**: Docker Compose (PostgreSQL, MySQL, MongoDB)
- **Run**: `go test -tags integration ./tests/...`

**Critical Flows**:
1. **Create Connection**: UI → Handler → Service → Pool → Test → Supabase store
2. **Execute Query**: Editor → Handler → Service → Executor → Results → Frontend
3. **NL→SQL**: User input → MCP tool → QueryLens API → Execute → Results
4. **Schema Introspect**: Handler → Service → Executor → Metadata → Response

## Commands

### Development
```bash
# Install dependencies
go mod download

# Run server (port 8080)
go run cmd/api/main.go

# Watch mode with hot reload
go install github.com/cosmtrek/air@latest
air

# Run specific handler
make run-handler
```

### Testing
```bash
# Unit tests with coverage
go test ./... -v -cover

# Coverage report
go test ./... -coverprofile=cover.out
go tool cover -html=cover.out

# Integration tests (requires docker-compose up)
go test -tags integration ./tests/... -v

# Watch tests
go install github.com/cosmtrek/air@latest
# Configure .air.toml then: air
```

### Building
```bash
# Build binary
go build -o bin/queryflux cmd/api/main.go

# Build with version
go build -ldflags="-X main.Version=v1.0.0" -o bin/queryflux cmd/api/main.go

# Docker image
docker build -t queryflux-backend:latest .
```

### Database
```bash
# Run migrations
go run cmd/api/main.go migrate up

# Create new migration
migrate create -ext sql -dir migrations -seq add_feature

# Rollback
go run cmd/api/main.go migrate down
```

## What's Done vs What's Left

### Completed
- Hexagonal architecture structure
- Domain entities (Query, Connection, Alert)
- Port interfaces defined
- HTTP server scaffold (Gin)
- Middleware (CORS, logging, recovery)
- Database migration system
- Configuration management

### In Progress
- PostgreSQL adapter (pgx v5)
- Query executor (safe SQL runner, timeout, pagination)
- Schema introspector
- Connection pooling
- Error handling across layers

### Critical Path to MVP
1. **Week 1**: PostgreSQL adapter + query executor + result pagination
2. **Week 2**: Schema introspection + connection pooling
3. **Week 3**: Error handling + timeout + dry-run mode
4. **Week 4**: API handlers + request validation
5. **Week 5**: Integration tests + Docker setup
6. **Week 6**: OpenAI fallback + logging + monitoring

## Competitors & Market Context

### Similar Projects
- **PostgREST**: Auto REST from PostgreSQL (no AI, single DB)
- **Hasura**: GraphQL from databases (more complex, slower iteration)
- **PrismaOrm**: Database ORM + migrations (language-specific)

### QueryFlux Backend Advantages
- **Multi-Database**: Single interface for 5+ DB types
- **Safe Execution**: Dry-run, timeout, parameterized queries
- **AI-Ready**: Built for LLM integration (QueryLens, OpenAI, Gemini)
- **Clean Architecture**: Extensible, testable, maintainable
- **Performance**: Connection pooling, result streaming, caching

---

**QueryFlux Backend** — *Safe, scalable database API*
