# External Integrations

**Analysis Date:** 2026-05-23

## APIs & External Services

**AI Providers:**
- OpenAI - SQL generation, query optimization, data masking
  - SDK: go-openai v1.41.2 (backend)
  - Env var: None explicitly required (configure via OpenAI API key in secrets)
  - Usage: Natural language to SQL conversion, query explanation, optimization suggestions

- Gemini (Google) - Optional alternative to OpenAI
  - SDK: Google Cloud SDK (Cloud AI services)
  - Used for: NL→SQL fallback, content generation

**AI Orchestration:**
- OpenHands - AI service orchestration and code generation
  - Endpoint: OPENHANDS_URL environment variable (e.g., http://localhost:8787)
  - Env var: OPENHANDS_API_KEY (optional, if required)
  - Backend integration: `backend/cmd/server/main.go` line 60, used in AIService initialization
  - Purpose: Orchestrate AI-powered code generation, migrations, test data

- Claw Gateway - Cost tracking and observability for AI calls
  - Env vars: CLAW_API_KEY, CLAW_PROJECT_ID
  - Purpose: Route AI calls through gateway for cost tracking and monitoring

- QueryLens - NLP service for question-to-SQL
  - Endpoint: VITE_NLP_API_URL (frontend), defaults to same backend if empty
  - SDK: axios (direct HTTP, no official SDK)
  - Client: `src/services/nlp-api.ts`
  - Usage: `/api/v1/nlp/query` (POST for SQL generation), `/api/v1/nlp/health` (GET)
  - Type-safe: `src/types/api.ts` - NlpQueryRequest, NlpQueryResponse

## Data Storage

**Databases:**

**PostgreSQL:**
- Driver: pgx/v5 v5.7.6 (Go, primary database driver)
- Alternative: pg v8.16.3 (Node.js)
- Connection: DATABASE_URL environment variable
- Pool: `backend/internal/infrastructure/database/postgres_pool.go`
- Features: Parameterized queries, connection pooling, prepared statements
- Config: pg_stat_statements extension, optimized postgresql.conf in `docker/postgres/postgresql.conf`

**MongoDB:**
- Driver: mongodb v7.0.0 (Node.js), mongo-driver v1.17.4 (Go)
- Connection: MONGODB_URL environment variable (e.g., mongodb://localhost:27017/queryflux)
- Usage: Alternative database adapter for non-relational queries

**MySQL:**
- Driver: mysql2 v3.15.3 (Node.js), go-sql-driver/mysql v1.9.3 (Go)
- Connection: Configured through connection manager UI
- Features: Connection pooling, parameterized queries

**Redis:**
- Client: redis v5.10.0 (Node.js), redis/go-redis/v9 v9.3.0 (Go)
- Connection: REDIS_URL environment variable (e.g., redis://localhost:6379)
- Purpose: Session caching, query result caching, rate limiting
- Config: `docker/redis/redis.conf` for optimization

**SQLite:**
- Driver: better-sqlite3 v12.6.2 (Node.js), mattn/go-sqlite3 v1.14.32 (Go)
- Purpose: Embedded database for desktop app, local development

**Additional Databases Supported:**
- ClickHouse v2.40.3 - Data warehouse analytics
- Snowflake v1.17.0 - Cloud data warehouse
- Neo4j v5.28.3 - Graph database
- BigQuery - Google Cloud data warehouse (SDK: cloud.google.com/go/bigquery)
- ArangoDB v1.6.5 - Multi-model database
- Cassandra/CQL (gocql v1.7.0) - Time-series database
- InfluxDB (influxdata/influxdb-client-go/v2 v2.14.0) - Time-series database
- Oracle (godror v0.49.3) - Enterprise database
- AWS Athena (aws/aws-sdk-go-v2/service/athena) - SQL on S3
- DynamoDB (aws/aws-sdk-go-v2/service/dynamodb) - NoSQL
- TimeStream (aws/aws-sdk-go-v2/service/timestreamquery, timestreamwrite) - IoT time-series

**File Storage:**
- AWS S3 (aws/aws-sdk-go-v2/service/s3) - Cloud storage integration
- Local filesystem only (default for development)

**Caching:**
- Redis (primary)
- Memcache (bradfitz/gomemcache)
- In-memory (React Query on client)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `src/services/auth-api.ts`
  - Secret: JWT_SECRET environment variable (required, 32+ chars in production)
  - Token storage: localStorage (key: `auth_token`)
  - Request interceptor: Auto-injects token as `Authorization: Bearer {token}` in `src/lib/api-client.ts`

**SSO (Single Sign-On):**
- File: `backend/internal/server/handlers_sso.go`
- Implementation: SAML, OIDC support
  - SAML: crewjam/saml v0.5.1
  - OIDC: coreos/go-oidc/v3 v3.16.0
- Purpose: Enterprise authentication, team sign-up

**Authorization:**
- RBAC (Role-Based Access Control) implemented via Workspace/Member contracts
- Roles: owner, admin, builder, viewer
- Permissions system: Schema in `src/contracts/vibecoding.ts` (AgentPermissionSchema)
  - Granular permissions: schema:read, query:generate, query:execute:readonly, migration:propose, etc.

## Monitoring & Observability

**Metrics:**
- Prometheus 1.23.2 (Go: prometheus/client_golang) - Metrics collection
- Grafana (official image: grafana/grafana:latest) - Visualization
  - Port: 3001 (configured in docker-compose.yml)
  - Admin password: Environment variable GF_SECURITY_ADMIN_PASSWORD
  - Provisioning: `backend/monitoring/grafana/provisioning/`

**Logs:**
- Pino 10.3.1 (Node.js) - JSON structured logging
- Zap v1.27.0 (Go) - Structured logging
- Logrus v1.9.3 (Go) - General purpose logging
- Lumberjack v2.2.1 (Go) - Log rotation
- Level control: LOG_LEVEL env var (debug/info/warn/error)

**Error Tracking:**
- Sentry (optional, via VITE_SENTRY_DSN)
- Structured error responses with code, message, details

**Audit Logging:**
- `backend/internal/infrastructure/security/` - Security event tracking
- Audit trails for: auth events, admin actions, sensitive data mutations
- Mock: `backend/internal/infrastructure/mocks/mock_audit_logger.go`

## CI/CD & Deployment

**Hosting:**
- Docker containerization (Dockerfile for frontend, backend separate)
- Docker Compose (local dev with PostgreSQL, Redis, Prometheus, Grafana)
- Cloudflare Workers/Pages (optional, for edge deployment)
- GitHub Actions (pipeline scaffolding present in repo)

**CI Pipeline:**
- Test runner: Vitest (unit), Jest (server), Playwright (E2E)
- Coverage reporting: vitest coverage, Jest coverage
- Linting: ESLint
- Build: Vite (frontend), Go compiler (backend)

**Deployment Targets:**
- Development: Docker Compose locally
- Staging: Docker containers on cloud (AWS, GCP, Azure)
- Production: Kubernetes-ready Docker images with health checks

## Environment Configuration

**Required env vars:**
- JWT_SECRET - Authentication secret (must be 32+ characters)
- DATABASE_URL - PostgreSQL connection
- REDIS_URL - Redis connection
- ENVIRONMENT - Deployment stage (development/staging/production)

**Optional but Recommended:**
- OPENHANDS_URL - AI orchestration service
- LOG_LEVEL - Logging verbosity
- VITE_API_URL - Frontend API endpoint (defaults to same-origin)
- VITE_NLP_API_URL - NLP service endpoint

**Optional (Advanced Features):**
- CLAW_API_KEY, CLAW_PROJECT_ID - Cost tracking for AI calls
- VITE_SENTRY_DSN - Error tracking
- VITE_GOOGLE_ANALYTICS_ID - Analytics
- GF_SECURITY_ADMIN_PASSWORD - Grafana admin password

**Secrets location:**
- Development: `.env.development` (git-ignored)
- Production: Environment variables injected via cloud platform or CI/CD secrets management

## Webhooks & Callbacks

**Incoming Webhooks:**
- Stripe webhooks (payment events) - Not yet implemented, planned in Phase 5
- Database event hooks (PostgreSQL NOTIFY/LISTEN) - Used for real-time features

**Outgoing Webhooks:**
- User-defined query result webhooks (extension system)
- Team collaboration notifications (activity events)
- AI generation completion callbacks (websocket-based)

## Billing & Payments

**Stripe Integration (Planned):**
- Phase 5 (Production roadmap)
- Plans: Free (SQLite), Pro ($19/mo), Team ($49/mo), Enterprise (custom)
- Implementation planned in `backend/internal/infrastructure/lemonsqueezy/` (LemonSqueezy as alternative)

**LemonSqueezy Support:**
- Directory: `backend/internal/infrastructure/lemonsqueezy/`
- Alternative to Stripe for European compliance
- Features: Subscription management, license key generation

## MCP Server Integration

**QueryFlux MCP Server:**
- Location: `queryflux-mcp-server/` directory (separate package)
- Language: TypeScript
- SDK: @modelcontextprotocol/sdk 1.29.0
- Purpose: Enable AI agents (Claude, Cursor) to query databases via natural language
- HTTP Client: axios 1.16.1
- Entry: `src/index.ts` - Stdio transport for MCP protocol
- Tools exposed:
  - `execute_query` - Run SQL safely with dry-run mode
  - `get_schema` - Database introspection
  - `natural_language_query` - NL→SQL conversion
  - `create_migration` - Generate reversible migrations
  - `seed_test_data` - AI-powered test data generation
  - `explain_query` - Query plan analysis and optimization
- Client types: Claude Desktop, Cursor, other MCP-compatible editors
- Config: `queryflux-mcp-server/examples/claude-desktop-config.json`

## Data Contracts & API Schemas

**Shared Product Contract:**
- File: `src/contracts/vibecoding.ts`
- Runtime validation: Zod schemas
- Types exported: 
  - ClientSurface (web, desktop, mobile, mcp)
  - Environment (local, development, staging, production)
  - OperationRisk (safe, review, dangerous)
  - AgentPermission (7 granular permissions)
  - Workspace, WorkspaceMember, DatabaseConnectionRef
  - SchemaTable, SchemaColumn, SchemaSnapshot
  - QueryIntent, QueryExecutionRequest, QueryExecutionMode
  - GeneratedArtifact, GeneratedArtifactType
  - AgentProfile, AgentPermission
- Test coverage: `src/contracts/vibecoding.test.ts`

**API Service Modules:**
- `src/services/api.ts` - Barrel export for all API modules
- `src/services/connection-api.ts` - Database connection CRUD
- `src/services/query-api.ts` - Query execution and history
- `src/services/auth-api.ts` - Authentication, health, server metrics
- `src/services/nlp-api.ts` - NLP service integration (QueryLens)
- `src/services/enhanced-api-services.ts` - Extended service operations
- `src/services/api-services-monitoring.ts` - Monitoring API calls
- Type definitions: `src/services/api-services-types.ts`

## Third-Party SDKs & Tools

**Web UI:**
- Radix UI - Accessible component primitives
- Lucide React - Icon system
- Framer Motion - Animation

**Server-side:**
- Gin (Go) - HTTP routing and middleware
- Express (Node.js) - Alternative HTTP framework
- Better SQLite3 - Synchronous SQLite wrapper

**Utilities:**
- Go version management: go.mod with go 1.24.0 toolchain
- UUID generation: google/uuid (Go), uuid npm package
- Configuration: viper (Go), environment variables (both)
- Validation: zod (TypeScript), validation middleware (Go)

---

*Integration audit: 2026-05-23*
