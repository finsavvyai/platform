<!-- cspell:words tenantiq workerd miniflare wrangler vitest -->

# Integration Plan — workers-sdk → tenantiq

## Targets

- Replace `node` test environment with **Workers-runtime tests** via `@cloudflare/vitest-pool-workers`.
- Fix the documentation bluff in `CLAUDE.md` that claims miniflare is in use.
- Add `chrome-devtools-patches` for live remote-Worker debugging.

## Verified current state

- `apps/api/vitest.config.ts:6` — `environment: 'node'`.
- `grep -r vitest-pool-workers --include=package.json .` returns nothing → not currently a dependency.
- `CLAUDE.md` "Testing Strategy → Mocking" says "use miniflare". Mismatch with code.

## Step 1 — Adopt @cloudflare/vitest-pool-workers

- Add to `apps/api/package.json` devDependencies: `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`.
- Replace `apps/api/vitest.config.ts` with the pool config (see workers-sdk's `packages/vitest-pool-workers` example).
- Move existing `apps/api/src/test/` fixtures into the new pool.
- Verify the 1213/1213 test count claim still holds after migration (commit 2999bd5 reports this number; treat it as a regression gate, not a verified fact).

Rough effort: **~2–3 days**.

## Step 2 — Update CLAUDE.md

- After Step 1 lands, the "use miniflare" line in CLAUDE.md becomes truthful — keep it.
- If Step 1 is deferred, change CLAUDE.md to "vitest with node environment; migration to vitest-pool-workers tracked under <task>".

## Step 3 — chrome-devtools-patches

- Wire the patched DevTools into local dev via `wrangler dev --inspect`. Already supported by Wrangler upstream; just document in `CLAUDE.md` `## Commands`.
- For remote inspection: experimental, evaluate before promising. Out-of-scope for v1.

## Step 4 — Skip / deferred

- C3 templates: tenantiq is post-bootstrap; no value.
- pages-shared: internal CF tooling; not needed.

## Risks / unknowns

- `vitest-pool-workers` may not yet support all D1 features tenantiq uses (e.g., specific SQL pragmas). Verify by running the migration on a side branch first.
- Potential coverage threshold failure during migration — CLAUDE.md mandates 90% lines / 85% branches; carry the bar through.
