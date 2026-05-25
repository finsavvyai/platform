# CLAUDE.md — AMLIQ v2 Project Overview

## What This Project Is

**AMLIQ** = AI-Enhanced Global Intelligence Screening

An AML/CFT (Anti-Money Laundering / Combating Terrorist Financing) sanctions screening platform for financial institutions. Replaces expensive, opaque tools like World-Check with configurable AI-powered matching.

## Tech Stack

- **Backend**: Go 1.22 (clean architecture, rich domain models)
- **Frontend**: React 18 + TypeScript (Vite, Apple HIG components)
- **Database**: PostgreSQL + pgvector (vector embeddings)
- **Billing**: LemonSqueezy (SaaS subscription)
- **Infrastructure**: Docker, Kubernetes-ready

## Critical Rules for Development

1. **Every file ≤100 lines** (including blanks/comments). Split if approaching limit.
2. **Table-driven tests**: All Go tests use `tests := []struct{...}` pattern
3. **Apple HIG UI**: React components follow Apple Human Interface Guidelines
4. **Responsive design**: Mobile-first, tested at 375px, 768px, 1024px viewports
5. **No external validation libs**: Go uses stdlib errors; React uses Zod for validation
6. **Value objects validate on construction**: NewXxx() returns (Xxx, error)
7. **Interface max 3 methods**: Prefer composition over large interfaces

## How to Run

### Development
```bash
# Backend
cd /sessions/loving-cool-einstein/mnt/outputs/aegis-v2
go run ./cmd/api/main.go

# Frontend
cd web
npm run dev
```

### Docker
```bash
make docker-up    # Starts API + PostgreSQL + Redis
make docker-down
```

## Directory Map (Where to Edit)

| Directory | Purpose | When to Edit |
|-----------|---------|--------------|
| `internal/domain/` | Value objects, entities, enums | Add new entity types or business models |
| `internal/screening/` | 6-layer matching engine | Add new matcher or scoring algorithm |
| `internal/ingestion/` | List parsers (OFAC, UN, EU, etc) | Support new sanctions list format |
| `internal/billing/` | LemonSqueezy integration, usage metering | Change pricing/plans/features |
| `internal/storage/` | Repository interfaces (no DB logic) | Add new persistence query |
| `api/` | HTTP handlers, middleware, routes | Add new endpoint or auth method |
| `web/src/pages/` | React page components | Create new dashboard page |
| `web/src/components/` | Reusable React components | Build new UI component |
| `migrations/` | SQL migrations | Database schema changes |
| `cmd/api/` | Server entrypoint | Change startup config/logging |
| `cmd/worker/` | Background job processing | Add async batch job handler |

## Quick Architecture

```
Request → Auth Middleware → Rate Limit → Screening Engine
         ↓ (6-layer matching)
    Exact → Fuzzy → Phonetic → Token → Embedding → Graph
         ↓ (weighted scoring)
    Confidence Score + Explanation → Database → Alert/Response
```

## Key Files to Know

- `README.md` — full project documentation
- `docs/VISION.md` — product roadmap and market positioning
- `docs/ARCHITECTURE.md` — system design
- `docs/CODE_MAP.md` — file-by-file guide
- `docs/SCREENING_ENGINE.md` — how matching works
- `docs/BILLING_MODEL.md` — pricing/subscription model
- `docs/API_REFERENCE.md` — all endpoints
- `docs/CONVENTIONS.md` — coding standards
- `.cursorrules` — for Cursor AI
- `.github/copilot-instructions.md` — for GitHub Copilot

## How to Extend (Quick Examples)

### Add a New Screening Matcher
1. Create `internal/screening/my_matcher.go` (<100 lines)
2. Implement the `Matcher` interface (Match method)
3. Add to Engine.Screen() cascade
4. Create `internal/screening/my_matcher_test.go` (table-driven tests)

### Add a New API Endpoint
1. Create handler in `api/handler_myfeature.go` (<100 lines)
2. Add route in `api/router.go`
3. Test with `api/handler_myfeature_test.go`
4. Document in docs/API_REFERENCE.md

### Add a React Page
1. Create `web/src/pages/MyPage.tsx` following Apple HIG
2. Add route in `web/src/App.tsx`
3. Create tests in `web/src/pages/MyPage.test.tsx`
4. Ensure responsive (test with ResizeWindow in dev tools)

## Code Quality Standards

- No `panic()` in production code (return errors)
- No `TODO` comments without issue link
- All exported types have methods (no bare structs)
- Database queries wrap in repo interfaces
- React components use hooks, no class components
- CSS via Tailwind + Apple HIG color palette

## Testing

```bash
# Go tests
go test ./...                    # All tests
go test -cover ./...            # With coverage
go test -v ./internal/screening/

# React tests
cd web
npm test                          # All tests
npm test -- ScreeningPage        # Specific component

# Integration
make docker-up && ./scripts/test-integration.sh
```

## Debugging

- **Go**: Use `log.Printf()` (never fmt.Println)
- **React**: Browser DevTools, React DevTools extension
- **SQL**: `EXPLAIN ANALYZE` for slow queries
- **HTTP**: Log middleware shows all requests/responses

## What's Different from v1?

- **v1**: Single monolith, limited matching layers
- **v2**: 6-layer matching (Exact, Fuzzy, Phonetic, Token, Embedding, Graph)
- **v2**: Product-based billing (API, Dashboard, SDK, iFrame, Dataset)
- **v2**: Explainable AI (why did this match?)
- **v2**: Sub-50ms latency target
- **v2**: Multi-tenant from day 1

## Getting Help

1. Check `docs/GLOSSARY.md` for AML terminology
2. Check `docs/CODE_MAP.md` for file locations
3. Run `go test -v ./...` to see actual behavior
4. Read the most-modified file in a package (usually the "main" file)

---

## PushCI.dev (in runlocal/)

This repo also contains **PushCI.dev** — an AI-native CI/CD
platform born from AMLIQ's CI/CD needs. See `runlocal/CLAUDE.md`
for full details. Key facts:
- 21 Go packages, 465+ tests, 167 Go files
- 19 languages, 40+ frameworks, 21 deploy targets
- CLI: `npx pushci init` (14 commands)
- Dashboard: 11 pages (React + Tailwind)
- API: Cloudflare Workers (Hono + D1)
- Domain: pushci.dev
- Repo: github.com/finsavvyai/pushci

**Start here**: Read `docs/VISION.md` for AMLIQ product vision.
