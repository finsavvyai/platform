> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 6: TokenForge — Standalone Product (2 weeks)

## Goal
Extract TokenForge from the OpenSyber monorepo into a standalone,
publishable npm package with its own landing page, docs, and demo.
Make it usable by ANY SaaS — not just OpenSyber.

## Why TokenForge as a Separate Product
- It solves a real problem independently (session hijacking after MFA)
- No competitor: Google DBSC is Chrome-only, not GA
- Revenue: $49-199/mo SaaS pricing per customer
- Lead gen: TokenForge users discover OpenSyber
- Developer credibility: open-source client SDK

## Current State (Post-Sprint)
- Client SDK: complete (crypto, storage, signer, interceptor, binding)
- Server middleware: complete (Hono, Express, Next.js, Fastify)
- React provider: complete (Next.js only)
- Trust score engine: complete (7 signals, 100-point scale)
- Step-up auth: complete (email OTP, TOTP RFC 6238, passkey/WebAuthn)
- Storage: complete (D1, Postgres, Redis, in-memory)
- Tests: 118 passing (10 test files)
- Docs: 5 markdown files in /tokenforge/ (architecture, execution plan)
- Integration: NOT wired into OpenSyber yet

## Tasks

### 6.1 Package Restructure
- [x] Create new repo structure (still in monorepo for now):
  ```
  packages/tokenforge/
  ├── src/
  │   ├── client/          # Browser SDK (MIT license)
  │   ├── server/          # Server middleware (Commercial)
  │   ├── react/           # React bindings (MIT)
  │   ├── adapters/        # Framework adapters
  │   │   ├── hono.ts      # Re-export from server/
  │   │   ├── express.ts   # NEW
  │   │   ├── nextjs.ts    # NEW
  │   │   └── fastify.ts   # NEW
  │   └── shared/          # Types (MIT)
  ├── src/**/*.test.ts     # Colocated tests
  └── package.json         # 9 export entry points
  ```
- [x] Split package.json exports into 9 entry points:
  - `@opensyber/tokenforge/client` → `./src/client/index.ts`
  - `@opensyber/tokenforge/server` → `./src/server/index.ts`
  - `@opensyber/tokenforge/react` → `./src/react/index.ts`
  - `@opensyber/tokenforge/hono` → `./src/adapters/hono.ts`
  - `@opensyber/tokenforge/express` → `./src/adapters/express.ts`
  - `@opensyber/tokenforge/nextjs` → `./src/adapters/nextjs.ts`
  - `@opensyber/tokenforge/fastify` → `./src/adapters/fastify.ts`
  - `@opensyber/tokenforge/shared` → `./src/shared/types.ts`
  - `@opensyber/tokenforge/storage` → `./src/server/storage/index.ts`
- [x] Update barrel exports in `src/server/index.ts`
- [x] Verify `pnpm build` works with new structure

### 6.2 Express Adapter
- [x] Create `src/adapters/express.ts` (< 200 lines):
  - `tokenForgeMiddleware(options)` → Express middleware
  - Framework-agnostic `verifyRequest()` pipeline
  - Support `req.tf` context object (bound, trustScore, deviceId)
- [x] Write tests for Express adapter (7 tests)

### 6.3 Next.js Adapter
- [x] Create `src/adapters/nextjs.ts` (< 200 lines):
  - `withTokenForge(handler, options)` → wraps App Router API route
  - `tokenForgeCheck(req, options)` → Next.js middleware.ts compatible
  - Configurable `getAuth` callback for userId/sessionId extraction
- [x] Write tests for Next.js adapter (11 tests)

### 6.4 Fastify Adapter
- [x] Create `src/adapters/fastify.ts` (< 200 lines):
  - `tokenForgePlugin` → Fastify plugin with `fastify.register()`
  - Decorates `request.tf` with bound/trustScore/deviceId
  - Support Fastify hooks for preHandler
- [x] Write tests for Fastify adapter (8 tests)

### 6.5 Complete Step-Up Auth
- [x] Implement TOTP verification in `src/server/totp.ts`:
  - HMAC-SHA1 OTP (RFC 6238) — zero dependencies, Web Crypto API
  - Time-step: 30 seconds, window: ±1 step tolerance
  - Base32 decoding, timing-safe comparison
- [x] Implement email OTP delivery via configurable provider:
  - `options.sendEmail(userId, otp)` callback
  - Storage-backed OTP persistence and rate limiting
- [x] Add passkey step-up support (WebAuthn):
  - Challenge generation with configurable `rpId`
  - Basic credential verification structure
- [x] Write tests for TOTP (12 tests)

### 6.6 Storage Abstraction
- [x] Create `src/server/storage/interface.ts`:
  - `TokenForgeStorage` interface: sessions CRUD, events insert, nonce check, challenges, OTP
  - `StepUpChallengeRecord` interface
  - Remove direct D1/KV dependency from middleware
- [x] Create `src/server/storage/d1.ts` — Cloudflare D1 + KV adapter
- [x] Create `src/server/storage/postgres.ts` — PostgreSQL adapter (generic client interface)
- [x] Create `src/server/storage/redis.ts` — Redis adapter (generic client interface)
- [x] Create `src/server/storage/memory.ts` — In-memory (for testing/dev)
- [x] Write tests for MemoryStorage (14 tests)

### 6.7 Full Test Suite
- [x] Client tests (colocated):
  - `crypto.test.ts` — key generation, export, sign/verify round-trip (12 tests)
  - `signer.test.ts` — signature format, nonce generation (11 tests)
  - `interceptor.test.ts` — fetch interception, header injection (9 tests)
- [x] Server tests (colocated):
  - `trust-score.test.ts` — all 7 signal combinations (21 tests)
  - `verify.test.ts` — full verification pipeline (13 tests)
  - `totp.test.ts` — TOTP generation and verification (12 tests)
  - `storage/memory.test.ts` — storage interface compliance (14 tests)
- [x] Adapter tests (colocated):
  - `express.test.ts` — happy path, missing headers, error handling (7 tests)
  - `nextjs.test.ts` — withTokenForge, tokenForgeCheck, edge cases (11 tests)
  - `fastify.test.ts` — plugin registration, preHandler hook, errors (8 tests)
- [x] Total: 118 tests, all passing

## Definition of Done
- [x] TokenForge works with Hono, Express, Next.js, Fastify
- [x] Storage works with D1, Postgres, Redis, in-memory
- [x] Step-up auth: email OTP, TOTP, passkey all functional
- [x] 118 tests passing (10 test files)
- [x] All files < 200 lines
- [x] `pnpm build` clean (7/7 tasks), `pnpm test` green (907 total tests)

## Test Results (Final)
| Package | Test Files | Tests |
|---|---|---|
| tokenforge | 10 | 118 |
| agent | 11 | 134 |
| api | 29 | 439 |
| web | 26 | 216 |
| **Total** | **76** | **907** |

## Estimated Effort
| Task | Days | Status |
|---|---|---|
| 6.1 Package restructure | 1 | Done |
| 6.2 Express adapter | 1 | Done |
| 6.3 Next.js adapter | 1 | Done |
| 6.4 Fastify adapter | 1 | Done |
| 6.5 Step-up auth completion | 2 | Done |
| 6.6 Storage abstraction | 2 | Done |
| 6.7 Full test suite | 2 | Done |
| **Total** | **10 days** | **Complete** |
