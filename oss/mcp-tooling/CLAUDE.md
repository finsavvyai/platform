# MCPOverflow — CLAUDE.md

> **Portfolio Tracker**: `mcpoverflow/CLAUDE.md` | **Readiness**: 55% | **Category**: BUILD

## Mission
Model Context Protocol (MCP) connector generation platform. Upload OpenAPI specs, auto-generate MCP Workers, deploy as Cloudflare Workers. Enable any API to become AI-agent-compatible with zero manual coding.

## Code Map & Index

### Directory Structure
```
mcpoverflow/
├── apps/                         # App workspaces (multiple: io, dev, ai, etc)
│   ├── io/                       # Main web app (React 18, Vite, Tailwind)
│   ├── dev-platform/             # Developer portal & docs
│   ├── ai-platform/              # AI-powered code generation UI
│   ├── marketing/                # Landing & pricing pages
│   └── docs-site/                # Documentation
├── packages/                     # Shared libraries
│   ├── codegen/                  # OpenAPI → MCP code generator
│   ├── openapi-parser/           # OpenAPI spec parser & validator
│   ├── ai-engine/                # AI prompt engineering for codegen
│   ├── cli/                      # Command-line tool for local generation
│   ├── web-skills/               # Website-as-MCP: site skills, browse-mode generator, CF Browser Rendering runtime
│   ├── config/                   # Config management
│   ├── ui/                       # Shared UI components
│   └── utils/                    # Utility functions
├── services/                     # Backend services
│   ├── api-service/              # REST API for connector CRUD
│   ├── generator/                # **CRITICAL: Generator.ts DELETED**
│   ├── proxy/                    # API proxy & routing
│   └── ai-crew/                  # AI crew orchestration
├── workers/                      # Cloudflare Workers (deployed connectors)
├── supabase/                     # PostgreSQL schema & migrations
├── .github/workflows/            # CI/CD pipelines
└── package.json                  # Monorepo root

## Current State (CRITICAL ISSUES)
- **Generator Service**: Generator.ts file deleted — code generation broken
- **App Duplication**: io, marketing, docs-site — 8 confusing duplicate apps
- **No Integration Tests**: API endpoints untested
- **TypeScript Strict Mode**: Many files have `any` types
- **File Size**: Many files exceed 200 lines
```

### Key Files Index
| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `packages/codegen/index.ts` | OpenAPI → TypeScript code generator | ~300 | NEEDS SPLIT |
| `packages/openapi-parser/parser.ts` | OpenAPI spec validation | ~250 | NEEDS TESTS |
| `packages/ai-engine/prompt.ts` | LLM prompts for code generation | ~200 | OK |
| `services/api-service/src/routes/connectors.ts` | CRUD endpoints | ~180 | NO TESTS |
| `services/generator/index.ts` | **DELETED** — code gen orchestration | - | BLOCKER |
| `apps/io/src/pages/index.tsx` | Landing page | ~150 | OK |
| `workers/connector-template.ts` | MCP Worker scaffold | ~120 | OK |
| `supabase/migrations/001-*.sql` | Schema setup | ~80 ea | OK |
| `packages/web-skills/src/skills/*.ts` | Per-site browse skills (reddit, x, amazon, ...) | <200 ea | OK |
| `packages/web-skills/src/generator/render-server.ts` | Browse MCP Worker emitter | ~130 | OK |
| `packages/web-skills/src/runtime/cf-browser.ts` | CF Browser Rendering action runner | ~130 | OK |

## Development Guidelines

### Code Design Standards
- **Max 200 lines per file** — split into focused modules
- **Single Responsibility** — one parser, one generator, one route, one component
- **Type Safety** — strict TypeScript mode, no `any` types
- **Error Handling** — explicit errors, typed Result pattern
- **Naming** — descriptive, domain language (`generateMCPWorker` not `genMW`)
- **No Magic Values** — all config via env vars or config files
- **Dependency Injection** — services injected, not created inline
- **Pure Functions First** — generators are pure, side effects at edges

### Architecture Patterns

#### Browse-Mode Pipeline (Website → MCP)
```
1. Select built-in skill OR call site-generator on a URL
2. Validate WebSkill → derive declared egress from baseUrl + handlers
3. Render Cloudflare Worker scaffold (MYBROWSER binding)
4. Each WebAction → MCP tool; handler body frozen in src/skill.ts
5. Hardened mode: hash tools → Ed25519 sign → manifest.json
6. Cold-start verifies live tools vs manifest; refuses boot on drift
7. Runtime: page.goto() with request interception enforcing egress
```

#### Code Generation Pipeline
```
1. OpenAPI Spec Upload → Validate → Normalize
2. Parse Routes → Extract parameters, authentication, responses
3. Generate TypeScript Types → Export/import statements
4. Generate MCP Tool Definitions → Server setup code
5. Generate Worker Wrapper → CloudFlare Worker scaffold
6. Package → ZIP with manifest, deploy metadata
7. Deploy → CloudFlare Worker API
```

#### API Service Routes
- `POST /api/connectors` — Create new connector from OpenAPI spec
- `GET /api/connectors` — List user's connectors with pagination
- `GET /api/connectors/:id` — Fetch connector details + generated code
- `PATCH /api/connectors/:id` — Update OpenAPI spec, regenerate
- `DELETE /api/connectors/:id` — Delete connector
- `POST /api/connectors/:id/deploy` — Deploy to CloudFlare Workers
- `GET /api/connectors/:id/status` — Deployment status

#### Worker Architecture
- **Input**: MCP client message (tool name + params)
- **Validation**: Params against OpenAPI schema
- **Transformation**: User input → API request format
- **API Call**: Fetch to upstream API
- **Response Transform**: API response → MCP format
- **Error Handling**: API errors → MCP error messages

#### Database (Supabase PostgreSQL)
- **Tables**: `connectors`, `api_keys`, `deployments`, `usage_metrics`, `jobs`
- **Auth**: Supabase Auth (JWT), device fingerprint
- **RLS**: Data scoped to authenticated user
- **Migrations**: Numbered SQL files in `supabase/migrations/`

### Code Review Checklist
- [ ] No file exceeds 200 lines
- [ ] All public functions have JSDoc comments
- [ ] No `any` types (run `tsc --noImplicitAny`)
- [ ] Error cases handled explicitly
- [ ] No hardcoded URLs or API keys
- [ ] All components tested (unit + integration)
- [ ] Coverage >= 80% per module
- [ ] Browser tests pass on Chrome, Safari, Firefox
- [ ] Monorepo imports use `packages/`, not relative paths

## Testing Strategy

### Unit Tests — Full Coverage Required
- **Framework**: Vitest + Testing Library (React)
- **Coverage Target**: 80% line, 75% branch per module
- **Run**: `npm test` at monorepo root or per workspace

- **openapi-parser**: Parse valid/invalid specs, extract routes, validate params
- **codegen**: Generate types, tool defs, worker code; compare against golden files
- **ai-engine**: Prompt generation, completion parsing
- **api-service**: Route handlers with mocked Supabase
- **React components**: Snapshot + interaction tests (search, upload, deploy button)

### Integration Tests
- **Generator**: OpenAPI spec → generated code → valid TypeScript
- **API Service**: POST connector → stored in DB → GET returns same data
- **Worker**: Generated worker can handle sample API calls
- **Deployment**: POST deploy → CloudFlare API called with correct payload

### Browser / Claude Chrome Extension Tests
- **Tool**: Playwright + Claude in Chrome MCP
- **Flows to test**:
  1. **Landing Page**: Visit site, view pricing, click "Get Started"
  2. **Signup Flow**: Create account via Supabase Auth, verify email, redirect to dashboard
  3. **Connector Creation**: Upload OpenAPI spec (petstore.json), generate code, view preview
  4. **Code Generation**: Inspect generated Worker code, download ZIP
  5. **Deployment**: Click "Deploy to CloudFlare", authenticate, confirm deployment
  6. **Connector List**: View all connectors, filter by status, sort by created date
  7. **Edit Connector**: Upload new OpenAPI spec, re-generate code
  8. **Delete Connector**: Remove connector, verify deletion
  9. **API Key Management**: Generate API key, copy, revoke
  10. **Dark Mode**: Toggle dark mode, verify color scheme persists
  11. **Mobile Responsive**: On iPhone 12, upload flow works (file picker adapts)
  12. **Error Handling**: Upload invalid spec, display error message

- **Personas**:
  - Free-tier: 3 connectors, 10 deployments/mo, community support
  - Pro: 50 connectors, 1000 deployments/mo, email support, custom domain
  - Enterprise: unlimited, dedicated account manager, SLA, on-prem option
  - Developer (API-first): API key auth, webhook triggers, SDK usage

- **Run**: `npx playwright test`

## Commands

```bash
# Development
npm install                          # Install monorepo deps
npm run dev                          # Start all apps concurrently

# Testing
npm test                             # Vitest all workspaces
npm run test:coverage                # Coverage report
npm run test:e2e                     # Playwright tests

# Building
npm run build                        # Build all workspaces
npm run build:workers                # Build CloudFlare Workers

# Deployment
npm run deploy                       # Deploy to staging
npm run deploy:prod                  # Deploy to production

# Linting & Formatting
npm run lint                         # ESLint all workspaces
npm run format                       # Prettier format
npm run typecheck                    # TypeScript strict check
```

## What's Done vs What's Left

### Done
- [x] Web app UI (React 18, Vite, Tailwind)
- [x] OpenAPI parser (basic validation)
- [x] Code generator scaffolding (codegen package)
- [x] Supabase schema & migrations
- [x] Worker template (connector-template.ts)
- [x] Landing page with pricing
- [x] Clerk authentication
- [x] Basic CI/CD workflows

### Left (Critical Path — BLOCKERS)
- [ ] **CRITICAL: Restore or rebuild Generator.ts** (code generation entry point)
- [ ] **CRITICAL: Consolidate duplicate apps** (io, marketing, docs-site → single app)
- [ ] Generator service: orchestrate codegen, store results, handle async jobs
- [ ] Integration tests: spec upload → code gen → valid output
- [ ] OpenAPI parser: comprehensive validation, edge cases
- [ ] API service: test coverage 80%+
- [ ] Worker: test generated code executes correctly

### Left (Medium Priority)
- [ ] TypeScript strict mode: resolve all `any` types
- [ ] File size refactoring: split oversized modules
- [ ] CLI tool: local code generation for developers
- [ ] Webhooks: notify user on deployment completion
- [ ] Rate limiting: per-user, per-API generation limits
- [ ] Advanced codegen: security validation, type inference
- [ ] Load testing: 1000 concurrent code generation requests
- [ ] Documentation: API spec, CLI guide, best practices

## Competitors & Market Context

### Direct Competitors
- **LangChain**: LLM framework, not MCP-focused
- **Anthropic MCP SDK**: Low-level, requires manual implementation
- **LocalAI**: Self-hosted alternative
- **Replicate**: API composition, not MCP-specific

### Market Gaps (MCPOverflow's Opportunity)
- **Zero-touch MCP generation**: Upload spec, get MCP Worker
- **No manual coding**: All generated, fully tested
- **Enterprise integration**: Deploy to private CloudFlare accounts
- **Developer-friendly**: CLI tool, API, web UI

### Pricing Model (Proposed)
- **Free**: 3 connectors, 10 deployments/month
- **Starter**: 50 connectors, $49/month
- **Pro**: 500 connectors, $299/month
- **Enterprise**: Unlimited, custom pricing, on-prem option

### Launch Timeline
- **MVP (Q1 2026)**: Fix Generator, consolidate apps, launch with 10 pilot users
- **Beta (Q2 2026)**: CLI tool, webhooks, advanced codegen
- **GA (Q3 2026)**: Enterprise features, full documentation
