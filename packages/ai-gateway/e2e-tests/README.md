# @finsavvyai/ai-gateway — preserved E2E specs

The source repo (`portfolio/fintech-suite/api-gateway/`) shipped 11 Playwright
spec files (~168 individual `test()` cases) targeting a **deployed worker**
over HTTP. They are valuable as acceptance criteria for the edge layer once
a runtime environment (miniflare/wrangler dev or a staging URL) is wired up,
but they are too heavy to run from this package's unit-test suite today.

## Strategy

We preserved one representative spec — `health.spec.ts` — under
`e2e-tests/preserved/`, with all `test()` blocks wrapped in `describe.skip`
plus a comment explaining the runner requirement. The remaining 10 specs
live in the source repo until the runtime is selected.

To activate:

1. Pick a runner (recommended: `@cloudflare/vitest-pool-workers` + miniflare
   for in-process, or Playwright against `wrangler dev`).
2. Add the runner config to `vitest.config.ts` (or a new `playwright.config.ts`)
   alongside this `e2e-tests/` dir.
3. Replace `describe.skip` with `describe` in the preserved spec.
4. Cherry-pick further specs from
   `portfolio/fintech-suite/api-gateway/e2e-tests/tests/` as needed, rewriting
   PipeWarden-domain assertions (`/api/pipelines`, `/api/auth/login`) to the
   AI-gateway surface (`/v1/complete`, `/health`).

## What was NOT migrated

The PipeWarden-specific specs (auth flow, pipeline CRUD, GitLab integration,
billing, AI review) belong with the PipeWarden product package, not the AI
gateway. They are intentionally left in the source repo for that product to
pick up during its own promotion.
