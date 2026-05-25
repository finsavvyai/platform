# Architecture

**Analysis Date:** 2026-05-23

## Pattern Overview

**Overall:** Multi-tier, polyglot system with hexagonal backend (Go) powering cross-platform frontends (React web, React Native mobile, Tauri desktop). MCP server bridges AI agents and QueryFlux API.

**Key Characteristics:**
- Backend layer isolation via Domain-Driven Design (hexagonal ports/adapters pattern)
- Frontend state management decoupled (Zustand for client state, React Query for server state)
- Plugin system for extensibility (VS Code, custom extensions)
- Unified API surface across web/desktop/mobile via Axios + REST endpoints
- Event-driven architecture with domain events in backend

## Layers

**Frontend (React Web - src/):**
- Purpose: Web UI for database management and AI-powered features
- Location: `src/`
- Contains: Components (57+ TSX files), hooks (40+ files), Zustand stores (3 core), API service layer, page containers
- Depends on: Axios client, React Router, React Query, Zustand, Radix UI, Tailwind CSS, Lucide React
- Used by: Users via browser, MCP server can interact programmatically

**Backend (Go - backend/):**
- Purpose: Core query execution, AI integration, database adapter factory, authentication, metrics
- Location: `backend/`
- Contains: HTTP handlers, domain entities, repositories, adapters (SQL, NoSQL, cache), AI service integration, middleware
- Depends on: Gin framework, pgx (PostgreSQL), database drivers, OpenAI API, Zap logger
- Used by: Frontend via REST API, CLI tools, scheduled jobs

**Desktop App (Tauri - queryflux-desktop/):**
- Purpose: Native desktop wrapper with OS integration
- Location: `queryflux-desktop/`
- Contains: Rust backend (src-tauri/), React frontend (src/), Tauri configuration
- Depends on: Tauri framework, Rust std library, same React components as web
- Used by: Desktop users on macOS/Windows/Linux

**Mobile App (React Native - mobile/):**
- Purpose: iOS/Android database management with native platform features
- Location: `mobile/`
- Contains: React Native source (src/), iOS/Android native modules
- Depends on: React Native, iOS SDK, Android SDK, shared logic from backend
- Used by: Mobile users on iOS/Android

**MCP Server (queryflux-mcp-server/):**
- Purpose: Model Context Protocol interface for Claude and other AI agents
- Location: `queryflux-mcp-server/`
- Contains: Tools (query execution, schema introspection), resources (docs), prompts (system instructions)
- Depends on: @modelcontextprotocol/sdk, fetch API, axios
- Used by: AI agents as extension protocol

**Extensions (extensions/):**
- Purpose: Pluggable features distributed separately or as marketplace items
- Location: `extensions/`
- Contains: VS Code extension, custom theme plugins, data masking pro, advanced analytics
- Depends on: Extension host APIs (VS Code, QueryFlux plugin protocol)
- Used by: Advanced/premium users wanting add-on functionality

## Data Flow

**Web Query Execution:**

1. User enters SQL in `src/pages/EnhancedQueryEditorPage.tsx`
2. Calls `useQueries` hook → dispatches via `queryStore.executeQuery()`
3. `src/services/query-api.ts` makes POST to `/api/v1/database/query`
4. `backend/cmd/server/main.go handleQuery()` parses request
5. Gets connection config, creates adapter via `adapters.NewFactory()`
6. `backend/internal/infrastructure/database/adapters/[sql|nosql|cache]/*_adapter.go` executes query
7. Results stream back via JSON response
8. Frontend receives in hook, updates `queryStore.setResults()`
9. `ResultsGrid.tsx` renders tabular data with sorting/filtering

**AI-Powered NL→SQL:**

1. User speaks/types in `src/components/VoiceAssistant.tsx` or `NLToSQL.tsx`
2. Calls `nlpAPI.convertNLToSQL(prompt, schema)`
3. `backend/cmd/server/main.go handleSmartQuery()` receives prompt
4. Introspects current connection schema via adapter
5. Calls `s.aiService.ConvertNLToSQL()` in `backend/internal/services/ai_service.go`
6. OpenAI API converts NL → SQL with schema context
7. Returns suggested SQL with confidence badge
8. User can preview, edit, or execute directly

**Metrics Collection & Monitoring:**

1. `backend/cmd/server/main.go recordQueryMetrics()` middleware captures latency
2. `QueryMetricsStore` accumulates p50/p95/p99 percentiles in memory
3. Frontend `useAlerts` hook polls `/api/v1/metrics/:connectionId/latest`
4. `src/components/monitoring/Dashboard.tsx` displays real-time charts
5. MCP server can expose metrics as resources for Claude context

**State Management:**

- **Client State** (Zustand stores): Connection list, query tabs, UI state, user preferences → `src/stores/connectionStore.ts`, `queryStore.ts`, `uiStore.ts`
- **Server State** (React Query): Query results, connection schema, metrics history → cached via `@tanstack/react-query`
- **Auth State** (Custom + authAPI): JWT tokens stored in localStorage, validated on each request

## Key Abstractions

**Database Adapter Factory:**
- Purpose: Polymorphic connection handling across 10+ database types
- Examples: `backend/internal/infrastructure/database/adapters/sql/postgres_adapter.go`, `mongodb_adapter.go`, `redis_adapter.go`
- Pattern: Each adapter implements common interface (Connect, ExecuteQuery, GetSchema, Disconnect)

**Query Store (Zustand):**
- Purpose: Central query execution state with undo/redo, tab management
- Examples: `src/stores/queryStore.ts`
- Pattern: Immer-powered mutations, persisted to localStorage for recovery

**API Service Layer:**
- Purpose: Type-safe Axios client with error handling and retry logic
- Examples: `src/services/api.ts`, `connection-api.ts`, `query-api.ts`, `nlp-api.ts`
- Pattern: Barrel export for clean imports, domain-grouped endpoints

**Domain Entities (Backend):**
- Purpose: Rich domain models with business rules
- Examples: `backend/internal/domain/entities/connection.go`, `query.go`, `alert.go`
- Pattern: Value objects for immutability, repository pattern for persistence

**Hooks for Business Logic (Frontend):**
- Purpose: Extract complex logic from components into reusable, testable hooks
- Examples: `src/hooks/useQueries.ts`, `useConnections.ts`, `useVoiceRecognition.ts`
- Pattern: Custom hooks return state + dispatch functions, manage side effects via useEffect

## Entry Points

**Web Frontend:**
- Location: `src/main.tsx`
- Triggers: Browser load
- Responsibilities: React DOM mount, initialize QueryClient, set up providers (React Query, Zustand hydration)

**Backend Server:**
- Location: `backend/cmd/server/main.go`
- Triggers: `npm run dev:backend` or containerized deployment
- Responsibilities: Load config from env vars, initialize database adapters, start Gin HTTP server on port 8080

**Desktop App:**
- Location: `queryflux-desktop/src/main.tsx` (React entry) + `queryflux-desktop/src-tauri/src/main.rs` (Rust entry)
- Triggers: App executable launch
- Responsibilities: Tauri window initialization, backend process spawn, IPC bridge setup

**Mobile App:**
- Location: `mobile/src/index.tsx` or `mobile/index.js` (platform-specific)
- Triggers: App icon tap (iOS/Android)
- Responsibilities: React Native entry, context providers, platform permission requests

**MCP Server:**
- Location: `queryflux-mcp-server/src/index.ts`
- Triggers: Claude or other MCP client initializes connection
- Responsibilities: Register tools, expose resources, handle tool invocations via stdio/HTTP

## Error Handling

**Strategy:** Typed Result pattern with explicit error propagation. No silent failures.

**Patterns:**
- Frontend: `try-catch` in API calls, dispatch error state to store, show toast notification to user
- Backend: Return `(result, error)` tuples, log with structured context, HTTP status codes map error severity
- Hooks: Throw errors up to nearest Error Boundary (`src/components/ErrorBoundary.tsx`) or handle with fallback UI
- Stores: Include `error` field in state, set via dispatch on API failure, clear on retry success
- API responses: Always check `response.success` boolean before using `response.data`

Example: `src/services/query-api.ts` wraps axios calls with error mapping:
```typescript
export const queryAPI = {
  execute: async (connectionId: string, sql: string) => {
    try {
      const res = await axios.post('/api/v1/database/query', { connectionId, sql });
      if (!res.data.success) throw new Error(res.data.error);
      return res.data.data;
    } catch (err) {
      throw new QueryExecutionError(err.message);
    }
  },
};
```

## Cross-Cutting Concerns

**Logging:**
- Frontend: `console.log/error` in development, silent in production (optional Sentry integration)
- Backend: Structured JSON logging via `zap` logger with trace/debug/info/warn/error levels
- MCP: Debug via stdio on invocation (visible in Claude logs)

**Validation:**
- Frontend: Input validation in form components using React Hook Form or manual logic
- Backend: Request binding validation via Gin middleware, domain entity validation in constructors
- Schema: TypeScript strict mode enforces type safety at compile time

**Authentication:**
- Frontend: JWT token in localStorage, attached to every request header via Axios interceptor
- Backend: JWT middleware validates token signature against `JWT_SECRET` env var
- Sessions: Stateless JWT, no server-side session store
- SSO: Optional OAuth2 integrations (GitHub, Google) via backend SSO adapters

**Rate Limiting:**
- Backend: Middleware-based rate limiting (token bucket) per user/IP in `backend/internal/infrastructure/rate_limiter/`
- Frontend: Client-side debouncing/throttling in hooks to reduce excessive requests
- MCP: No built-in rate limiting; clients responsible for respecting Anthropic usage limits

**Caching:**
- Frontend: React Query caches server state with configurable staleTime (default 5 minutes)
- Backend: Optional Redis cache for schema introspection, query plan caching (implemented in adapters)
- Query Results: Short-lived in memory, not persisted by default (user can save via query history)

**Metrics & Observability:**
- Backend: Prometheus metrics exposed at `/metrics` endpoint, percentile tracking in QueryMetricsStore
- Frontend: Optional error tracking via integration points (Sentry, PostHog)
- MCP: Structured logging of tool invocations for audit and debugging

**Security:**
- CORS: Allowlist checked against `ALLOWED_ORIGINS` env var in backend
- Parameterized Queries: All database adapters use bound parameters, not string interpolation
- Secrets: Environment variables only, no hardcoding; `.env` files in `.gitignore`
- Input Sanitization: Validator packages in services, regex patterns for safe SQL analysis

---

*Architecture analysis: 2026-05-23*
