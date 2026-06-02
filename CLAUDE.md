# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`finsavvyai-platform` is a **pnpm workspace monorepo** of pure, framework-agnostic TypeScript library packages. There is no application, server, or runtime entrypoint here — every package builds to `dist/` and is published (restricted access) for consumption by downstream FinsavvyAI products (PushCI, Qestro, LunaOS, OpenSyber, SDLC.cc, AMLIQ).

The five packages and their roles:

| Package | Role |
|---|---|
| `@finsavvyai/auth` | OAuth, JWT (via `jose`), HMAC/API keys, WebAuthn, RBAC, SCIM, role catalog, optional Hono middleware |
| `@finsavvyai/billing` | LemonSqueezy subscriptions, entitlements |
| `@finsavvyai/telemetry` | OpenTelemetry traces, replay, AI execution logs |
| `@finsavvyai/policy-engine` | PipeWarden OSS rule engine, governance / PR checks |
| `@finsavvyai/ai-gateway` | Provider routing, retries, semantic cache, model selection |

## Commands

Run from the repo root. Requires Node ≥20 and pnpm ≥9.

```bash
pnpm install              # install workspace deps (CI uses --frozen-lockfile)
pnpm build                # pnpm -r build  → tsc per package to dist/
pnpm typecheck            # pnpm -r typecheck → tsc --noEmit per package
pnpm test                 # pnpm -r test → vitest run per package
pnpm test --coverage      # run with v8 coverage + thresholds (what CI runs)
pnpm clean                # remove dist/ and *.tsbuildinfo
```

Single package or single test (vitest is configured at the root):

```bash
pnpm --filter @finsavvyai/auth test          # one package
pnpm vitest run packages/auth/src/jwt.test.ts # one test file
pnpm vitest run -t "verifyToken rejects"      # by test name
pnpm vitest                                    # watch mode
```

Note: `pnpm lint` is wired in the root `package.json` (`pnpm -r lint`) but **no package defines a `lint` script and there is no linter configured** — it is currently a no-op. Type safety is enforced entirely by `tsc` strict mode, not a linter.

## CI gates (`.github/workflows/ci.yml`)

PRs must pass two jobs:
- **build-test**: `typecheck` → `build` → `test --coverage` (coverage thresholds are enforced and will fail the build).
- **security**: `pnpm audit --audit-level=high` and a `gitleaks` secret scan.

Per `README.md`: no critical/high vulns at release; audit logs required for auth events, admin actions, and sensitive mutations.

## Architecture & conventions

These cut across files and are the most important things to internalize before editing.

**Ports-and-adapters / dependency injection.** Each package defines its contracts as TypeScript `interface`/`type` in `src/types.ts` (e.g. `SemanticCache`, `JtiRevocationStore`, `UserResolver`, `RbacEvaluator`, `PolicyRule`, `ProviderAdapter`). The package ships only **reference implementations** named by prefix — `InMemory*` (e.g. `InMemorySemanticCache`, `InMemoryTracer`), `Static*` (`StaticRbac`, `StaticEntitlements`), `Null*` (`NullJtiStore`) — and consumers inject their own production-grade implementations (real DBs, real provider SDKs, real KV stores). When adding a capability, define the interface first, then provide an in-memory reference impl; do not hardcode infrastructure.

**`src/index.ts` is re-exports only.** It is excluded from coverage and `build`-emit conventions. Add new public API by exporting it here explicitly; types are re-exported alongside their values.

**Errors as values, not exceptions, on expected paths.** Public operations return discriminated-union result types instead of throwing for anticipated failures — e.g. `verifyToken` returns `{ ok: true; claims } | { ok: false; error: AuthError }`, and the policy engine returns `{ decision: "allow" | "warn" | "deny"; violations }`. Exceptions (`throw`) are reserved for programmer/config errors (e.g. constructing `AiGateway` with zero adapters). Follow this pattern for new APIs.

**Strict ESM with explicit `.js` import specifiers.** `package.json` sets `"type": "module"`; tsconfig uses `module: ESNext`, `moduleResolution: Bundler`, and `verbatimModuleSyntax: true`. Relative imports **must** carry the `.js` extension even though the source is `.ts` (e.g. `import { signToken } from "./jwt.js"`). Type-only imports **must** use `import type { ... }` (enforced by `verbatimModuleSyntax`).

**`exactOptionalPropertyTypes` shapes how optionals are built.** Because optional properties cannot be assigned `undefined`, conditionally include them via object spread rather than setting them to `undefined`:
```ts
const opts: VerifyOptions = {
  issuer, audience,
  ...(config.revocations ? { revocations: config.revocations } : {}),
};
```
Also note `noUncheckedIndexedAccess` is on — index access yields `T | undefined`, so non-null assertions (`adapters[0]!`) appear deliberately after a length check.

**Immutability.** Prefer `readonly` on type members and `readonly T[]` for array params/fields throughout (consistent across all packages).

## Package layout & testing

Every package is identical in shape: `src/` with `index.ts`, `types.ts`, implementation files, and **colocated `*.test.ts`** files (vitest, `environment: "node"`, `globals: false` — import `describe`/`it`/`expect` from `vitest`). The root `vitest.config.ts` is the single source of truth for test discovery and coverage; there are no per-package vitest configs. Each package `tsconfig.json` extends `../../tsconfig.base.json` and excludes `**/*.test.ts` from the build.

Coverage thresholds (root `vitest.config.ts`): **lines 90 / branches 85 / functions 90 / statements 90**. `index.ts` and `*.test.ts` are excluded from coverage. Per `README.md`, critical paths (auth, billing writes, policy decisions) target **100%** coverage.

## Hard rules (from README)

- TypeScript strict mode; **200-line cap per file** — split modules rather than growing a file past it.
- Coverage thresholds above are non-negotiable gates.
- No critical/high vulnerabilities at release.
- Emit audit logs for auth events, admin actions, and sensitive mutations.

## Git workflow

Develop on the designated feature branch; create it locally if missing. Commit with clear messages and push with `git push -u origin <branch>`. Do **not** open a pull request unless explicitly asked.
