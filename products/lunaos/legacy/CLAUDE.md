# LunaForge — CLAUDE.md

> **Portfolio Tracker**: Not configured | **Readiness**: 72% | **Category**: BUILD

## Mission
AI-powered VS Code extension and Cloudflare Worker for intelligent code generation, refactoring, and architecture analysis in real-time with edge deployment.

## Code Map & Index

### Directory Structure
```
lunaforge/
├── packages/
│   ├── lunaforge-extension/      # Core VS Code extension (main product)
│   │   ├── src/
│   │   │   ├── extension.ts      # Extension entry and command registration
│   │   │   ├── providers/        # IntelliSense, code actions, completions
│   │   │   ├── ui/               # Webview components (React)
│   │   │   ├── services/         # API clients, cache, state
│   │   │   ├── types/            # TypeScript interfaces
│   │   │   └── utils/            # Helpers, formatters, validators
│   │   ├── tests/                # Jest test suite
│   │   ├── playwright/           # E2E Playwright tests
│   │   ├── assets/               # Icons, screenshots
│   │   └── package.json
│   ├── lunaforge-shared/         # Common types, constants (monorepo package)
│   └── [other packages]/
├── workers/
│   ├── lunaforge-worker/         # Cloudflare Worker (edge runtime)
│   │   ├── src/
│   │   │   ├── index.ts          # Worker request handler
│   │   │   ├── routes/           # API endpoints (fetch, refactor, analyze)
│   │   │   ├── ai/               # AI model integration (Claude, GPT)
│   │   │   ├── cache/            # Cloudflare KV/Cache API
│   │   │   └── utils/            # Processing, parsing, formatting
│   │   ├── wrangler.toml         # Cloudflare configuration
│   │   └── package.json
├── scripts/
│   ├── _build-all.js             # Build all packages/workers
│   ├── _watch-all.js             # Watch mode for development
│   ├── _typecheck-all.js         # TypeScript validation
│   ├── validate-modes.js         # LunaMode configuration validation
│   └── release.js                # Version bumping, publishing
├── vitest.integration.config.ts  # Integration tests
├── vitest.ui.config.ts           # UI/Playwright tests
├── package.json (root monorepo)
└── CHANGELOG.md
```

### Key Files Index
| File | Purpose | Lines |
|------|---------|-------|
| `packages/lunaforge-extension/src/extension.ts` | Extension activation, command registry | ~300 |
| `packages/lunaforge-extension/src/providers/` | CodeAction, Completion, Hover providers | ~150/ea |
| `packages/lunaforge-extension/src/ui/` | React webview for settings, results | ~200/ea |
| `workers/lunaforge-worker/src/index.ts` | Cloudflare Worker handler, routing | ~250 |
| `workers/lunaforge-worker/src/ai/` | OpenAI/Claude integration, streaming | ~200 |
| `workers/lunaforge-worker/src/cache/` | KV cache, Redis integration | ~120 |
| `scripts/_build-all.js` | Monorepo build orchestration | ~80 |
| `package.json` (root) | Workspaces, vitest configs, CI scripts | - |

## Development Guidelines

### Code Design Standards
- **Max 200 lines per file** — split providers (IntelliSense, actions), route handlers, AI integrations
- **Single Responsibility** — CodeActionProvider handles quickfixes only, not completions; Worker routes remain isolated
- **Type Safety** — strict TypeScript + shared types from `lunaforge-shared` package
- **Error Handling** — AI API errors include retry logic with exponential backoff; Worker errors logged to CloudFlare Analytics
- **Naming** — `CodeRefactoringProvider`, `SchemaAnalysisService`, `StreamingAIClient` (descriptive)
- **No Magic Values** — LunaMode presets, timeout constants, API endpoints in constants file
- **Dependency Injection** — providers accept services (cache, AI client) via constructor
- **Pure Functions First** — parsing logic, AST traversal separate from command side effects

### Code Review Checklist
- [ ] No file exceeds 200 lines (check extension.ts, route handlers, AI integrations)
- [ ] All shared types exported from `lunaforge-shared` package
- [ ] Extension provider methods return proper VS Code types (CodeAction, CompletionItem, etc.)
- [ ] Worker routes have error boundaries and monitoring via CloudFlare
- [ ] AI integration includes retry logic, cost tracking, rate limiting
- [ ] Cache keys follow pattern `mode:${mode}:${hash(input)}`
- [ ] No API keys in source; use `wrangler secrets` for Worker environment variables

## Testing Strategy

### Unit Tests — Full Coverage Required
- **Framework**: Vitest (monorepo-wide configuration)
- **Coverage Target**: 95%+ lines, 90%+ branches
- **Test Files**: `packages/*/tests/*.test.ts`, `workers/*/src/**/*.test.ts`
- **Run**: `npm run test:unit` or `npm run test:unit:watch`

**Test Areas**:
- Extension providers: CodeAction generation, Completion ranking, Hover content
- Worker routes: fetch endpoint parsing, refactor route logic, caching behavior
- AI integration: model selection, streaming response handling, token counting
- Cache service: KV operations, TTL expiry, cache invalidation patterns
- Utils: AST parsing, diff generation, schema validation, LunaMode config parsing

### Integration Tests
- **Config**: `vitest.integration.config.ts`
- **Run**: `npm run test:integration`
- **Scope**: Extension ↔ Worker communication, AI API calls (mocked), cache consistency

### Browser / Claude Chrome Extension Tests
- **Tool**: Playwright + Claude in Chrome MCP
- **Config**: `packages/lunaforge-extension/playwright.config.ts`
- **Run**: `npm run test:ui`

**Key Flows**:
  1. **Intelligent Refactoring** — user opens file, selects code block, runs "Refactor Code" command, extension shows refactoring suggestions in quick preview panel
  2. **Architecture Analysis** — user runs "Analyze Project Structure" command, Worker scans project, returns dependency graph visualization
  3. **Code Generation** — user writes function stub comment (`// TODO: fetch user by email`), extension generates implementation via Worker AI
  4. **LunaMode Switching** — user switches between modes (JavaScript, TypeScript, Python) in settings, extension adapts provider behavior
  5. **Performance Monitoring** — user views LunaForge status bar showing AI processing time, cache hit rate, token usage

- **Personas**:
  - **Beginner**: Basic refactoring suggestions, AI-powered completions, inline error fixes
  - **Mid-level**: Architecture analysis, test generation, performance optimization recommendations
  - **Enterprise**: Team workspace sync, audit logging, on-premise Worker deployment, custom LunaModes
  - **First-time visitor**: Interactive tutorial, sample file analysis, feature showcase

## Commands

### Development (Monorepo Root)
```bash
# Install dependencies (npm workspaces)
npm install

# Build all packages + workers
npm run build

# Watch mode (incremental compilation)
npm run watch

# Type check all workspaces
npm run typecheck

# Run unit tests
npm run test:unit
npm run test:unit:watch

# Run integration tests
npm run test:integration

# Run E2E (Playwright) tests
npm run test:ui

# Validate LunaMode config files
npm run validate:modes

# Fix LunaMode IDs
npm run fix-mode-ids
```

### Extension Development
```bash
# From lunaforge-extension directory
npm run compile
npm run watch

# Test VS Code extension
npm run test

# Package VSIX
npm run package

# Publish to VS Code Marketplace
npm run publish
```

### Worker Development & Deployment
```bash
# Build worker
npm run build --workspace lunaforge-worker

# Dev server (local)
npm run deploy:worker:preview

# Deploy to Cloudflare Production
npm run deploy:worker

# Deploy both extension + worker (full pipeline)
npm run deploy:all
```

## What's Done vs What's Left

### Completed
- [x] Monorepo structure with npm workspaces
- [x] VS Code extension with sidebar, command palette integration
- [x] Cloudflare Worker scaffold with routing
- [x] CodeActionProvider (quickfixes), CompletionProvider
- [x] AI routing abstraction (OpenAI, Claude, Qwen)
- [x] Streaming response handling from Worker
- [x] Cache layer with KV operations
- [x] TypeScript strict mode, ESLint, Prettier
- [x] Vitest configuration (unit, integration, UI)
- [x] CI/CD scaffolding (.github/workflows)

### In Progress / Gaps
- [ ] Playwright test coverage (config complete, tests incomplete)
- [ ] Full LunaMode preset library (schema defined, only 3–4 modes tested)
- [ ] Performance benchmarks (Cache hit rates not tracked)
- [ ] Security audit (Worker environment variables, API key rotation)
- [ ] Documentation (README sparse, API reference missing)

### Not Started
- [ ] Team collaboration features (shared LunaModes, workspace sync)
- [ ] On-premise Worker deployment (container image not built)
- [ ] Custom mode builder UI (users cannot define modes)
- [ ] Analytics dashboard (usage metrics not exposed)
- [ ] Multi-language support (only English prompts)

## Competitors & Market Context

**Market**: AI-powered IDE extensions for professional developers.

**Competitors**:
- **GitHub Copilot** — General code completion, no architecture analysis
- **Tabnine** — Simpler completions, no refactoring focus
- **Cursor IDE** — Electron-based, not VS Code extension
- **Codeium** — Open-source alternative, basic featureset

**Differentiators**:
- **LunaMode** system (preset configurations for different languages/frameworks)
- Edge deployment (Cloudflare Worker reduces latency to <100ms globally)
- Streaming responses (incremental suggestions as AI thinks)
- Architecture analysis (dependency graph, bottleneck detection)
- Monorepo-ready (multi-package support out of box)

**Typical User**:
- Full-stack developers optimizing for speed (Node.js + Python + Go projects)
- Open-source maintainers needing fast refactoring feedback
- Startups wanting offline-capable AI assistant (cache-first strategy)

**Pricing Model**: Freemium (basic completions, 1 mode) → Pro ($12/mo, all modes, premium AI) → Team ($50/mo, audit logs, on-prem).
