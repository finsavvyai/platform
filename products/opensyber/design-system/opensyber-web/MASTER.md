# OpenSyber Web — Design System Master

> **LOGIC:** When building a specific page, first check `design-system/opensyber-web/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, follow the rules below.

**Project:** OpenSyber Web (`apps/web`)
**Category:** Security Platform — post-login dashboard
**Brand:** Control Room / "The Operator"
**Source of truth for tokens:** `docs/opensyber-brand.html` (1530-line reference)
**Status (verified 2026-05-06):** Brand is **partially wired** — `apps/web/src/app/globals.css` (292 lines, Tailwind v4 `@theme inline`) defines all signal/text tokens and `apps/web/src/app/layout.tsx` loads Bebas Neue / Space Mono / DM Sans via `next/font/google`. Three drift items vs `docs/opensyber-brand.html`: `--color-void`, `--color-panel`, `--color-surface`, `--color-border` are slightly bluer/darker than the brand spec (see `design-system/audit-report.md`). Components still use generic `bg-blue-500` etc. in 18+ places — token migration unfinished.
**Generated:** 2026-05-06

---

## Vision

Bloomberg Terminal meets security platform. Dense, precise, real-time. Differentiates from generic blue-shield security companies (Wiz, Snyk, Crowdstrike) by being darker, calmer, more data-forward.

---

## Color Tokens

### Core surfaces (dark only — light mode not supported)

| Token | Hex | Tailwind alias | Usage |
|-------|-----|----------------|-------|
| `--void` | `#080B0F` | `bg-void` | Page background |
| `--panel` | `#0D1117` | `bg-panel` | Card backgrounds |
| `--surface` | `#141B24` | `bg-surface` | Elevated surfaces (modals, dropdowns) |
| `--border` | `#1E2A38` | `border-border` | Subtle dividers |
| `--wire` | `#243344` | `border-wire` | Grid lines, visible structure |

### Signals

| Token | Hex | Usage |
|-------|-----|-------|
| `--signal` | `#00E5C3` | Primary accent (electric teal) |
| `--signal2` | `#00B89A` | Hover/muted accent |
| `--signal3` | `#007A67` | Dim accent |
| `--alert` | `#FF4D4D` | Critical findings, destructive actions |
| `--warn` | `#FFB347` | Warnings |
| `--ok` | `#2ECC7B` | Safe states, success |
| `--info` | `#4D9EFF` | Informational badges |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#E8F0F8` | Body, headings |
| `--text-secondary` | `#7A96B2` | Labels, metadata |
| `--text-muted` | `#3D5470` | Disabled, placeholder |
| `--text-signal` | `#00E5C3` | CTAs, links, active state |

**Anti-pattern:** Never use generic blue (`#1E40AF`, `#3B82F6`, sky blues). Brand differentiator is teal.

---

## Typography

| Role | Font | Where to use |
|------|------|--------------|
| Display / Headings | **Bebas Neue** | H1, H2, hero numerics, large stats |
| Mono / UI / Labels | **Space Mono** | Nav links, button text, badges, table headers, code, timestamps |
| Body | **DM Sans** (300/400/500/600) | Paragraphs, descriptions, dense table cells |

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=Bebas+Neue&display=swap');
```

**Rules**
- Buttons: Space Mono, **uppercase**, `letter-spacing: 0.08em`, **3px border-radius** (NOT pill, NOT fully rounded)
- Numerics in metrics: Bebas Neue, large (32–64px), tabular figures
- Body text: DM Sans 15px, line-height 1.6
- Logo wordmark: `OPEN//SYBER` in Space Mono

---

## Page Pattern: Dense Data Dashboard

(Overrides skill output of "Enterprise Gateway" — wrong for post-login product surface.)

### Layout

```
┌──────────────────────────────────────────────────┐
│ NAV (fixed, 56px, void/92% + blur)              │
├────────┬─────────────────────────────────────────┤
│        │                                         │
│ SIDE   │  CONTENT                                │
│ NAV    │  - Page title (Bebas Neue, large)       │
│ 240px  │  - Metric tiles row (4 cols)            │
│        │  - Activity feed / data table           │
│        │  - Right-side detail drawer (optional)  │
│        │                                         │
└────────┴─────────────────────────────────────────┘
```

### Required elements

- **Page-grid background**: 40×40px wire grid using `--wire` (1px lines on `--void`)
- **Scanline overlay**: subtle 2px repeating teal lines at 1.2% opacity, fixed, pointer-events:none, z-index above content but below modals
- **Card corner mark**: 32px teal accent line at top-left of every card (`::before` with 2px height, `--signal` background)
- **Real timestamps everywhere**: ISO 8601 or relative ("3m ago"), never "Today"
- **Specific names, never placeholders**: "agent-prod-7" not "My Agent"

---

## Component Specs

### Card

```css
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 24px;
  position: relative;
  transition: border-color 200ms ease;
}
.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 32px;
  height: 2px;
  background: var(--signal);
}
.card:hover {
  border-color: var(--signal3);
}
```

### Button — primary

```css
.btn-primary {
  background: var(--signal);
  color: var(--void);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 10px 20px;
  border-radius: 3px;
  border: 0;
  cursor: pointer;
  transition: background 200ms ease;
}
.btn-primary:hover { background: var(--signal2); }
.btn-primary:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
```

### Button — secondary

```css
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 10px 20px;
  border-radius: 3px;
  cursor: pointer;
}
.btn-secondary:hover { border-color: var(--signal); color: var(--signal); }
```

### Input

```css
.input {
  background: var(--void);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 14px;
  padding: 10px 14px;
}
.input:focus {
  border-color: var(--signal);
  outline: 2px solid rgba(0,229,195,0.2);
  outline-offset: 0;
}
.input::placeholder { color: var(--text-muted); }
```

### Status badges

| Severity | Background | Text |
|----------|-----------|------|
| Critical | `rgba(255,77,77,0.15)` | `--alert` |
| Warn | `rgba(255,179,71,0.15)` | `--warn` |
| OK | `rgba(46,204,123,0.15)` | `--ok` |
| Info | `rgba(77,158,255,0.15)` | `--info` |

All badges: Space Mono, uppercase, 11px, padding 4px 8px, border-radius 2px.

### Tables

- Header: Space Mono uppercase 11px, `--text-secondary`, border-bottom 1px `--border`
- Rows: DM Sans 14px, `--text-primary`, hover `bg-surface`
- Numeric columns: tabular-nums, right-aligned

---

## Spacing scale

| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |
| `--space-3xl` | 64px (section padding) |

Container max-width: **1100px**, padding 32px horizontal.

---

## Motion

- Transitions: 150–200ms `ease`, only on `transform`, `opacity`, `border-color`, `background`, `color`
- No layout-shifting hovers (no scale that resizes)
- Respect `prefers-reduced-motion`: disable scanline animation, reduce transitions to 0ms

---

## Voice & Microcopy

- **Never** exclamation marks
- **Never** "Oops!", "Whoops", or apologetic copy
- Real timestamps, not "just now"
- Specific entity names, not generic ("vm-1234" not "your server")
- Errors: `[FAIL]` prefix in Space Mono, then plain DM Sans description

---

## Anti-Patterns (forbidden)

- Generic blue palette (`#1E40AF`, `#3B82F6`, sky)
- Light mode (brand is dark only)
- Emoji as UI icons (use Heroicons/Lucide SVG)
- Pill-shaped buttons (`border-radius` ≥ 8px on buttons)
- Marketing-y copy in product UI ("Welcome back ", "")
- Layout-shifting hover (`scale(1.05)` resizing siblings)
- Missing `cursor-pointer` on clickable elements
- Hardcoded colors outside the token system
- Files >200 lines (portfolio-wide rule)

---

## Pre-Delivery Checklist

- [ ] All colors reference tokens, no hex literals in components
- [ ] Bebas Neue / Space Mono / DM Sans loaded and applied per role
- [ ] Buttons: Space Mono uppercase, 3px radius
- [ ] Page-grid + scanline overlay present on shell
- [ ] Card corner-mark on every card
- [ ] All clickable elements have `cursor-pointer` + visible focus
- [ ] All copy follows voice rules (no `!`, real timestamps)
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 375 / 768 / 1024 / 1440
- [ ] No file in changeset exceeds 200 lines
- [ ] No emoji used as icon

---

## Implementation gap (verified 2026-05-06)

Brand is partially wired. Remaining work, in priority order:

1. **Reconcile token drift** — decide whether `globals.css` slightly bluer darks (`#060910`/`#0A0F18`/`#111827`/`#1C2940`) are the new canonical values or whether to align back to brand HTML (`#080B0F`/`#0D1117`/`#141B24`/`#1E2A38`). Update one source of truth and propagate.
2. **Replace generic blue/indigo** with `bg-signal` / `bg-info` / `bg-alert` tokens across 18+ component files (see `design-system/audit-report.md` for line-by-line list).
3. **Trim `globals.css` from 292 lines to ≤200** — extract gradients/glows/animations into `globals.effects.css` and `globals.tokens.css`.
4. **Add `text-text-dim` / `text-signal-hover` to MASTER** — they exist in code but were absent from this spec; either delete from CSS or document here.
