# Products Keep-Alive Plan

Last updated: 2026-06-11

Goal: each product ships independently, no cross-coupling, shared quality gates.

## Anatomy (actual on-disk state, 2026-06-11)

All products and packages are **regular tracked directories**, not submodules.
There is no `.gitmodules` and no `apps/` directory — Brain lives under
`products/amliq/brain/`. The submodule migration below is **proposed, not
executed.**

```text
finsavvyai-platform/
├── packages/                       shared platform services
│   ├── auth                        @finsavvyai/auth — JWT verify, role gates
│   ├── billing                     @finsavvyai/billing — LemonSqueezy
│   ├── telemetry                   @finsavvyai/telemetry — OTel, replay
│   ├── policy-engine               @finsavvyai/policy-engine — PipeWarden OSS
│   ├── ai-gateway                  @finsavvyai/ai-gateway — provider routing
│   ├── shared-types                cross-product types (AML decisions, etc.)
│   └── aml-screen-client           AMLIQ /screen TS client
├── products/
│   ├── amliq/                      api + web + engines + internal + brain/
│   ├── opensyber/
│   ├── tenantiq/
│   ├── qestro/
│   ├── pushci/
│   ├── queryflux/                  Go backend + TS web + CF workers
│   ├── sdlc-ai/                    TS, LAM patterns
│   ├── sdlc-cc/                    TS, Claude Code tooling
│   ├── finsavvy-cluster/           Go mesh + Brain bridge
│   └── lunaos/                     TS, monorepo-only (no standalone)
├── oss/                            a2a-framework, automationhub, clawpipe,
│                                   design-system, finsavvy-rag, mcp-tooling,
│                                   pipewarden, tokenforge, homebrew-pipewarden
├── websites/                       finsavvyai.com marketing
├── infrastructure/                 CF + observability manifests
├── docs/                           compliance, runbooks, trackers
├── tools/                          readiness validators
└── _archive/                       migration snapshots
```

## Dual-presence products (PROPOSED submodule pattern — not yet implemented)

Six products are believed to have own GitHub repos AND evolve here. As of
2026-06-11 the monorepo still tracks each as a plain directory; converting them
to submodules is an open migration task, not a completed one.

| Product | Monorepo path | Standalone repo | Standalone path | Note |
|---|---|---|---|---|
| amliq | `products/amliq` | `github.com/finsavvyai/amliq` | `~/dev/projects/portfolio/aegis` | standalone led at last check (BEACON perf baseline) |
| opensyber | `products/opensyber` | `github.com/finsavvyai/opensyber` | `~/dev/projects/portfolio/opensyber` | standalone led (compete-plan routes) |
| tenantiq | `products/tenantiq` | `github.com/finsavvyai/tenantiq` | `~/dev/projects/portfolio/tenantiq` | standalone led (agent runtime) |
| qestro | `products/qestro` | `github.com/finsavvyai/questro` (typo) | `~/dev/projects/portfolio/qestro` | standalone led (WCAG pass, a11y) |
| pushci | `products/pushci` | `github.com/finsavvyai/pushci` | `~/dev/projects/portfolio/pushci` | standalone led (week1 discovery undo) |
| clawpipe | `oss/clawpipe` | `github.com/finsavvyai/clawpipe` | `~/dev/projects/portfolio/clawpipe` | standalone led (no-bluf SOC2 sweep) |

Monorepo copies originated as snapshots from round-4 migration (`b03e7b96f`),
except pushci (touched at `7f0b994a5`). File counts in this table were dropped
because they drift; re-measure before acting on a migration.

Monorepo-only (no standalone): `queryflux`, `sdlc-ai`, `sdlc-cc`,
`finsavvy-cluster`, `lunaos`, `websites/finsavvyai.com`.

Open questions:
- `qestro` GitHub repo is `questro` (extra "u"). Rename GitHub repo OR accept URL mismatch in submodule config.
- `clawpipe` lives in `oss/` not `products/`. Keep in `oss/` to mark "OSS sibling" OR move to `products/clawpipe`.

### Proposed decision: git submodule (NOT YET DONE)

Submodule would beat subtree here because standalones already lead. Monorepo
would reference each product at a pinned commit; standalone keeps own cadence +
own CI + own deploy. **Status: not executed — no `.gitmodules` exists yet.**

### Migration steps (per product)

1. Diff monorepo copy vs standalone; cherry-pick missing commits into standalone first
2. `git rm -r products/<name>` + commit "convert to submodule"
3. `git submodule add -b main git@github.com:finsavvyai/<name>.git products/<name>`
4. `cd products/<name> && git checkout <tag>` then commit submodule pin
5. Update CI: `actions/checkout@v4` with `submodules: recursive`
6. Repeat for opensyber + tenantiq

### Workflows after migration

| Task | Where |
|---|---|
| Evolve feature | standalone repo, push to GitHub |
| Bump in monorepo | `cd products/amliq && git fetch && git checkout <tag> && cd - && git add products/amliq && git commit` |
| Integration tests cross-product | monorepo CI clones all submodules |
| Shared-package change | edit `packages/*`, monorepo CI runs against submodule HEAD, bump submodule when product absorbs |
| Release standalone | tag in standalone, deploy from standalone CI |

### Why not subtree

Subtree mirrors history into monorepo. Heavier diffs. Easier daily edits but harder version bumps. Use when monorepo is the daily-driver and standalone is occasional export. Reverse of current reality.

## Separation rules

| Layer | Rule |
|---|---|
| Types | cross-product → `packages/shared-types`. in-product → local. |
| Code | no product imports another product directly. always via `packages/*`. |
| DB | each product owns own schema. shared = audit sink + auth subjects. |
| CI | `paths-filter` per product. amliq PR ≠ queryflux build. |
| Releases | independent tags (`amliq-v1.2`, `queryflux-v0.7`). no monorepo bump. |
| Secrets | per-product namespace. only auth + billing shared. |

## Quality floors (per portfolio CLAUDE.md)

- ≥90% line, ≥85% branch overall
- 100% critical paths (auth, payments, audit, policy, security)
- 200-line file cap (new code)
- Critical/High vuln = release block, no waiver
- SAST + deps + secrets + license scans per PR
- No merge on red CI

AMLIQ raises bar: 100% on decision + audit + auth surfaces. Audit emit failure blocks response. PII-free reason codes.

## Forward queue

Ordered by blast radius (smallest first).

### P1 — queryflux integrations

| # | Item | Order | Blast |
|---|---|---|---|
| P1-1 | auth chain: local SSO → `@finsavvyai/auth` | seq (blocks P1-3, P1-4) | medium |
| P1-3 | telemetry: OTel via shared collector | seq after P1-1 | low |
| P1-4 | policy: `actor_id` from auth → audit | seq after P1-1 | low |
| P1-2 | billing: local LemonSqueezy → `@finsavvyai/billing` | parallel | medium |
| P1-5 | ai-gateway: route via shared CF worker | parallel | low |
| P1-6 | pnpm-workspace globbing cleanup | parallel | trivial |

### P2 — AMLIQ cleanup

| # | Item | Notes |
|---|---|---|
| P2-1 | Go module rename: `quantumbeam` → `github.com/finsavvyai/amliq/engines/quantumbeam` | drops go.work workaround. heavy diff, own PR. |
| P2-2 | legacy_migrated cleanup (~80 files) | validator/v10 drift, sqlx, OTel SDK. chunked PRs. |
| P2-3 | CI sdlc-core pin to tag | determinism. |
| P2-4 | dead `EmbeddingMatcher` stub removal | `embedding.go` unused. |
| P2-5 | dead `query_expander.go` removal | only own test calls it. |

### P3 — Cluster + sibling products

| # | Item | Notes |
|---|---|---|
| P3-1 | finsavvy-cluster Brain GA | 4 blockers: JWT accept, OpenAI-compat completions, mesh /health, env config. |
| P3-2 | sdlc-cc unification | 7 tracks. |
| P3-3 | sdlc-ai decouple | `services/lam-pattern-sharing.js` cross-couples to queryflux. |
| P3-4 | enhanced_query_executor_test.go split | 372 lines, over cap. |

### Backlog (no urgency)

- GitHub Actions billing unblock (Health Check workflow)
- 6 queryflux dirs over ≤9 target (tests/docs/infra)
- enhanced_query_executor.go deletion after transitive-consumer audit

## Cadence

| When | What |
|---|---|
| Per PR | paths-filter CI: build + unit + integration + SAST + deps + secrets + license |
| Daily | green-watch dashboard per product |
| Weekly | `pnpm -r outdated` + coverage drift report |
| Monthly | `go work sync` + dep-vuln re-audit |
| Per release | product-specific checklist (AMLIQ SOC 2 evidence; queryflux CF deploy validation) |

## Audit sink

Every product writes to `FINSAVVY_AUDIT_SINK`. Shared shape, isolated event namespaces:
- `aml.*` — AMLIQ decisions, investigations, case updates
- `qf.*` — queryflux query exec, billing, policy
- `auth.*` — cross-product auth grants/denies
- `billing.*` — LemonSqueezy webhooks

## Risk levers (do NOT)

- fold products into unified version
- share DBs (only contracts)
- skip 200-line cap during refactor
- merge red CI
- waive Critical/High vulns

## Session log

Session 2026-05-29 → 2026-05-30 closed 10 commits on top of `7f0b994a5`:
- `shared-types` AMLIQ decision contracts
- `aml-screen-client` TS package
- critical-path branch coverage 100% × 6 packages
- AMLIQ Go workspace + quantumbeam build unblock
- AMLIQ `/screen` public demo + embedding + Unicode normalizers
- CI `amliq-go` paths-filter job
- queryflux P0: sdlc-ai relocated, Go deduped, Electron archived
- queryflux tree restructure 32 → 14 dirs
- queryflux P0-2 + P0-3a + infra fold
- queryflux/backend stale test rewrite vs SafeQueryRunner

Full monorepo green: TS typecheck (9 pkgs), 772 TS tests, AMLIQ + quantumbeam Go, 28/28 `/screen` fixtures, queryflux backend.

## Pick next

Default: **P1-1 queryflux auth chain** (unblocks P1-3 and P1-4).
Override: any P1/P2/P3 item.
