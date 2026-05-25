# A11Y_AUDIT — WCAG 2.1 AA + Apple HIG static review

**Agent:** A11Y-AUDIT (Quality Swarm)
**Date:** 2026-05-25
**Method:** static analysis only (no browser, no axe-core, no Playwright).
**Scope-rationale:** websites/finsavvyai.com/CLAUDE.md §"Test matrix" exempts `.astro` files from Vitest coverage in exchange for blocking a11y audits. This report is that substitute control for the current scaffold round. See `COVERAGE_MAP.md` ([[TEST-COVERAGE-MAP]]) for the formal exception.

## Files audited (14)

```
websites/finsavvyai.com/src/
  layouts/Default.astro
  pages/index.astro
  pages/pricing/index.astro                  (mtime stable, included)
  components/Hero.astro
  components/pricing/PricingCard.astro
  components/pricing/FeatureRow.astro
  components/pricing/CtaButton.astro
products/amliq/brain/web/src/
  layouts/Default.astro
  pages/index.astro
  pages/search.astro
  components/SearchInput.astro
  components/ResultCard.astro
  components/CitationPill.astro
products/amliq/api/decision/web/src/      (mtime > 5 min stable — included)
  layouts/Investigate.astro
  pages/investigate/index.astro
  pages/investigate/audit.astro
  pages/investigate/case/[id].astro
  components/{CaseRow,DecisionPill,EngineScoreBadge,AuditChainViewer}.astro
```

## Findings table (severity: H=release-blocking AA fail, M=AA risk, L=polish)

| # | File | Category | Sev | Finding | Recommendation |
|---|------|----------|-----|---------|----------------|
| 1 | websites/.../layouts/Default.astro | Landmark | H | No `<header>`, `<nav>`, `<footer>` — only `<main>` + skip-link. WCAG 1.3.1 / 2.4.1 fail once site has more than one page. | eng: add `<header>` + `<nav aria-label="Primary">` + `<footer>` slots; mirror brain/Investigate layouts. |
| 2 | websites/.../pages/pricing/index.astro | Heading | M | Section h2 `id="tiers"` is `.sr-only` then PricingCard emits an h2 for each tier — two visible h2s and a hidden one collide. | eng: change hidden h2 to a `role="region"` aria-label OR make first h2 visible. |
| 3 | brain/.../pages/search.astro | Heading | H | Page has NO `<h1>` (SearchInput only carries a label; ResultCard uses `<h3>`). Skips h1→h3. WCAG 1.3.1 fail. | eng: add visually-hidden `<h1 class="sr-only">Search results for {q}</h1>` (or visible). |
| 4 | brain/.../components/ResultCard.astro | Heading | M | `<h3>` inside `<article>` but nearest parent heading is page h1; missing h2 wrapper section. | eng: wrap results in `<section aria-labelledby>` with an h2, then keep h3. |
| 5 | brain/.../layouts/Default.astro + websites/.../layouts/Default.astro | Landmark | M | No `<footer>` element anywhere. WCAG 1.3.1 (advisory) + Apple HIG content-first parity gap. | eng: minimal footer with copyright + privacy link. |
| 6 | websites/.../components/pricing/FeatureRow.astro:44 | Contrast | H | Muted "—" cells use `text-ink-900/40 dark:text-ink-50/40` — 40% alpha ≈ 2.5–3:1 on bg. WCAG 1.4.3 fails (4.5:1 required for normal text). | designer: bump muted cells to `/55` minimum and verify against ink-50/ink-900 tokens. |
| 7 | websites/.../components/pricing/PricingCard.astro:77 | Contrast | M | `text-ink-900/55` and `/60` for secondary text — borderline depending on ink-900 hue. Likely passes if pure black, fails if ink-900 = #0a0a0c at ≤60%. | designer: measure actual computed colours; raise to `/70` if <4.5:1. |
| 8 | websites/.../layouts/Default.astro:32 + brain + Investigate | Focus indicator | M | Skip-link focus state uses `focus:rounded focus:bg-ink-900` but no `outline` or `ring` — relies on bg-colour change only. Modern WCAG 2.4.13 / 2.4.7 wants a visible non-color-only indicator. | eng: add `focus:outline focus:outline-2 focus:outline-accent-500` to skip-link. |
| 9 | All Astro files | Reduced motion | M | `transition-colors` used on every interactive element with no `motion-safe:` / `motion-reduce:` guards. Currently benign (only color), but CLAUDE.md mandates "respect prefers-reduced-motion" for any future animation. | eng: add tailwind plugin `@media (prefers-reduced-motion)` rule or `motion-safe:transition-colors` convention now to prevent regressions. |
| 10 | brain/.../layouts/Default.astro:38 + Investigate.astro:49 | ARIA | L | Dev banner uses `role="status"` — correct, but no `aria-live` polite explicit. `role=status` implies polite, so OK; flag for clarity. | eng: optional `aria-live="polite"` for screen reader consistency across NVDA/JAWS. |
| 11 | websites/.../components/Hero.astro | Headings | L | h1 ok; surrounding eyebrow `<p>` could be sr-only-paired with h1 via `aria-describedby` — not required. | designer: leave as-is, polish only. |
| 12 | brain/.../pages/index.astro:50 + Investigate.../pages/.../[id].astro:54 | Focus visibility | L | "Try" pills and Back links use `focus:ring-2 focus:ring-accent-500/40` — 40% alpha on accent token may fall below 3:1 against bg. | designer: verify accent-500 token; raise to `/60` if needed. |
| 13 | websites/.../pricing/index.astro | Apple HIG | L | "Recommended" badge ships visually in PricingCard via `badge` prop, but pricing/index.astro doesn't set a recommended tier in the code path shown. Audit assumes TIERS data sets it. | founder: confirm tiers.ts marks one tier `highlight: true` with `badge: "Recommended"`. |
| 14 | All forms (currently 1: SearchInput) | Labels | ✅ | `<label for="q" class="sr-only">` present; form has `role="search"`. PASS. | none. |
| 15 | All images | Alt text | ✅ | No `<img>` tags in scope (only SVGs, all `aria-hidden="true"` with text label sibling). PASS. | none. |
| 16 | All `<html>` | Lang | ✅ | All three layouts set `lang="en"`. PASS. | none. |
| 17 | All `tabindex` usage | Keyboard nav | ✅ | No `tabindex="1"+` anti-patterns found. PASS. | none. |
| 18 | Investigate.astro nav | Current page | ✅ | `aria-current="page"` set correctly on active nav item. PASS. | none. |
| 19 | search.astro:60 + investigate/index.astro:38 | Live region | ✅ | `aria-live="polite"` on result-count text — correct. PASS. | none. |
| 20 | All tables | Semantic | ✅ | `<caption class="sr-only">`, `<th scope="col|row">` consistently applied. PASS. | none. |
| 21 | DecisionPill / EngineScoreBadge | Color-only meaning | M | Pill colour conveys risk tier; text label ("LOW/MED/HIGH") is also present — meets WCAG 1.4.1. Verify risk-low/medium/high tokens hit ≥4.5:1 against their `/15` bg tile. | designer: verify computed contrast on `risk-*/15` backgrounds with `risk-*` text. |

## High-severity (release-blocking per portfolio CLAUDE.md "WCAG 2.1 AA blocking")

- **#1** Missing landmarks in finsavvyai.com Default layout (header/nav/footer).
- **#3** brain/search.astro has no h1 — fails heading hierarchy.
- **#6** FeatureRow muted cells fail 4.5:1 contrast.

These three must close before Lighthouse a11y=100 gate (CLAUDE.md §"Test matrix replacement") is wireable.

## Apple HIG gaps

- **Type ramp:** all files rely on tailwind default `font-sans`. CLAUDE.md mandates explicit system stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, ...`). **Verify `tailwind.config.*` extends `fontFamily.sans` with the Apple stack** — out of scope here (config files not audited), but flag. (designer + eng)
- **8pt grid:** spacing values seen (`gap-2 = 8px`, `py-3 = 12px`, `py-12 = 48px`) all multiples of 4 — compliant.
- **Calm / content-first:** no autoplay, no marketing dark patterns, no popovers, no toasts in scaffold — compliant.
- **Light + dark mode:** every component carries `dark:` variants. Compliant.
- **Motion:** none used. Future-proofing via `motion-safe:` (finding #9) recommended.
- **Focus:** present everywhere, but indicator strength (#8, #12) needs validation.

## Recommended remediations by owner

**eng (code):**
1. Add `<header>/<nav>/<footer>` to `websites/finsavvyai.com/src/layouts/Default.astro` (mirror brain layout). — fixes #1, #5.
2. Add visually-hidden `<h1>` to `brain/.../pages/search.astro` and an h2 section wrapper for results. — fixes #3, #4.
3. Add 2px outline to skip-link focus state across all three layouts. — fixes #8.
4. Adopt `motion-safe:transition-colors` convention; document in design tokens. — fixes #9.
5. Resolve pricing-page hidden h2 collision (#2).

**designer (visual):**
1. Raise muted-cell text alpha from /40 → /55+ (FeatureRow #6); validate all `*/40` and `*/55` text against ink-50/ink-900 actual hex with WebAIM calculator. — fixes #6, #7.
2. Verify `risk-low/medium/high` tokens at `/15` bg vs full text colour ≥ 4.5:1 (#21).
3. Verify `accent-500/40` focus ring ≥ 3:1 vs surface (#12).
4. Confirm `tailwind.config` ships explicit Apple system font stack (HIG gap).

**founder (scope):**
1. Confirm pricing TIERS data sets one tier `highlight: true` + `badge: "Recommended"` (#13).
2. Decide whether Lighthouse a11y=100 is a hard release gate before public launch (already implied by CLAUDE.md — confirm).

## Cross-references

- [[TEST-COVERAGE-MAP]] — this audit substitutes for Astro Vitest coverage per `websites/finsavvyai.com/CLAUDE.md` exception. COVERAGE_MAP should cite this report as the compensating control.
- [[DEAD-CODE]] — components `pricing/CtaButton.astro`, `pricing/FeatureRow.astro`, `pricing/PricingCard.astro` are reachable from pricing/index.astro (not orphan). `Hero.astro` reachable from index.astro. All `brain/components/*` reachable from search.astro / index.astro. All `decision/web/components/*` reachable from investigate pages. No a11y-orphan components flagged.
- [[DEPS-AUDIT]] — no a11y-relevant third-party runtime libs in scope (pure Astro + Tailwind). Confirms zero a11y supply-chain surface.
- [[PERF-BENCHMARKS]] — n/a; static a11y findings independent of perf hot paths.

## Out of scope / deferred

- Live axe-core / pa11y run against built HTML (deferred to next round per scope constraint).
- Lighthouse CI wiring (CLAUDE.md release-checklist item; not yet wired).
- `tailwind.config.*` audit of `colors.ink.*`, `colors.accent.*`, `colors.risk.*` token values (config files outside .astro/.html scope).
- products/amliq/api/decision/web/src/pages/investigate/pricing/ — N/A, no pricing under decision.

## Output contract

```
AGENT: A11Y-AUDIT
REPORT FILE: docs/quality/A11Y_AUDIT.md
SCOPE COVERED: 17 .astro files across websites/finsavvyai.com + brain/web + decision/web
HIGH FINDINGS: 3
  1. Missing landmarks in finsavvyai.com Default layout
  2. brain/search.astro missing h1 (skipped hierarchy)
  3. FeatureRow muted cells fail 4.5:1 contrast (text-*/40)
MEDIUM FINDINGS: 8 (heading clashes, focus indicator weakness, color-token verification, reduced-motion guard, footer missing)
LOW FINDINGS: 4 (ARIA polish, font-stack verification, badge wiring confirmation, accent ring verification)
CROSS-REFERENCES: TEST-COVERAGE-MAP (substitute control), DEAD-CODE (component reachability), DEPS-AUDIT (zero supply-chain surface)
RECOMMENDATIONS BY OWNER:
  eng (5 tickets): landmarks, search h1, skip-link outline, motion-safe convention, pricing h2 collision
  designer (4 tickets): contrast bumps, risk-token contrast verify, focus-ring contrast verify, font-stack verify
  founder (2 tickets): confirm pricing highlight tier, confirm Lighthouse a11y=100 release gate
```
