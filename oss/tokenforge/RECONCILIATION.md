# TokenForge Reconciliation

**Status:** OPEN — deferred architectural decision. This document records the
findings and the recommended direction. It does **not** perform the merge.

Last reviewed: 2026-06-13

---

## TL;DR

There are two TokenForge codebases in this monorepo. They have diverged. The
**`@opensyber` fork is canonical** (published + consumed); the `oss/tokenforge`
copy is an earlier reference skeleton. The GTM plan calls for ONE session-security
package folded into `packages/auth`, renamed off the external `tokenforge.io`
collision. That fold is the decision left for the maintainer — see
[Decision left for the user](#decision-left-for-the-user).

---

## The two copies

| | Canonical | Reference skeleton |
|---|---|---|
| Path | `products/opensyber/packages/tokenforge` | `oss/tokenforge` (this dir) |
| Package name | `@opensyber/tokenforge` | `tokenforge-monorepo` (private, root) |
| Version in source | `1.0.0` | `0.1.0` |
| Published to npm | **Yes** — `@opensyber/tokenforge@0.1.2` | No (`private`) |
| Consumed by a product | **Yes** — TenantIQ | No |
| Layout | single package, `exports`-mapped subpaths | pnpm monorepo: `browser` / `hono` / `protocol` / `db` |
| Non-test source files | 53 | 31 |
| Test files | 51 | 19 |

### Why `@opensyber` is canonical (evidence)

1. **Published + version-pinned by a live product.** TenantIQ depends on it:
   - `products/tenantiq/web/package.json:49` → `"@opensyber/tokenforge": "^0.1.2"`
   - `products/tenantiq/apps/web/package.json:47` → same
   - `products/tenantiq/web/package-lock.json:889` → resolved from
     `registry.npmjs.org/@opensyber/tokenforge/-/tokenforge-0.1.2.tgz` (real npm tarball, integrity hash present).
2. **Imported in product code:**
   - `products/tenantiq/.../lib/utils/tokenforge-bind.ts` → `import { TokenForge } from '@opensyber/tokenforge/client'`
   - `products/tenantiq/apps/api/src/middleware/tokenforge-opensyber.ts` vendors
     `@opensyber/tokenforge@0.1.1 dist/server/middleware.js`.
   - `products/pushci/api/src/security/totp.ts` is vendored from
     `@opensyber/tokenforge v0.1.1 (packages/tokenforge/src/server/totp.ts)`.
3. **`@opensyber/tokenforge` is named the extraction SOURCE for shared auth.**
   `products/opensyber/SPRINTS.md:14`: "OpenSyber has `@opensyber/tokenforge` in
   `/packages/tokenforge/` — THIS IS THE SOURCE for the shared auth npm package."
4. **Active development.** CHANGELOG shows 1.0.0 GA (2026-05-08) with Sprint
   36/37/39 work (Workforce SSO, W3C DBSC, AitM detection). Sprint PLAN/no-bluf
   logs reference 600+ passing tests in `@opensyber/tokenforge` / `-api`.

By contrast, every reference to `oss/tokenforge` in the platform is a **planning
note** describing it as an OSS "Telemetry SDK, maintain / no feature push"
(`stall_map.md`, `products_ranking_may2026.md`,
`finsavvyai_consolidation_plan_addendum.md`). TenantIQ's own README
(`README.md:107-108`) and MIGRATION_NOTES say the goal is to replace the external
`@opensyber/tokenforge` dep "with the workspace `oss/tokenforge/` package **once
published**" — i.e. `oss/tokenforge` is an aspirational future target that is not
yet published or consumed. The note in this skeleton's own `MIGRATION_NOTES.md`
also positions it as copy-only, reconciliation-deferred.

---

## Public API surface diff

The two are **not drop-in compatible**. Different package layout, different
export names, different breadth.

### Canonical `@opensyber/tokenforge` — 14 export subpaths

`./client`, `./server`, `./server/internal`, `./server/storage`,
`./storage/internal`, `./webhooks`, `./react`, `./shared`, plus six framework
adapters: `./hono`, `./express`, `./nextjs`, `./fastify`, `./sveltekit`, `./astro`.

Key public symbols:
- **client:** `class TokenForge`, `createTokenForge(config)`
- **server:** `tokenForgeMiddleware`, `TokenForgeOptions`, `AttestationVerifyResult` (+ webauthn-verify exports)
- **react:** `TokenForgeProvider`, `useTokenForge`
- **shared:** `TokenForgeConfig`, `DbscConfig`, `TokenForgeServerOptions`,
  `TokenForgeStorageRef`, `SecurityEvent`, `SecurityEventType`, `TrustSignals`,
  `ScoreBreakdown`, `DeviceSession`, `TF_HEADERS`
- **adapters:** `honoMiddleware`, `expressMiddleware`, `withTokenForge`/`tokenForgeCheck`,
  `tokenForgePlugin`, `tokenForgeHandle`, `astroMiddleware`, plus `requireFreshSig` per framework
- Has source for: AitM heuristics, step-up policy, OIDC verify, SAML, DBSC
  challenge/verify, TOTP, WebAuthn attestation, CBOR, webhooks, trust-score histograms.

### Reference `oss/tokenforge` — 4 workspace packages

- **`browser`:** `SDK_VERSION`, `class TokenForge`, `signDpop`,
  `makeInterceptingFetch`, `bindViaWebCrypto`, `RegisterError`,
  `detectNativeDbsc`, `primeNativeDbsc`
- **`hono`:** `tokenforge` (middleware), `TokenForgeClient`, `toSetCookie`,
  `clearCookie`, error/option/result interfaces
- **`protocol`:** re-exports types, crypto, jws-verify/sign, jwk, bound-cookie,
  dbsc-challenge, dbsc-registration, policy, oidc-verify, oidc-discovery
- **`db`:** drizzle schema + `drizzle` (D1)

### Overlap / divergence summary

- **Conceptual overlap:** both implement device-bound sessions (ECDSA P-256),
  DBSC challenge/registration, bound cookies, OIDC verify, trust/policy.
- **Naming divergence:** canonical exports `tokenForgeMiddleware` /
  `createTokenForge`; skeleton exports a `tokenforge` Hono middleware and a
  `TokenForgeClient` class. Class `TokenForge` exists in both but with different
  surrounding API.
- **Canonical is a strict superset in capability:** Workforce SSO (5 OIDC IdPs +
  SAML), AitM detection (9 signals), per-route step-up, WebAuthn attestation,
  webhooks, 6 framework adapters, React provider, multiple storage backends.
  The skeleton has none of the adapters, no React, no webhooks, no AitM/step-up,
  no SAML.
- **Layout divergence:** consumers `import from '@opensyber/tokenforge/client'`
  etc. (single package, subpath exports). The skeleton would require
  per-workspace package imports (`@tokenforge/client`, `@tokenforge/server` per
  the README quick-ref — note even those names don't match the published one).

**Conclusion:** migrating consumers from canonical to skeleton would be a rewrite,
not a swap. Any consolidation must move FROM canonical, not toward the skeleton.

---

## Rename requirement (`tokenforge.io` collision)

The product name "TokenForge" / the `tokenforge.io` domain collides with an
external project. The GTM plan requires the in-platform package to be **renamed
off that collision** before launch. The session-security primitive should be
folded into `packages/auth` under a non-colliding name.

This rename touches, at minimum:
- npm package name (currently `@opensyber/tokenforge`)
- the `exports` subpath imports in TenantIQ
  (`@opensyber/tokenforge/client`, `/server`) and the vendored copies in
  `tenantiq/apps/api` and `pushci/api`
- `homepage` / `repository` / `bugs` URLs in
  `products/opensyber/packages/tokenforge/package.json` (currently
  `tokenforge.opensyber.cloud`, `github.com/opensyber/tokenforge`)
- the runtime endpoint `tokenforge-api.opensyber.cloud`
  (`tenantiq/apps/api/src/middleware/tokenforge-opensyber.ts:11`)
- DB column/table prefixes `tokenforge_*` / `tf_*` (a data migration, if renamed there too)

None of these are changed by this document.

---

## Recommended directionality (advisory)

1. **Canonical = `@opensyber/tokenforge` (the published, consumed fork).** Treat
   it as the single source of truth for the session-security primitive.
2. **`oss/tokenforge` becomes a published view of the canonical code, not a
   parallel implementation.** Either (a) retire the skeleton and re-derive any
   OSS-public surface from canonical, or (b) keep it strictly as docs/reference.
   Do not let consumers depend on it as-is.
3. **Consumers depend on the renamed `packages/auth` session module**, which
   wraps/re-exports the canonical implementation. TenantIQ, PushCI, and the
   vendored middleware migrate to that single import once the rename lands.
4. **Direction of dependency:** `packages/auth` (or the renamed package) owns the
   canonical code; products depend on it. The OSS skeleton, if kept, depends on
   nothing and is not depended upon.

---

## Decision left for the user

This is the deferred architectural decision — intentionally NOT executed here:

1. **Where does the canonical code live after the fold?** Confirm it moves into
   `packages/auth` (per GTM) versus staying at
   `products/opensyber/packages/tokenforge`.
2. **What is the new (collision-free) name?** Choose the npm name + public domain
   to replace `@opensyber/tokenforge` / `tokenforge.io` / `tokenforge.opensyber.cloud`.
3. **Fate of `oss/tokenforge`:** retire, or keep as reference-only, or re-derive
   as the published OSS surface of the canonical code.
4. **Consumer migration sequencing:** how/when TenantIQ (`^0.1.2`), the vendored
   `tenantiq/apps/api` middleware, and `pushci/api/src/security/totp.ts` cut over —
   without breaking working imports.
5. **DB rename scope:** whether `tokenforge_*` / `tf_*` schema prefixes are renamed
   (requires a data migration) or left in place.

Until those are decided, **both codebases remain in place and no `packages/auth`
changes are made.**

---

## What was done in this pass (safe only)

- Added a canonical-vs-skeleton banner to `oss/tokenforge/README.md`.
- Wrote this `RECONCILIATION.md`.
- **No** deletions, **no** `packages/auth` edits, **no** import/dependency changes.
