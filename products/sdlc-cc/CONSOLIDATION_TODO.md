# SDLC.cc Consolidation TODO

The three source repos (`sdlc-cc`, `sdlc-core`, `sdlc-platform`) are now co-located under `products/sdlc-cc/` but **NOT API-unified**. Out of scope for round 4. This file is the backlog.

## Current physical layout

```
products/sdlc-cc/                  (was: portfolio/sdlc-cc — Go API + Office add-ins + web)
  cmd/                             (Go entrypoints — keytool, api)
  internal/                        (Go internals)
  core/                            (was: portfolio/sdlc-core — shared Go lib: ai/, audit/, cache/, dlp/, quota/)
  platform/                        (was: portfolio/sdlc-platform — services, apps, dev-portal, extensions)
    services/                      (Go gateway, vector-core (Rust), insights-detector (Python))
    apps/                          (TypeScript apps)
    packages/                      (TypeScript packages)
    extensions/                    (IDE + browser extensions)
    deployments/                   (Terraform + k8s configs)
```

## Unification work (NOT done this round)

### 1. Go module unification

`sdlc-cc/go.mod`, `sdlc-cc/core/go.mod` (was sdlc-core), and `sdlc-cc/platform/services/gateway/go.mod` are separate Go modules. Pick a strategy:

- **Option A:** Single Go module rooted at `products/sdlc-cc/`, with internal Go packages.
- **Option B:** Go workspace (`go.work`) at `products/sdlc-cc/` referencing the three modules.

Recommendation: **Option B** (workspace). Lower risk, lets the three sub-modules evolve independently while sharing dev tooling.

### 2. TypeScript package unification

`platform/packages/` overlaps in namespace (`@finsavvyai/*`) with the monorepo's `packages/` and the F8 design system at `oss/design-system/`. The 37 cross-references must be resolved by either:

- Renaming `platform/packages/*` under a non-collision namespace (e.g., `@finsavvyai-sdlc/*`).
- Or hoisting `platform/packages/*` to monorepo root `packages/` and treating sdlc-cc as a consumer.

The second is cleaner but requires confirming behavior parity with the F8 implementations.

### 3. API unification

`sdlc-cc` (root) exposes a Go API. `platform/services/gateway` exposes an overlapping gateway. Decision needed: which one is canonical? Likely answer is the platform gateway (more mature deployment story), with sdlc-cc/cmd/api absorbed into it.

### 4. Frontend unification

`sdlc-cc/web/` (root) is the React frontend. `platform/apps/` and `platform/developer-portal/` are additional frontends. Routing/auth/branding all need a single source of truth.

### 5. 200-line cap backlog

654 source files exceed the 200-line cap (per portfolio rule). Refactor backlog must be sized before any greenfield work. Suggest a one-week dedicated refactor sprint, file-by-file by ownership.

### 6. Database migrations

`sdlc-cc/migrations/` and `platform/database/` may overlap or conflict. Inventory and merge into a single migration lineage before the first production deploy.

### 7. Build/CI

Currently 3 separate `package.json` + `go.mod` trees. CI pipelines from the source repos won't work as-is. Need a unified Makefile or Taskfile at `products/sdlc-cc/` root.

## Out of scope (this round)

- No code edits to migrated files.
- No package/module renames.
- No dependency upgrades.
- No CI/build pipeline changes.

Round 4 is **physical co-location only**. Logical unification is the next phase.
