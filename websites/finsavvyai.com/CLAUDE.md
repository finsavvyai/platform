# websites/finsavvyai.com — CLAUDE Rules

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md`. Adds website-
specific rules. Does **not** weaken any rule above.

## Mission

The FinsavvyAI ecosystem homepage. Calm, content-first, fast.

## Target user

Two audiences, single surface:
1. **Developers** evaluating the FinsavvyAI products (PushCI, Qestro,
   LunaOS, OpenSyber, SDLC.cc) — want fast technical clarity.
2. **Operators / investors** evaluating the thesis — want narrative.

## Architecture constraints

- **Astro 4 + Tailwind** only. No React/Vue/Svelte runtime unless a
  specific component requires interactivity AND has no Astro
  alternative.
- **Static output** (`output: 'static'`). No server runtime at this
  scaffold stage.
- **File-size cap**: 200 lines/file (portfolio rule). Astro pages and
  layouts split aggressively into `src/components/*.astro`.
- **No third-party trackers** in the scaffold. Privacy-first by
  default; add only when measurement value is documented.
- **No external CMS** dependencies in the scaffold. Content lives as
  MDX in the repo until justified otherwise.

## Test matrix (coverage exception)

Astro `.astro` components are renderer-managed templates, not
functions. Unit testing them with Vitest provides minimal value vs the
runtime contract (rendered HTML + CSS + accessibility). Per the
portfolio CLAUDE allowance for stricter / different controls:

- **No Vitest unit-coverage gate** on `.astro` files. This is an
  **exception** with stated rationale, not a relaxation.
- **Replaced with** (target — scaffolded in future round):
  - Playwright visual-regression snapshots on every page
  - axe-core / pa11y accessibility audit (WCAG 2.1 AA, blocking)
  - Lighthouse CI thresholds: perf >= 95, a11y = 100, best-practices
    >= 95, SEO = 100 (blocking on PR)
- TypeScript `.ts` utilities — if/when added — DO follow portfolio
  coverage rules (>=90/85, 100% on critical paths).

## Security controls

- **CSP** to be added at deploy time (Cloudflare Pages `_headers`).
- **No secrets** in source. `.env.local` only, never committed.
- **No `dangerouslySetInnerHTML`-equivalent** patterns in Astro
  (`set:html` only with sanitized markdown content).
- **Subresource Integrity** for any third-party script (none in
  scaffold).
- **Output `robots.txt`** is allow-all today; harden before any
  pre-launch staging URL goes public.

## Apple HIG visual / interaction language

- **Type ramp**: system font stack first (`-apple-system,
  BlinkMacSystemFont, SF Pro Text, Inter, ...`). Sizes follow Apple's
  display / title / body progression; no font soup.
- **Color**: calm, ink-on-paper. Limited palette
  (`ink.50` / `ink.900` defined; semantic colors added only when
  proven necessary). Respect `prefers-color-scheme`.
- **Motion**: meaningful only. No autoplay animations in scaffold.
  When animation arrives, respect `prefers-reduced-motion`.
- **Spacing**: generous; whitespace is a feature.
- **Focus**: visible focus rings; skip-link present on every page
  (already in `Default.astro`).

## Accessibility — WCAG 2.1 AA (blocking)

- Color contrast >= 4.5:1 for text, >= 3:1 for large text.
- All interactive elements keyboard reachable.
- Landmarks (`<main>`, `<nav>`, `<footer>`) on every page.
- `alt` text on every `<img>`. Decorative images use `alt=""`.
- Form fields (when introduced) have programmatic labels.
- Lang attribute set on `<html>`.

## Release checklist

A release is done only when:

- [ ] `pnpm --filter @finsavvyai/website-finsavvyai-com build` is
      clean (no warnings).
- [ ] `pnpm --filter @finsavvyai/website-finsavvyai-com check` (Astro
      type-check) passes.
- [ ] Lighthouse CI thresholds met (when wired in future round).
- [ ] Visual regression diff reviewed (when wired).
- [ ] Accessibility audit clean (when wired).
- [ ] CSP headers reviewed and committed in CF Pages `_headers`.
- [ ] No new third-party network calls without docs.

## What is out of scope for this CLAUDE.md

- Product app design systems (those live with each product).
- The OSS-side rule sets (`oss/design-system/` when migrated).
- Backend / API decisions (this is a static site).
