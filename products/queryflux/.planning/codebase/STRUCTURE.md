# Codebase Structure

**Analysis Date:** 2026-05-23

## Directory Layout

```
queryflux-git/ (monorepo root)
├── src/                              # React 19 web frontend (TypeScript)
│   ├── components/                   # UI components (57+ TSX files, max 200 lines)
│   │   ├── ui/                       # Radix primitives (Button, Dialog, Input, etc.)
│   │   ├── layout/                   # Layout, Sidebar, TopBar
│   │   ├── queryflux/                # Domain-specific components (QueryEditor, ConnectionForm, etc.)
│   │   └── [Component].tsx           # Individual component files
│   ├── hooks/                        # React hooks (40+ files, business logic extraction)
│   │   ├── use[Feature].ts           # Custom hooks (useQueries, useConnections, useAuth, etc.)
│   │   └── [utils|types].ts          # Hook utilities and type definitions
│   ├── services/                     # API client layer (Axios, type-safe)
│   │   ├── api.ts                    # Barrel export for all API modules
│   │   ├── [domain]-api.ts           # Domain-grouped endpoints (connection-api.ts, query-api.ts)
│   │   └── [feature]-api.test.ts     # API integration tests
│   ├── stores/                       # Zustand state management (3 core stores)
│   │   ├── connectionStore.ts        # Connections list, active connection state
│   │   ├── queryStore.ts             # Query tabs, execution state, results, history
│   │   ├── uiStore.ts                # UI toggles, sidebar state, theme
│   │   └── [store].test.ts           # Store snapshot + action tests
│   ├── pages/                        # Page containers (routed via React Router)
│   │   ├── EnhancedDashboardPage.tsx # Main workspace/overview
│   │   ├── EnhancedQueryEditorPage.tsx # Multi-tab query editor
│   │   ├── ConnectionsPage.tsx       # Connection management UI
│   │   ├── SettingsPage.tsx          # User preferences, themes, billing
│   │   ├── LoginPage.tsx             # Authentication form
│   │   └── [Page].test.tsx           # Page-level integration tests
│   ├── types/                        # TypeScript interfaces and types
│   │   └── index.ts                  # Exported type definitions
│   ├── lib/                          # Utility libraries
│   │   ├── [feature]/                # Feature-specific utils (formatting, validation)
│   │   └── index.ts                  # Barrel export
│   ├── contexts/                     # React Context API (optional, minimal)
│   ├── providers/                    # Context/Provider wrapper components
│   ├── styles/                       # Global styles and design tokens
│   │   └── index.css                 # Tailwind imports, CSS variables
│   ├── translations/                 # i18n locale files (12 languages)
│   ├── contracts/                    # Shared type contracts with backend
│   ├── engine/                       # Query execution engine (SQL parsing, optimization)
│   ├── ai/                           # AI feature hooks and utilities
│   ├── api/                          # API request adapters and interceptors
│   ├── main.tsx                      # React root mount point
│   ├── App.tsx                       # Root component with routing setup
│   ├── index.css                     # Global styles
│   └── setupTests.ts                 # Vitest configuration
│
├── backend/                          # Go API server (hexagonal architecture)
│   ├── cmd/                          # Executable entry points
│   │   └── server/                   # Main API server
│   │       └── main.go               # Gin router setup, handler wiring
│   ├── internal/                     # All non-exported code
│   │   ├── domain/                   # Domain layer (business logic)
│   │   │   ├── entities/             # Value objects (Connection, Query, Alert, etc.)
│   │   │   ├── repositories/         # Repository interfaces (abstraction)
│   │   │   ├── events/               # Domain events (QueryExecuted, AlertTriggered, etc.)
│   │   │   └── sso/                  # OAuth2 domain models
│   │   ├── application/              # Application layer (use cases)
│   │   │   ├── services/             # Service classes (QueryService, ConnectionService, etc.)
│   │   │   ├── cqrs/                 # Command/Query segregation (optional)
│   │   │   ├── ports/                # Repository interfaces (contracts)
│   │   │   └── [feature]/            # Feature services (team/, monitoring/, connection/)
│   │   ├── infrastructure/           # Technical implementations
│   │   │   ├── database/             # Database layer (adapters for PostgreSQL, MySQL, MongoDB, Redis, etc.)
│   │   │   │   ├── adapters/         # Database driver implementations
│   │   │   │   │   ├── sql/          # postgres_adapter.go, mysql_adapter.go
│   │   │   │   │   ├── nosql/        # mongodb_adapter.go
│   │   │   │   │   ├── cache/        # redis_adapter.go
│   │   │   │   │   ├── timeseries/   # influxdb_adapter.go, prometheus_adapter.go
│   │   │   │   │   ├── search/       # elasticsearch_adapter.go
│   │   │   │   │   └── base/         # Common interface, base adapter
│   │   │   │   └── migrations/       # SQL migration files (Go-migrate)
│   │   │   ├── repositories/         # Data access layer (PostgreSQL implementation)
│   │   │   │   └── postgres/         # Tables for connections, queries, audit logs
│   │   │   ├── ai/                   # AI service adapters (OpenAI, Gemini, etc.)
│   │   │   │   └── templates/        # Prompt templates for NL→SQL, code gen
│   │   │   ├── cache/                # Cache adapters (Redis, in-memory)
│   │   │   ├── logger/               # Structured logging (Zap, Logrus)
│   │   │   ├── metrics/              # Prometheus metrics and monitoring
│   │   │   ├── middleware/           # HTTP middleware (JWT, CORS, logging)
│   │   │   ├── security/             # Auth, encryption, rate limiting
│   │   │   ├── health/               # Health check adapters
│   │   │   ├── sso/                  # OAuth2 provider implementations
│   │   │   ├── lemonsqueezy/         # Billing service adapter
│   │   │   ├── events/               # Event bus implementations
│   │   │   └── rate_limiter/         # Token bucket rate limiting
│   │   ├── api/                      # HTTP API layer
│   │   │   ├── handlers/             # Request handlers (organized by domain)
│   │   │   └── middleware/           # Route middleware
│   │   ├── adapters/                 # Deprecated or alternate structure
│   │   ├── services/                 # Deprecated; use application/services
│   │   ├── middleware/               # Route-level middleware
│   │   ├── server/                   # Server setup, route registration
│   │   ├── config/                   # Configuration loading from env vars
│   │   ├── container/                # Dependency injection (wire-like setup)
│   │   ├── shared/                   # Shared models, helpers, utilities
│   │   └── testing/                  # Test utilities, mocks, fixtures
│   ├── tests/                        # Integration tests (TestContainers)
│   ├── migrations/                   # Database schema SQL files
│   ├── go.mod, go.sum                # Go dependencies
│   ├── config.yaml, config.*.yaml    # Configuration files (dev, test, prod)
│   └── Makefile                      # Build targets (make run, make test, make build)
│
├── queryflux-desktop/                # Tauri desktop app
│   ├── src/                          # React frontend (identical to web src/)
│   ├── src-tauri/                    # Rust backend (Tauri commands, OS integration)
│   │   ├── src/main.rs               # Window setup, menu, IPC handlers
│   │   ├── Cargo.toml                # Rust dependencies
│   │   └── [src/lib.rs]              # Tauri command implementations
│   ├── vite.config.ts                # Vite build config for desktop
│   └── tauri.conf.json               # Tauri app configuration
│
├── mobile/                           # React Native iOS/Android app
│   ├── src/                          # Shared React Native code (TypeScript)
│   │   ├── screens/                  # Screen containers (QueryEditor, Connections, etc.)
│   │   ├── components/               # React Native components
│   │   ├── services/                 # API client (shared with web)
│   │   ├── hooks/                    # Custom hooks (shared with web where applicable)
│   │   ├── contexts/                 # React Context (auth, theme)
│   │   └── App.tsx                   # React Native entry point
│   ├── ios/                          # iOS native code (Swift, Objective-C)
│   │   └── QueryFlux.xcodeproj       # Xcode project
│   ├── android/                      # Android native code (Kotlin, Java)
│   │   └── app/                      # Main Android app module
│   ├── package.json                  # React Native dependencies
│   └── [eas.json|app.json]           # EAS/Expo configuration
│
├── queryflux-mcp-server/             # MCP protocol server for Claude
│   ├── src/                          # TypeScript source
│   │   ├── index.ts                  # Server initialization
│   │   ├── client.ts                 # Anthropic client setup
│   │   ├── tools/                    # Tool definitions (query, schema, etc.)
│   │   ├── resources/                # Resource definitions (documentation, templates)
│   │   └── prompts/                  # System prompt templates
│   ├── package.json                  # Dependencies (@modelcontextprotocol/sdk, axios)
│   └── dist/                         # Compiled output (Node.js)
│
├── extensions/                       # Plugin ecosystem
│   ├── vscode/                       # VS Code extension
│   │   ├── src/                      # Extension source
│   │   ├── package.json              # VS Code extension manifest
│   │   └── vsce (dist)               # Packaged extension
│   └── [custom-themes/|data-masking-pro/|etc]  # Future plugins
│
├── e2e/                              # Playwright end-to-end tests
│   ├── flows/                        # User journey test suites
│   ├── fixtures/                     # Test data and login fixtures
│   └── playwright.config.ts          # Playwright configuration
│
├── docs/                             # Documentation
│   ├── README.md                     # Project overview
│   ├── strategy/                     # Product strategy docs
│   │   ├── QUERYFLUX_ROADMAP.md
│   │   └── VIBECODING_PRODUCT_VISION.md
│   └── technical/                    # Technical reference docs
│       └── SHARED_PRODUCT_CONTRACT.md
│
├── scripts/                          # Utility scripts
│   └── ci-verify-paths-and-secrets.sh # CI validation
│
├── public/                           # Static assets (served by Vite)
│   └── [favicon.ico|manifest.json]
│
├── supabase/                         # Supabase config (backend DB)
│   ├── migrations/                   # SQL schema migrations
│   └── functions/                    # Edge functions
│
├── package.json                      # Workspace root config, scripts
├── package-lock.json                 # Dependency lock file
├── vite.config.ts                    # Web app build configuration
├── playwright.config.ts              # E2E test configuration
├── tsconfig.json                     # Shared TypeScript config
├── eslint.config.js                  # ESLint rules for web + server
├── CLAUDE.md                         # Project rules and architecture guidelines
├── AGENTS.md                         # AI agent context and memory
├── README.md                         # Monorepo overview
└── docker-compose.yml                # Local dev environment (PostgreSQL, Redis, MongoDB)
```

## Directory Purposes

**src/ (Web Frontend):**
- Purpose: React 19 web application entry point
- Contains: 57+ TSX component files, 40+ hook files, Zustand stores, API clients, page containers
- Key files: `main.tsx` (React mount), `App.tsx` (root router), `components/`, `hooks/`, `services/`

**backend/ (Go API):**
- Purpose: Core server with database adapters, query execution, AI integration
- Contains: Gin HTTP server, hexagonal architecture (domain/application/infrastructure), database drivers for 10+ types
- Key files: `cmd/server/main.go` (entry point), `internal/infrastructure/database/adapters/` (drivers)

**queryflux-desktop/ (Tauri App):**
- Purpose: Native macOS/Windows/Linux desktop wrapper
- Contains: React frontend + Rust backend for OS integration (file dialogs, menu, IPC)
- Key files: `src-tauri/src/main.rs` (window setup), `src/` (React, same as web)

**mobile/ (React Native):**
- Purpose: iOS/Android native mobile apps
- Contains: Shared React Native code, platform-specific native modules (Swift/Kotlin)
- Key files: `src/App.tsx` (entry), `ios/`, `android/` (native projects)

**queryflux-mcp-server/ (MCP Protocol):**
- Purpose: Model Context Protocol server for Claude AI integration
- Contains: Tool definitions (query, schema introspection), resource exports, prompt templates
- Key files: `src/index.ts` (server setup), `src/tools/` (tool implementations)

**extensions/ (Plugins):**
- Purpose: Extensibility via VS Code extension and custom plugin system
- Contains: VS Code extension source, theme plugins, data masking utilities
- Key files: `vscode/package.json` (extension manifest), `vscode/src/` (extension code)

**e2e/ (End-to-End Tests):**
- Purpose: Playwright test suite covering critical user journeys
- Contains: Test flows (onboarding, query execution, voice commands), test fixtures (auth, database state)
- Key files: `playwright.config.ts`, `flows/[feature].spec.ts`

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM render point for web app
- `src/App.tsx`: Root component with React Router configuration
- `backend/cmd/server/main.go`: HTTP server startup, route registration
- `queryflux-desktop/src-tauri/src/main.rs`: Tauri window initialization
- `mobile/src/App.tsx`: React Native entry point
- `queryflux-mcp-server/src/index.ts`: MCP server initialization

**Configuration:**
- `package.json`: Workspace scripts, monorepo metadata
- `vite.config.ts`: Web build configuration
- `backend/config.yaml`: Server config template
- `.env.example`: Environment variables template
- `tsconfig.json`: TypeScript compiler options

**Core Logic:**
- `src/hooks/useQueries.ts`: Query execution orchestration
- `src/hooks/useConnections.ts`: Connection lifecycle management
- `src/stores/queryStore.ts`: Query state, tabs, results, history
- `src/stores/connectionStore.ts`: Active connections, connection list
- `backend/internal/infrastructure/database/adapters/`: Database driver implementations (postgres_adapter.go, mongodb_adapter.go, redis_adapter.go, etc.)
- `backend/internal/application/services/`: Business logic (query service, connection service, AI service)

**Testing:**
- `src/**/*.test.tsx`: Component and hook unit tests (Vitest + React Testing Library)
- `e2e/flows/**: Playwright end-to-end test suites
- `backend/tests/`: Integration tests (TestContainers)

## Naming Conventions

**Files:**
- Components: PascalCase.tsx (e.g., `QueryEditor.tsx`, `ConnectionForm.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useQueries.ts`, `useConnections.ts`)
- Services: camelCase with `-api` suffix (e.g., `query-api.ts`, `connection-api.ts`)
- Stores: camelCase with `Store` suffix (e.g., `queryStore.ts`, `connectionStore.ts`)
- Types: camelCase, exported from `types/index.ts` or co-located with usage
- Tests: Same name as subject with `.test.ts` or `.spec.ts` suffix
- Go files: `snake_case.go` (e.g., `postgres_adapter.go`, `query_service.go`)
- Go packages: lowercase, no underscores (e.g., `adapters`, `repositories`, `handlers`)

**Directories:**
- Feature directories: kebab-case or PascalCase for components (e.g., `query-editor/`, `ai-features/`, `connection-manager/`)
- Package directories: lowercase (e.g., `services/`, `adapters/`, `handlers/`)
- Layer directories: lowercase per hexagonal pattern (e.g., `domain/`, `application/`, `infrastructure/`)

## Where to Add New Code

**New Feature (e.g., "Add Export to CSV"):**
- Primary component: `src/components/queryflux/[FeatureName].tsx` (max 200 lines; split into sub-components if needed)
- Custom hook (business logic): `src/hooks/use[FeatureName].ts`
- API client: Add method to `src/services/query-api.ts` (or create new `export-api.ts` if large)
- Store updates: Add action to `src/stores/queryStore.ts` if state is shared; otherwise use local component state
- Backend endpoint: Add handler in `backend/internal/api/handlers/[feature]_handler.go` + route in `backend/cmd/server/main.go`
- Tests: `src/components/queryflux/[FeatureName].test.tsx` + `backend/internal/api/handlers/[feature]_handler_test.go`

**New Component (Reusable UI):**
- If primitive (button variant, input wrapper): `src/components/ui/[Component].tsx`
- If domain-specific (connection picker, query tabs): `src/components/queryflux/[Component].tsx`
- Always split large components:
  - Parent container in main file (state, API calls)
  - View/presentation in separate file (no logic, just rendering)
  - Custom hook if logic is reusable
- Add to Storybook or component library if shared across apps

**New Backend Service:**
- Domain entity: `backend/internal/domain/entities/[entity].go`
- Repository interface: `backend/internal/domain/repositories/[entity]_repository.go`
- Repository implementation: `backend/internal/infrastructure/repositories/postgres/[entity]_repository.go`
- Service layer: `backend/internal/application/services/[feature]/[service].go`
- HTTP handler: `backend/internal/api/handlers/[feature]_handler.go`
- Register route: `backend/cmd/server/main.go` in handler setup section

**New Database Adapter (e.g., "Add DuckDB support"):**
- Create adapter file: `backend/internal/infrastructure/database/adapters/sql/duckdb_adapter.go`
- Implement interface: Must satisfy `adapters.DatabaseAdapter` (Connect, ExecuteQuery, GetSchema, Disconnect, HealthCheck)
- Register in factory: `backend/internal/infrastructure/database/adapters/factory.go` AddAdapter method
- Add tests: `backend/internal/infrastructure/database/adapters/sql/duckdb_adapter_test.go`
- Update config: Add to supported types in `backend/internal/config/`

**Utilities:**
- Shared helpers: `src/lib/[feature]/` (e.g., `src/lib/formatting/`, `src/lib/validation/`)
- Re-export in `src/lib/index.ts` for barrel import
- Backend utilities: `backend/internal/shared/` (e.g., `shared/models/`, `shared/helpers/`)

**Hooks Library:**
- Auth/user: `src/hooks/useAuth.ts`
- Data fetching: `src/hooks/use[Entity]s.ts` (useQueries, useConnections)
- UI state: `src/hooks/use[Feature].ts` (useVoiceRecognition, useAlerts)
- Keep to <150 lines; split complex logic into utility functions in same file

**Store Updates:**
- Client state (connections, tabs, UI): Use Zustand store (`src/stores/`)
- Server state (results, schema, metrics): Use React Query in hook
- Never duplicate state between store and local component state; choose one per concern

## Special Directories

**src/contracts/:**
- Purpose: Shared TypeScript interfaces between frontend and backend (documentation of API contract)
- Generated: No (manually maintained)
- Committed: Yes

**backend/internal/testing/:**
- Purpose: Test utilities, mocks, fixtures for integration tests
- Generated: No
- Committed: Yes

**backend/migrations/:**
- Purpose: SQL schema migration files (Go-migrate format)
- Generated: Yes (auto-created by migration tool)
- Committed: Yes

**e2e/fixtures/:**
- Purpose: Playwright test data (auth tokens, database snapshots)
- Generated: Partially (some generated by test setup)
- Committed: Some (login fixture template, not sensitive data)

**dist/, build/, .next/:**
- Purpose: Build artifacts
- Generated: Yes
- Committed: No (in .gitignore)

**node_modules/, vendor/:**
- Purpose: External dependencies
- Generated: Yes (by package manager)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-05-23*
