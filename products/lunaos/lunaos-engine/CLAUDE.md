# CLAUDE.md - LunaOS Engine

This file extends the workspace root policy at:

- `/Users/shaharsolomon/dev/projects/claude.md`

## Product Mission And Target User

- Mission: Provide a secure, high-performance API backend for the LunaOS AI agent platform, handling workflow execution, agent orchestration, billing, RAG, and team management on Cloudflare Workers.
- Target user: LunaOS platform consumers (dashboard, studio, mobile, CLI) and third-party integrators using API keys.
- Primary jobs to be done:
  - Authenticate users (JWT, API keys, GitHub OAuth) and enforce RBAC
  - Execute AI agent workflows with chain orchestration and streaming
  - Manage billing lifecycle via LemonSqueezy webhooks
  - Index and search documents with Cloudflare Vectorize RAG
  - Route OpenClaw skill dispatch and execution
  - Serve team, user, and organization CRUD operations

## Product-Specific Architecture Constraints

- Runtime(s): Cloudflare Workers (Hono framework), D1 (SQLite), KV, Vectorize, Queues
- Core services: `packages/api/src/worker.ts` is the Hono entry point; routes in `packages/api/src/routes/`; services in `packages/api/src/services/`; middleware in `packages/api/src/middleware/`
- Data boundaries: All persistent state in D1 via Prisma; ephemeral cache in KV; vector embeddings in Vectorize; secrets in Workers env bindings
- Integration boundaries: LemonSqueezy (billing webhooks), GitHub (OAuth + repo indexing), OpenAI/Anthropic (LLM calls), OpenClaw (skill dispatch), Sentry (error tracking)
- Max 200 lines per source file; split route handlers from business logic
- Zod validation on every API input; structured JSON error responses with correlation IDs
- TypeScript strict mode; no `any` types without documented justification

## Product-Specific Test Matrix

- Unit tests: Vitest; files in `packages/api/src/**/*.test.ts` and `tests/*.test.ts`; mock D1/KV bindings; 194 tests passing
- Integration tests: Vitest + miniflare; files in `tests/integration/`; real D1/KV via miniflare; test full request-response cycles
- E2E/smoke tests: Playwright against deployed staging at `api.lunaos.ai`
- Critical path tests (must remain 100% covered):
  - Auth middleware (`middleware/auth.ts`, `middleware/api-key-auth.ts`)
  - Billing webhook handlers (`services/billing-webhook-handlers.ts`)
  - JWT token issuance and validation
  - Rate limiting enforcement (`middleware/rate-limiter.ts`)
  - API key create/revoke lifecycle
- Coverage thresholds: >=90% line, >=85% branch (matches root policy)

## Product-Specific Security Controls

- AuthN/AuthZ model: JWT bearer tokens for user sessions; SHA-256 hashed API keys for service auth; GitHub OAuth for social login; role-based access (user, admin) enforced in middleware
- Secret management: All secrets (JWT_SECRET, LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_WEBHOOK_SECRET, GITHUB_CLIENT_SECRET) stored in Workers env bindings, never in code
- Input/output validation: Zod schemas for all route inputs; DOMPurify for any user-generated content; PII redaction via `services/pii-redactor.ts`
- Audit logging requirements: Auth events (login, signup, key create/revoke), billing mutations (subscription change, webhook receipt), and admin actions logged via `services/audit-logger.ts`
- Data retention/privacy constraints: User data deletable on request; PII redacted from logs; webhook payloads not stored after processing

## Product-Specific Release Checklist

- [ ] CI is green (all 194+ unit tests pass)
- [ ] Integration tests pass against miniflare D1/KV
- [ ] Coverage thresholds met: >=90% line, >=85% branch
- [ ] Security scans have no open Critical/High issues
- [ ] SAST and dependency vulnerability scan clean
- [ ] Billing webhook signature validation tested
- [ ] Rate limiting thresholds verified
- [ ] `wrangler deploy --dry-run` succeeds
- [ ] Rollback path verified (previous Worker version tagged)
- [ ] Release notes and API changelog updated
- [ ] Staging smoke tests pass before production promote

## Commands

```bash
npm run test              # Unit tests (Vitest)
npm run test:integration  # Integration tests
npm run test:coverage     # Coverage report
npm run dev:api           # Local dev (wrangler dev)
npm run build             # Build all packages
npm run deploy:engine     # Deploy to Cloudflare Workers
```

## Local Notes

- This file adds stricter coverage for auth and billing paths (100%).
- This file does not weaken any root policy requirement.
- Engine tests: 194/194 passing as of March 2026.
- Billing migrated from Stripe to LemonSqueezy (March 2026).
