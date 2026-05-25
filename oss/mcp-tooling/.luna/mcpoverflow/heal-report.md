# MCPOverflow — Luna Heal Report (re-invocation)

- **Target**: http://localhost:3000 (apps/io, Vite dev server)
- **Date**: 2026-05-22
- **Iterations**: 3 of 5 (stopped early — two consecutive clean passes)
- **Viewports**: mobile 375, tablet 768, desktop 1280, wide 1920
- **Total viewport-route shots / iteration**: 7 routes x 4 viewports = 28
- **Prior run archived**: `.luna/mcpoverflow/browser-test/iterations-prev/{1,2,3}/`

## Regression check vs previous heal run

No structural regressions. The earlier `supabase.ts` fix is still in place — every route renders, no failed module requests. The only fresh issue was the **cosmetic header wrap** flagged last pass, which I treated as a defect this pass.

## What I probed harder this pass

Extended the harness (`heal-runner.mjs`) with three additional probes — no new deps:

1. **Header wrap detector**: Range-based line-box count on text-only descendants of header `<a>`/`<button>` (rejects false positives from icon wrappers and padding-tall pill buttons).
2. **Focus-ring probe**: presses Tab on each viewport, captures `outline` / `box-shadow` on `document.activeElement`.
3. **Contrast probe**: computes WCAG ratio for every `<h1>`/`<h2>` against its effective background, AA threshold (4.5 normal / 3 large), with bold-size weighting.

Note on dark mode: `apps/io` has **no dark-mode classes** (`grep -ri "dark:" apps/io/src` returns zero matches) and Tailwind config has no `darkMode` key. Not applicable — flagged as a future product call.

## Iteration log

### Iteration 1 — 7/28 with issues (header wrap on mobile only)

- All 7 routes wrap "Sign In" / "Sign Up" links on the 375 viewport.
- Tablet, desktop, wide: all green.
- Focus rings: present on first tab stop on all 28 viewport-routes.
- Contrast: all H1/H2 between 16.98 and 17.74 — well above WCAG AAA (7:1).
- No console errors, no failed requests, no overflow, no blank roots, no broken images.

### Fix applied

`apps/io/src/components/Header.tsx` (rewrite, 64 lines — under the 200-line cap):

- `whitespace-nowrap` on every nav text link — eliminates the wrap at the source.
- Responsive paddings: `px-3 sm:px-6` on the outer container, `gap-2 sm:gap-4` on the nav, `px-4 sm:px-6` on the pill buttons.
- Header height drops from `h-20` to `h-16` on mobile to keep generous content tap surface without crowding.
- `shrink-0` on logo icon + nav cluster, `min-w-0` on logo link, `truncate` on wordmark — defensive against future content growth.
- `aria-label="Settings"` added to the icon-only settings button (previously only `title=`, which screen readers do not announce reliably).
- No labels hidden, no copy shortened — preserves HIG clarity.

### Iteration 2 — 28/28 clean

All checks pass at every viewport-route. Header sits on one row at 375 (verified via screenshots `login-mobile.png`, `register-mobile.png`).

### Iteration 3 — 28/28 clean (stability re-run)

Identical clean result.

## Final state per route (all 4 viewports)

| Route | Status |
|---|---|
| `/` | pass |
| `/login` | pass |
| `/register` | pass |
| `/dashboard` -> `/login` (protected) | pass |
| `/generate` -> `/login` (protected) | pass |
| `/connector/:id` -> `/login` (protected) | pass |
| `/settings` -> `/login` (protected) | pass |

## Files changed this pass

- `apps/io/src/components/Header.tsx` — fix header wrap on mobile (64 lines)
- `.luna/mcpoverflow/heal-runner.mjs` — extended probes + system-Chrome fallback (~210 lines; harness, not product code)

Untouched: `services/api-service` (Go), Cloudflare workers, root `package.json`, `vite.config.ts`, `@sentry/core` override, all app pages.

## Artifacts

- This report: `.luna/mcpoverflow/heal-report.md`
- Current iterations: `.luna/mcpoverflow/browser-test/iterations/{1,2,3}/`
- Prior iterations (archived): `.luna/mcpoverflow/browser-test/iterations-prev/{1,2,3}/`
- Harness: `.luna/mcpoverflow/heal-runner.mjs`

## Notes the parent agent may want to act on later (not blockers)

- Settings icon at top-right of authenticated header still relies on `title="Settings"` + the new `aria-label`. Consider a visible label or `:focus-visible` tooltip for better discoverability per HIG.
- No dark-mode token system; if dark mode lands later, the heal harness already has contrast probes ready.
- Authenticated routes were not reachable in this env (no Supabase session) — they correctly redirect to `/login`. To actually exercise `/dashboard`, `/generate`, `/connector/:id`, `/settings`, a future heal pass should seed a JWT or stub the auth context.
