# Visual Regression Tests

Pixel-comparison tests for the OpenSyber dashboard. Catches unintended UI
regressions in layout, typography, colors, and component positioning.

## What is covered

| Page                        | Spec                      | Mocked APIs |
|-----------------------------|---------------------------|-------------|
| `/dashboard`                | `dashboard-home.spec.ts`  | metrics, agents, alerts, notifications |
| `/dashboard/security`       | `dashboard-home.spec.ts`  | metrics |
| `/dashboard/marketplace`    | `marketplace.spec.ts`     | marketplace skills, bundles, installed |
| `/admin/metrics`            | `admin-metrics.spec.ts`   | admin metrics, health |

Each spec also captures component-level snapshots (sidebar, skill card, KPI grid)
so that partial regressions are localized.

## How it works

1. **Auth** — tests use a pre-captured Auth.js session stored at
   `apps/web/e2e/.auth/user.json`. You must generate it once via the existing
   `auth-setup.spec.ts` (see `e2e/fixtures/auth.ts`).
2. **API mocks** — `mocks.ts` intercepts the page's API calls and returns
   fixed fixtures so the data is deterministic across runs.
3. **Stabilization** — `stabilizePage()` disables animations, hides skeletons
   and live timestamps, waits for fonts, and for `networkidle`.
4. **Comparison** — `page.screenshot()` + `toHaveScreenshot()` compare against
   committed baselines under `*-snapshots/` with a 2% max pixel tolerance
   (`maxDiffPixelRatio: 0.02`).

## Running locally

You need a running dev server on `http://localhost:3000`:

```bash
# terminal 1
pnpm --filter @opensyber/web dev

# terminal 2 — once you have an auth file
pnpm --filter @opensyber/web test:visual
```

### Scripts

| Script | Purpose |
|--------|---------|
| `pnpm test:visual`         | Run visual tests against local dev server. |
| `pnpm test:visual:update`  | Update baselines after an intentional UI change. |
| `pnpm test:visual:ui`      | Open the Playwright UI runner for debugging. |

## Generating baselines

**Baselines are NOT committed to git** (see `.gitignore`). They are generated
on first CI run for a branch and uploaded as a CI artifact. This avoids
bloating the repo with binary files that diff poorly.

To generate locally before pushing:

```bash
pnpm --filter @opensyber/web test:visual:update
```

In CI, add a job step:

```yaml
- name: Visual regression
  run: pnpm --filter @opensyber/web test:visual
- name: Upload snapshots on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: visual-diffs
    path: apps/web/test-results/
```

## Updating snapshots after a UI change

1. Make the intentional UI change.
2. Run `pnpm test:visual:update` locally to refresh baselines.
3. Review the new PNGs in the `*-snapshots/` folders (Playwright will print
   their paths) — make sure every diff was intentional.
4. Upload the updated snapshots as a CI artifact, or commit them explicitly
   if your team chooses to track baselines in git.

## Tolerance settings

The config at `apps/web/playwright.config.ts` applies `maxDiffPixelRatio: 0.02`
globally for `toHaveScreenshot` (2% of pixels can differ). Individual tests
can override this per assertion when needed.

Rules of thumb:
- 2% tolerance handles font anti-aliasing and minor browser rendering drift.
- Do NOT raise tolerance above 5% — that hides real regressions.
- Prefer fixing flakiness (mocks, stabilization) over loosening tolerance.

## Troubleshooting

- **Tests fail with "Snapshot does not exist"** — first run, or baselines
  were not generated. Run `test:visual:update`.
- **Tests fail after font install / OS upgrade** — font anti-aliasing
  changes are normal; regenerate baselines.
- **Tests flake on specific elements** — add `[data-dynamic="true"]` to the
  volatile element so `stabilizePage` hides it, or add an API mock.
- **Auth missing** — generate `e2e/.auth/user.json` via `auth-setup.spec.ts`.
