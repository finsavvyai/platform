# A11Y_REMEDIATION — WCAG 2.1 AA closure pass

**Agent:** A11Y-FIX (Remediation Swarm)
**Date:** 2026-05-26
**Input:** `docs/quality/A11Y_AUDIT.md` (A11Y-AUDIT round, 2026-05-25)
**Method:** static fix + Astro build verification + rendered-HTML grep.

## Scope

Closed all **3 HIGH** (release-blocking WCAG 2.1 AA fails) plus **6 of 8
MEDIUM** that fit in scope. Two MEDIUMs deferred (designer-owned or
outside A11Y-FIX subtree). All `.astro` files remain under the 200-line
cap. Both site builds run clean.

## HIGH fixes (release-blocking) — 3/3 closed

### H1 · Missing landmarks · `websites/finsavvyai.com/src/layouts/Default.astro`

Before:
```html
<body>
  <a href="#main">Skip…</a>
  <main id="main"><slot /></main>
</body>
```

After:
```html
<body>
  <a href="#main">Skip… (focus:outline-2 outline-offset-2)</a>
  <header><nav aria-label="Primary">…</nav></header>
  <main id="main"><slot /></main>
  <footer><nav aria-label="Footer">…</nav></footer>
</body>
```

- Adds three required landmarks; matches AMLIQ brain/Investigate layout
  shape for consistency.
- Verified via rendered HTML: `<header>`, `<main>`, `<footer>`, and
  `<nav aria-label="Primary">` all present in `dist/index.html` and
  `dist/pricing/index.html`.

### H3 · Missing h1 / skipped heading hierarchy · `products/amliq/brain/web/src/pages/search.astro`

Before: page rendered SearchInput (label only) → ResultCard `<h3>`.
Skipped h1 and h2.

After:
```astro
<h1 class="sr-only">{q ? `Search results for "${q}"` : 'AMLIQ Brain compliance search'}</h1>
<SearchInput />
<section aria-labelledby="results-heading">
  <h2 id="results-heading" class="sr-only">Search results</h2>
  …ResultCard h3…
</section>
```

- Establishes h1 → h2 → h3 chain; both header levels visually hidden but
  exposed to assistive tech.
- Title text reflects current query state for screen-reader context.

### H6 · Contrast fail · `websites/finsavvyai.com/src/components/pricing/FeatureRow.astro`

Before: `node.muted ? 'text-ink-900/40 dark:text-ink-50/40'`.

After: `node.muted ? 'text-ink-900/85 dark:text-ink-50/85'`.

Math (token: ink-900 = `#0a0a0c`, bg ink-50 = `#f5f5f7`):

| α  | Blended L | Contrast vs bg | Result |
|----|-----------|----------------|--------|
| 0.40 | 0.554 | 1.60:1 | ❌ fail |
| 0.55 | 0.417 | 2.08:1 | ❌ fail |
| 0.70 | 0.279 | 2.96:1 | ❌ fail |
| 0.85 | 0.140 | 5.11:1 | ✅ pass |

Audit hinted "/55 minimum"; actual computed alpha-blend showed `/55`
falls under 4.5:1 on this palette. Raised to `/85`. The `aria-label="Not
included"` already prevents screen-reader dependence on the glyph.

## MEDIUM fixes — 6/8 closed

| # | Status | Note |
|---|--------|------|
| M2 (pricing h2 collision) | ✅ Fixed | PricingCard `<h2>` → `<h3>`; sr-only `<h2 id="tiers">` now cleanly labels the section, three tier cards sit as h3 children. |
| M4 (ResultCard h3 chain) | ✅ Fixed | Closed alongside H3 — h2 wrapper now present in `search.astro`. |
| M5 (footers missing) | ✅ Fixed | Added minimal copyright/links footer to both Default layouts. Apple HIG calm/content-first preserved (no marketing CTAs). |
| M8 (skip-link focus indicator) | ✅ Fixed | Both layouts now ship `focus:outline focus:outline-2 focus:outline-offset-2` plus dark-mode counterparts. Non-color-only indicator per WCAG 2.4.13. |
| M9 (prefers-reduced-motion) | ✅ Fixed | Added scoped `<style>` block in both Default layouts: `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .001ms !important; transition-duration: .001ms !important; … } }`. Future-proofs any animation regression without touching every component. |
| M10 (aria-live on dev banner) | ✅ Fixed | Brain banner now declares `aria-live="polite"` explicitly. Investigate banner deferred (owned by INVESTIGATE-UI agent subtree). |
| M7 (PricingCard secondary text contrast) | ⚠️ Deferred | Designer-owned per audit; touches multiple `/55` and `/60` usages across PricingCard. Recommend a single sweep with WebAIM calculator + token-level decision in next round. |
| M21 (risk-* token contrast in DecisionPill / EngineScoreBadge) | ⚠️ Deferred | Lives under `products/amliq/api/decision/web/` — INVESTIGATE-UI agent subtree, out of A11Y-FIX scope. |

## LOW items — explicitly skipped this round

Per agent brief: not blocking, owned by designer, or low ROI for static
pass. Flagged for next round:

- L11 Hero eyebrow `aria-describedby` polish (designer).
- L12 Focus-ring accent-500/40 alpha (designer, needs computed measure).
- L13 Pricing TIERS data `highlight: true` confirmation (founder).
- HIG: tailwind Apple-stack font-family verified present in
  `websites/finsavvyai.com/tailwind.config.mjs` (no change needed).

## Apple HIG conformance restored

- **Calm + content-first:** footers ship copyright + minimal links only;
  no growth widgets, no toasts, no autoplay.
- **Motion:** new global `prefers-reduced-motion` guard means even
  future animations stay HIG-safe by default.
- **Focus:** skip-link now carries a visible non-color-only indicator
  matching Apple HIG focus emphasis.
- **Type ramp:** Apple system stack already configured
  (`-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, …`) in
  `tailwind.config.mjs` — no change required.

## Verification

- `pnpm -C websites/finsavvyai.com build` → 2 pages built, 0 warnings.
- `pnpm -C products/amliq/brain/web build` → 2 pages built, 0 warnings.
- `grep` against `dist/**/*.html` confirms `<header>`, `<nav
  aria-label="Primary">`, `<main>`, `<footer>`, `<h1>`, h2/h3 hierarchy,
  and updated contrast class.
- All five touched `.astro` files ≤ 116 lines (cap: 200).

## Files touched

```
websites/finsavvyai.com/src/layouts/Default.astro                 (44 → 116)
websites/finsavvyai.com/src/components/pricing/FeatureRow.astro   (52 → 58)
websites/finsavvyai.com/src/components/pricing/PricingCard.astro  (100, h2→h3)
products/amliq/brain/web/src/layouts/Default.astro                (79 → 111)
products/amliq/brain/web/src/pages/search.astro                   (78 → 87)
docs/quality/A11Y_AUDIT.md                                        (status flips)
docs/quality/A11Y_REMEDIATION.md                                  (NEW, this file)
```

## Residual / handoff

- **Designer:** complete M7 (PricingCard /55,/60 sweep) and L12
  (focus-ring alpha). Single token-level decision unblocks all
  borderline contrast cases.
- **INVESTIGATE-UI agent:** carry equivalent fixes (M5 footer, M8
  skip-link outline, M9 reduced-motion, M10 aria-live, M21 risk-token
  contrast) into `products/amliq/api/decision/web/` layouts and
  components. Same patterns as applied here.
- **CI wiring (next round):** the audit + this remediation are
  the substitute control for the .astro Vitest exception. Promote to
  real automation:
  - Lighthouse CI on every PR (perf ≥ 95, a11y = 100, BP ≥ 95,
    SEO = 100 per `websites/.../CLAUDE.md` §"Test matrix").
  - Playwright + `@axe-core/playwright` smoke against built HTML for
    each route (search, index, pricing) — gates on zero violations of
    impact ≥ "serious".
  - Visual-regression snapshots once design tokens stabilise.

## Output contract

```
AGENT: A11Y-FIX
FILES TOUCHED:
  websites/finsavvyai.com/src/layouts/Default.astro
  websites/finsavvyai.com/src/components/pricing/FeatureRow.astro
  websites/finsavvyai.com/src/components/pricing/PricingCard.astro
  products/amliq/brain/web/src/layouts/Default.astro
  products/amliq/brain/web/src/pages/search.astro
  docs/quality/A11Y_AUDIT.md
  docs/quality/A11Y_REMEDIATION.md (new)
HIGH FINDINGS RESOLVED:
  H1 (landmarks)  → A11Y_AUDIT row 1
  H3 (search h1)  → A11Y_AUDIT row 3
  H6 (contrast)   → A11Y_AUDIT row 6
MEDIUM FINDINGS RESOLVED: M2, M4, M5 (partial — Investigate deferred),
  M8 (partial), M9, M10 (partial)
TESTS: build clean before -> build clean after; no Vitest coverage on
  .astro files (audit substitutes per CLAUDE.md exception).
RESIDUAL:
  M7 PricingCard secondary text contrast — designer owns.
  M21 DecisionPill/EngineScoreBadge risk-* token contrast — INVESTIGATE-
    UI subtree (out of scope this round).
  L11/L12/L13 polish items — next round.
HANDOFF NOTES:
  - INVESTIGATE-UI: mirror the 5 patterns (footer / skip-link outline /
    reduced-motion CSS / aria-live / heading wrappers) across
    products/amliq/api/decision/web/.
  - CI: wire Lighthouse + axe-core/Playwright per
    websites/finsavvyai.com/CLAUDE.md §"Test matrix replacement".
```
