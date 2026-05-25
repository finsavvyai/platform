# QueryFlux — CLAUDE.md

> **Portfolio Tracker**: `../../../portfolio-tracker.html` | **Readiness**: 40% | **Category**: SHIP

## Mission
Modern, AI-powered database management platform with React web UI, Tauri desktop, React Native mobile, and microservices backend supporting PostgreSQL, MySQL, MongoDB, Redis, SQLite.

## Code Map & Index

### Directory Structure
```
queryflux/
├── src/                            # React 19 + TypeScript (137 components)
│   ├── components/                 # UI components (Radix + Tailwind)
│   │   ├── dashboard/              # Main workspace
│   │   ├── query-editor/           # Multi-tab SQL editor
│   │   ├── connection-manager/     # Database connections
│   │   ├── ai-features/            # Voice, NL→SQL, API generator
│   │   ├── monitoring/             # Alerts, metrics, performance
│   │   ├── team/                   # Collaboration, RBAC
│   │   ├── extensions/             # Plugin marketplace
│   │   ├── settings/               # User preferences, themes
│   │   └── billing/                # Subscription management
│   ├── hooks/                      # React hooks (auth, queries, state)
│   ├── services/                   # API clients (axios)
│   ├── store/                      # Zustand state management
│   ├── types/                      # TypeScript interfaces
│   ├── utils/                      # Helpers (formatting, validation)
│   └── App.tsx                     # Root component
├── backend/                        # Go API server (60+ files)
│   ├── cmd/                        # Entry points (api, cli)
│   ├── internal/                   # Domain, service, adapter layers
│   ├── migrations/                 # Database schemas
│   └── tests/                      # Integration tests
├── queryflux-desktop/              # Tauri desktop app (Rust + React)
├── mobile/                         # React Native (iOS/Android)
│   ├── android/                    # Android native modules
│   ├── ios/                        # iOS native modules
│   └── src/                        # Shared React Native code
├── extensions/                     # Plugin system
│   ├── data-masking-pro/
│   ├── voice-commands/
│   ├── advanced-analytics/
│   ├── custom-themes/
│   ├── schema-diff/
│   └── query-optimizer/
├── e2e/                            # Playwright test suite
│   ├── flows/                      # User journey tests
│   ├── fixtures/                   # Test data
│   └── config/                     # Playwright config
├── docs/                           # Architecture, API docs
├── package.json                    # Workspace config, scripts
├── vite.config.ts                  # Frontend build config
├── playwright.config.ts            # E2E test config
├── docker-compose.yml              # Local dev environment
└── Makefile                        # Build targets
```

### Key Files Index
| File | Purpose | Lines |
|------|---------|-------|
| `src/components/query-editor/QueryEditor.tsx` | Multi-tab SQL editor, syntax highlighting | 280 |
| `src/components/ai-features/NLToSQL.tsx` | Natural language to SQL conversion UI | 150 |
| `src/components/monitoring/Dashboard.tsx` | Performance metrics, alerts visualization | 250 |
| `src/hooks/useDatabase.ts` | Query execution, connection management | 180 |
| `src/store/connectionStore.ts` | Zustand connection state management | 120 |
| `backend/cmd/api/main.go` | Server initialization, route setup | 100 |
| `backend/internal/service/query_service.go` | Query execution orchestration | 200 |
| `backend/internal/adapter/database/postgres.go` | PostgreSQL driver wrapper | 150 |
| `package.json` | Node.js workspace, build scripts | 116 |
| `vite.config.ts` | React build config, dev server | 50 |

## Development Guidelines

### Code Design Standards
- **Max 200 lines per file** — React: break components into custom hooks; Go: separate into service methods
- **Single Responsibility** — One component = one feature (QueryEditor, Toolbar, ResultsGrid)
- **Type Safety** — Strict TypeScript (`noImplicitAny`, `strictNullChecks`), Go with interfaces
- **Error Handling** — Never swallow errors; Result pattern: `Result<Data, Error>`
- **Naming** — camelCase (JS), snake_case (Go), descriptive (no abbreviations)
- **No Magic Values** — Constants in `src/constants/` or service config
- **Dependency Injection** — Services injected into components/hooks
- **Pure Functions First** — Side effects at component edges only (useEffect, events)

### Architecture Patterns

#### Frontend (React + TypeScript)
- **State Management**: Zustand for client state (connections, user preferences, UI state)
- **Server State**: React Query for API data caching, background sync
- **Components**: Functional with hooks, max 200 lines; split complex logic into custom hooks
- **Styling**: Tailwind CSS + CVA for component variants
- **Icons**: Lucide React (180+ icons)
- **API Client**: Axios + custom hooks for type-safe requests

#### Backend (Go - Hexagonal Architecture)
```
cmd/api/main.go
  ↓
internal/server/http.go (routes)
  ↓
internal/adapter/http/handler/query_handler.go (parse request)
  ↓
internal/service/query_service.go (business logic)
  ↓
internal/port/repository/query_repo.go (interface)
  ↓
internal/adapter/repository/postgres_repo.go (implementation)
```

- **Domain** (`internal/domain/`): Entities (Query, Connection, Alert) with business rules
- **Ports** (`internal/port/`): Interfaces (QueryRepository, ConnectionPool, AIClient)
- **Adapters** (`internal/adapter/`): Implementations (PostgreSQL, OpenAI, HTTP)
- **Services** (`internal/service/`): Use cases (ExecuteQuery, GenerateSQL, MaskPII)
- **Config** (`internal/config/`): Environment-driven, 12-factor app

#### UI Component Organization
```
components/
├── query-editor/
│   ├── QueryEditor.tsx       # Parent container
│   ├── SqlEditor.tsx         # Monaco editor wrapper
│   ├── ResultsGrid.tsx       # DataGrid with sorting/filtering
│   ├── QueryHistory.tsx      # Saved queries
│   └── useQueryEditor.ts     # Custom hook with business logic
├── ai-features/
│   ├── NLToSQL.tsx           # UI for NL input
│   ├── VoiceAssistant.tsx    # Microphone, transcript, response
│   ├── DataMasking.tsx       # PII detection, masking UI
│   └── ApiGenerator.tsx      # REST API scaffold preview
└── ...
```

### Code Review Checklist
- [ ] React component ≤ 200 lines (split custom hooks if complex)
- [ ] Go file ≤ 300 lines (break into service methods or separate packages)
- [ ] All public functions have JSDoc (React), godoc (Go)
- [ ] No `any` types in TypeScript; use strict mode
- [ ] Error handling: never silently fail, return typed Result
- [ ] No hardcoded API URLs, keys, or secrets (use .env)
- [ ] Follows naming: camelCase (JS/TS), snake_case (Go)
- [ ] CSS classes use Tailwind utilities + CVA for variants
- [ ] Database queries use parameterized statements (pgx v5)
- [ ] Tests included for business logic (>90% coverage)

## Testing Strategy

### Unit Tests — Full Coverage Required

#### Frontend (React + TypeScript)
- **Framework**: Vitest + React Testing Library
- **Coverage Target**: 95% lines, 90% branches
- **Run**: `npm run test:coverage`
- **Key Tests**:
  - `QueryEditor.test.tsx`: Tab creation, SQL highlighting, execute button
  - `NLToSQL.test.tsx`: Input validation, API call, confidence badge display
  - `VoiceAssistant.test.tsx`: Microphone permission, transcript display, voice playback
  - `useDatabase.ts`: Connection selection, query caching, error states
  - `connectionStore.ts`: Add/remove connections, persistence

#### Backend (Go)
- **Framework**: testify + httptest + testcontainers
- **Coverage Target**: 95% lines, 90% branches
- **Run**: `go test ./... -v -cover`
- **Key Tests**:
  - `query_service_test.go`: Execute valid/invalid SQL, result pagination, timeout
  - `postgres_adapter_test.go`: Connection pooling, query execution, error handling
  - `schema_introspect_test.go`: Table metadata, column types, indexes
  - `ai_client_test.go`: OpenAI API mock, timeout, fallback behavior
  - `middleware_test.go`: JWT validation, CORS, rate limiting

### Browser / Claude Chrome Extension Tests
- **Tool**: Playwright + Claude in Chrome MCP
- **Coverage**: Multiple personas (Free-tier, Pro, Admin, Enterprise, First-time)
- **Run**: `npm run test:e2e` or `npm run test:e2e:ui` (interactive)

#### Critical Browser Test Flows

**1. New User Onboarding (First-Time Visitor)**
```gherkin
Given: User lands on QueryFlux homepage
When: User clicks "Get Started"
Then: Sign-up form appears (email, password, name)
And: After signup, onboarding wizard shows (connect first DB, run first query)
And: Tutorial tooltips guide through UI
```

**2. Database Connection Setup (Free-Tier)**
```gherkin
Given: User on "Connect Database" screen
When: User selects "PostgreSQL" from dropdown
Then: Form shows host, port, user, password, database fields
And: "Test Connection" button validates credentials
And: Success message shows "Connected ✓ 12 tables found"
And: Connection saves to Supabase
```

**3. Multi-Tab Query Editor**
```gherkin
Given: User has 3 open query tabs (Users, Orders, Payments)
When: User executes query in Orders tab
Then: Results show 5,234 rows with execution time (245ms)
And: Export options available (CSV, JSON, SQL)
And: Other tabs remain open without re-executing
And: Query saves to history automatically
```

**4. Natural Language to SQL**
```gherkin
Given: User in NL→SQL panel
When: User types "Show top 10 customers by total spend this year"
And: Clicks "Generate SQL"
Then: Suggested SQL appears with [92% confidence] badge
And: User can preview results or edit SQL
And: QueryLens returns generation time
```

**5. Voice Assistant Command**
```gherkin
Given: User clicks microphone icon
When: Browser requests microphone permission (first time)
Then: Permission dialog appears ("Allow QueryFlux to use microphone?")
And: After grant, user speaks: "Run the users table query"
And: Transcript shows: "Run the users table query"
And: System finds matching query and executes
And: Results shown, voice responds: "Query complete, 1,234 results"
And: Response can be replayed via speaker icon
```

**6. Data Masking (PII Detection)**
```gherkin
Given: User uploads CSV file with 100 rows
When: User clicks "Scan for Sensitive Data"
Then: System detects: email (2 columns), ssn (1), credit_card (1)
And: Each detection shows mask type options (Hash, Encrypt, Redact, Partial, Tokenize)
And: User selects strategies and confirms
And: Masked CSV downloads with data protected
```

**7. Team Collaboration & Permissions**
```gherkin
Given: Admin invites developer@company.com with "Developer" role
When: Developer tries to delete production connection
Then: Error: "Insufficient permissions. Contact Admin."
And: Audit log shows: "Developer attempted delete at 2026-03-19 15:30:45 UTC"
And: Admin can see audit trail in Team → Activity Log
```

**8. Billing & Feature Gates**
```gherkin
Given: User on Free plan
When: User clicks "Enable Voice Assistant"
Then: Paywall modal: "Pro plan ($19/mo) required"
And: "Start 7-day Free Trial" or "Upgrade Now" buttons
And: Billing page redirects to Stripe
```

**9. Monitoring Dashboard**
```gherkin
Given: User on Monitoring screen
When: Page loads
Then: Shows real-time metrics: CPU (45%), Memory (62%), Active Connections (8)
And: Query Performance chart displays avg query time over 24h
And: Alert panel shows any triggered alerts (yellow/red)
And: User can drill-down to slow queries
```

**10. Mobile Responsiveness (Tablet/Phone)**
```gherkin
Given: User on iPhone 12 (375px)
When: User opens Query Editor
Then: Editor takes full width (no horizontal scroll)
And: Toolbar buttons stack responsively
And: Results table scrolls horizontally for wide data
And: Pinch-to-zoom works for results
```

## Commands

### Development
```bash
# Install dependencies
npm install

# Frontend dev server (Vite)
npm run dev:web

# Backend Go API
npm run dev:backend
# OR: cd backend && go run cmd/api/main.go

# Desktop app (Tauri)
npm run dev:desktop

# All services together
./start-all.sh
```

### Testing
```bash
# React unit tests
npm run test

# React with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# E2E Playwright tests
npm run test:e2e

# E2E with interactive UI
npm run test:e2e:ui

# Go tests (from backend/)
go test ./... -v -cover

# All tests
npm run test:all
```

### Building
```bash
# Production React build
npm run build:web

# Desktop app binary
npm run build:desktop

# Go binary
npm run build:backend

# Clean artifacts
npm run clean
```

### Docker
```bash
# Local dev (PostgreSQL, Redis, MongoDB)
docker-compose up

# Production build
docker build -f Dockerfile -t queryflux:latest .

# Run container
docker run -p 3000:3000 queryflux:latest
```

## What's Done vs What's Left

### Completed
- React 19 component library (137 components, Radix UI + Tailwind CSS)
- Zustand store for client state
- React Router for navigation
- Vite build configuration
- Playwright E2E test framework
- Docker Compose with PostgreSQL, Redis, MongoDB
- GitHub Actions CI/CD scaffold
- Supabase schema (20+ tables with RLS)
- Responsive design (mobile-first)

### In Progress
- Query execution engine (safe SQL runner, result streaming)
- Database drivers (pgx v5 for PostgreSQL, mysql2, MongoDB, Redis)
- Authentication & authorization (JWT, RLS enforcement)
- OpenAI/Gemini integration (prompt engineering, response caching)
- Voice feature (Web Speech API, text-to-speech)
- Team collaboration (invitation flow, activity audit)

### Critical Path to Production
1. **Phase 1 (Weeks 1-2)**: Real database drivers + query execution
2. **Phase 2 (Weeks 3-4)**: Authentication, user registration, password reset
3. **Phase 3 (Weeks 5-6)**: OpenAI integration, NL→SQL, Voice
4. **Phase 4 (Weeks 7-8)**: Team features, RBAC, audit logs
5. **Phase 5 (Weeks 9-10)**: Stripe billing, monitoring dashboard
6. **Phase 6 (Weeks 11-12)**: Performance optimization, documentation, deploy MVP

## Competitors & Market Context

### Direct Competitors
- **DBeaver Community**: Desktop, free, no AI
- **pgAdmin**: PostgreSQL-only
- **Adminer**: Single PHP file, minimal features
- **Data Studio**: Google's BI tool (reports, not admin)
- **Metabase**: Open source, BI-focused, no AI

### QueryFlux Advantages
- **AI-First**: Every feature uses AI (NL→SQL, voice, optimization, masking)
- **Multi-Database**: Single UI for PostgreSQL, MySQL, MongoDB, Redis, SQLite
- **Team Ready**: RBAC, audit trails, shared queries
- **Developer API**: REST API, SDKs, MCP for AI agents
- **Modern UX**: Responsive, dark mode, 12 languages, accessibility

### Market Positioning
- **Target**: Developers, DBAs, data analysts, enterprises
- **Price**: Free (SQLite), Pro $19/mo, Team $49/mo, Enterprise custom
- **Distribution**: Direct SaaS, self-hosted, Docker

---

**QueryFlux** — *Database management, reimagined with AI*
