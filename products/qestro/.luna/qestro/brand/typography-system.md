# Qestro — Typography System

Anchored in the existing Inter + JetBrains Mono pairing already loaded in `index.html`. No font changes — this document formalizes the scale and pairings.

## Font Stack

### Display / Headings / Body — **Inter**

- Weights in use: 300, 400, 500, 600, 700
- **Why Inter**: built for screens at small sizes, neutral enough to not steal attention, supports technical feature-set (tabular numerals, contextual alternates) that matter for test-result dashboards.
- Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`
- Self-hosted via Google Fonts import in `index.html`

### Monospace — **JetBrains Mono**

- Weights in use: 400, 500, 600
- **Why JetBrains Mono**: developers recognize it instantly (it's the default in JetBrains IDEs and a common Cursor/VS Code choice). Using it says "we are developers, shipping for developers."
- Used for: code blocks, selectors, test names, CLI output, API endpoints, IDs, timestamps.
- Fallback: `"Fira Code", Menlo, Consolas, monospace`

### No serif

Qestro ships no serif font. The brand is for developers; serifs here would read corporate, not technical.

## Type Scale

Base: 16px (`1rem`). Scale ratio: 1.25 (major third) for body→h3, then custom steps for display sizes.

| Role          | Size       | Weight | Line-height | Letter-spacing | Tailwind class |
|---------------|------------|--------|-------------|----------------|----------------|
| Display-lg    | 4rem / 64px | 700   | 1.1  | -0.03em   | `text-display-lg` |
| Display       | 3rem / 48px | 700   | 1.15 | -0.025em  | `text-display` |
| H1            | 2.5rem / 40px | 700 | 1.2  | -0.02em   | `text-h1` |
| H2            | 2rem / 32px | 600   | 1.25 | -0.01em   | `text-h2` |
| H3            | 1.5rem / 24px | 600 | 1.3  | 0         | `text-h3` |
| H4            | 1.25rem / 20px | 500 | 1.4 | 0         | `text-h4` |
| Body-lg       | 1.125rem / 18px | 400 | 1.6 | 0        | `text-body-lg` |
| Body          | 1rem / 16px | 400   | 1.6  | 0         | `text-body` |
| Small         | 0.875rem / 14px | 400 | 1.5 | 0         | `text-small` |
| Caption       | 0.75rem / 12px | 400 | 1.4 | 0.02em   | `text-caption` |
| Code-inline   | 0.9em (relative) | 500 | inherit | 0     | `font-mono font-medium` |
| Code-block    | 0.875rem / 14px | 400 | 1.55 | 0         | `font-mono text-small` |

## Usage Rules

### Display (48-64px)
Reserved for: landing page hero, marketing pages, launch announcements. **Never** used in-app.

### H1 (40px)
Once per page. The page title. Dashboard, Settings, Test Results — single H1 only.

### H2 (32px) / H3 (24px)
Section titles inside pages. In-app modals use H3 for titles.

### H4 (20px)
Card titles, list-item titles, form section headers.

### Body-lg (18px)
Intro paragraphs on marketing pages. Never used in product UI — feels oversized.

### Body (16px)
Default reading size. All form labels, descriptions, body copy.

### Small (14px)
Secondary info: timestamps, counts, metadata, nav items, table rows in dense data views.

### Caption (12px, +0.02em tracking)
Legal, footer microcopy, badge text, chart axis labels. Never for information the user must act on.

### Monospace
- **Inline**: code tokens, selector names, variable names, test IDs
- **Block**: generated Playwright code, CLI output, API responses
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) for: durations, percentages, test counts, latency p50/p95/p99

## Pairing Rules

- **Heading + body in same section**: always Inter + Inter (different weights, not different fonts).
- **Headline + code snippet**: Inter + JetBrains Mono. Mono is never used for a heading.
- **Labels + values in data-heavy UI** (dashboard, test results): Inter Medium label + JetBrains Mono value. This is the "scientific-instrument" look that matches the Linear/Vercel aesthetic.

## Line Length

- Max 75 characters (~65em at body size) for paragraph body.
- Max 120 characters for monospace code blocks, but prefer 80 for readability.

## Accessibility

- Minimum body size: 14px. Nothing readable below that outside of captions.
- Minimum line-height: 1.4 for anything labeled as body-or-larger.
- Never set body text below 400 weight. Inter 300 exists for display-only contexts (big, airy hero text) where thin weight reads as premium.
- Respect user font-size preferences: root `font-size` should stay at browser default (16px) or use `rem` everywhere so zoom works.
- Never style links using color alone — always include an underline or weight change on hover/focus.

## Font Loading

Already configured in `index.html`. Font-display strategy is `swap` — slight FOUT is acceptable and preferable to invisible text during load. Inter and JetBrains Mono are both WOFF2 (~30kb subset each), acceptable on a modern connection.

Consider adding `font-display: optional` for the 500/600/700 weights if Lighthouse flags layout shift on the landing page — 400 will always be available, and the page degrades gracefully.
