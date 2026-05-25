# Technology Stack

**Analysis Date:** 2026-05-23

## Languages

**Primary:**
- TypeScript 5.3+ - Web frontend (React components, services, hooks, types)
- Go 1.24.0 - Backend API server, database adapters, AI service orchestration
- JavaScript (ES modules) - Build scripts, configuration files

**Secondary:**
- Rust - Tauri desktop application framework
- Kotlin/Swift - React Native mobile (iOS/Android native modules)

## Runtime

**Environment:**
- Node.js 18.0.0+ (web, server, TypeScript compilation)
- Go 1.24.0 (backend services)
- Tauri 1.x (desktop runtime - Rust/WebView)

**Package Manager:**
- npm (with workspaces for monorepo) - used in `package.json`
- Go modules (go.mod/go.sum) - backend dependency management
- Lockfile: `package-lock.json` present, `go.sum` present

## Frameworks

**Core:**
- React 19.0.3 - Web UI framework, 137 components (functional components with hooks)
- Gin 1.9.1 - Go HTTP router and middleware framework
- Express 5.1.0 - Node.js server (TypeScript API layer, used in `server/`)
- Tauri 1.x - Desktop app framework (React frontend + Rust backend)
- React Native - Mobile app framework (iOS/Android)

**UI & Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- Radix UI - Unstyled, accessible component library
  - `@radix-ui/react-dialog` 1.1.15
  - `@radix-ui/react-dropdown-menu` 2.1.16
  - `@radix-ui/react-select` 2.2.6
  - `@radix-ui/react-toast` 1.2.15
- CVA (class-variance-authority) 0.7.1 - Component variant management
- Lucide React 0.560.0 - Icon library (180+ icons)

**State Management:**
- Zustand 5.0.9 - Client state management (connections, preferences, UI state)
- React Query (@tanstack/react-query) 5.90.12 - Server state, data caching, background sync
- React Router DOM 7.15.1 - Client-side routing

**Testing:**
- Vitest 3.2.1 - Unit test runner (TypeScript, configuration: `vitest.config.ts`)
- Jest 30.3.0 - Jest runner (Go mocks, used for some test suites)
- Playwright 1.57.0 - E2E browser automation (`playwright.config.ts`)
- React Testing Library 16.3.0 - Component testing
- Supertest 7.2.2 - HTTP assertion library (Express/API testing)
- Testify - Go assertion library (`stretchr/testify v1.11.1`)

**Build/Dev:**
- Vite 7.2.7 - Frontend build tool, dev server (config: `vite.config.ts`, port 5198)
  - `@vitejs/plugin-react` 5.1.2 - React JSX transformation
- TypeScript 5.3.0 - Transpilation and type checking (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`)
- ESLint 9.39.3 - JavaScript/TypeScript linting (config: `eslint.config.js`)
- PostCSS 8.5.6 - CSS processing (config: `postcss.config.cjs`)
- Autoprefixer 10.4.23 - CSS vendor prefixes

## Key Dependencies

**Critical:**
- axios 1.16.1 - HTTP client for both frontend and MCP server API calls
- pg (node-postgres) 8.16.3 - PostgreSQL driver (Node.js)
- mongodb 7.0.0 - MongoDB native driver
- redis 5.10.0 - Redis client
- mysql2 3.15.3 - MySQL driver
- better-sqlite3 12.6.2 - SQLite driver
- go-openai v1.41.2 (Go) - OpenAI API client
- pgx/v5 v5.7.6 (Go) - PostgreSQL driver with prepared statements

**Infrastructure:**
- pino 10.3.1 - JSON logger
- pino-http 11.0.0 - HTTP request/response logger
- zap v1.27.0 (Go) - Structured logging
- logrus v1.9.3 (Go) - Logging library
- Prometheus client_golang v1.23.2 (Go) - Metrics collection
- viper v1.17.0 (Go) - Configuration management
- crypto (Go stdlib) - Encryption/hashing

**Database Drivers (Go):**
- jackc/pgx/v5 v5.7.6 - PostgreSQL (primary)
- go-sql-driver/mysql v1.9.3 - MySQL
- mattn/go-sqlite3 v1.14.32 - SQLite
- mongodb/mongo-driver v1.17.4 - MongoDB
- redis/go-redis/v9 v9.3.0 - Redis
- ClickHouse/clickhouse-go/v2 v2.40.3 - ClickHouse
- snowflakedb/gosnowflake v1.17.0 - Snowflake
- aws/aws-sdk-go-v2 v1.39.5 - AWS services (Athena, DynamoDB, S3, TimeStream)
- neo4j/neo4j-go-driver/v5 v5.28.3 - Neo4j

**AI Integration:**
- openai (Go) v1.41.2 - OpenAI API client
- @modelcontextprotocol/sdk 1.29.0 (MCP Server) - Model Context Protocol

**Cloud & Deployment:**
- AWS SDK v2 (multiple services: S3, Athena, DynamoDB, TimeStream)
- Google Cloud SDKs (BigQuery, Cloud APIs)
- Azure SDK (storage/azblob)

**Validation & Serialization:**
- zod 4.2.1 - TypeScript schema validation and parsing

**Utilities:**
- uuid v1.6.0 (Go) - UUID generation
- google/uuid v1.6.0 (Go) - UUID generation
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.5.0 - Smart Tailwind CSS merge
- framer-motion 12.23.26 - Animation library (subtle, meaningful motion)

## Configuration

**Environment:**
- `.env.development` - Development environment variables
- `.env.production` - Production environment variables
- `.env.example` - Template with all required variables
- Environment-driven config per 12-factor app principles

**Key Configs:**
- VITE_API_URL - Frontend API endpoint
- VITE_NLP_API_URL - NLP service endpoint (QueryLens)
- JWT_SECRET - Authentication secret
- DATABASE_URL - PostgreSQL connection string
- REDIS_URL - Redis connection string
- OPENHANDS_URL - OpenHands AI orchestration service
- ENVIRONMENT - Deployment environment (development/staging/production)
- LOG_LEVEL - Logging verbosity (debug/info/warn/error)

**Build:**
- `vite.config.ts` - Vite frontend build, dev server config with /api proxy to localhost:8080
- `tsconfig.json` - Root TypeScript configuration
- `tailwind.config.cjs` - Tailwind CSS configuration (140+ lines)
- `.eslintrc` or `eslint.config.js` - ESLint configuration
- `vitest.config.ts` - Vitest unit test configuration
- `playwright.config.ts` - Playwright E2E test configuration
- `components.json` - Shadcn component registry

## Platform Requirements

**Development:**
- Node.js 18.0.0+
- Go 1.24.0+
- Docker & Docker Compose (for local services: PostgreSQL, Redis, Prometheus, Grafana)
- Rust toolchain (for Tauri desktop development)
- Xcode (macOS) or Android Studio (mobile development)

**Production:**
- Node.js 18+ or Docker container (frontend/API server)
- Go binary or Docker container (backend services)
- PostgreSQL 16 (primary database)
- Redis 7+ (caching, sessions)
- Prometheus + Grafana (monitoring)
- Cloudflare Workers (optional, for edge deployment)

**CI/CD:**
- GitHub Actions (pipeline scaffolding present)
- Playwright for E2E test automation
- Coverage enforcement (vitest + Jest)

---

*Stack analysis: 2026-05-23*
