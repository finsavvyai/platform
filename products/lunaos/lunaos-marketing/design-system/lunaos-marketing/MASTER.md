# Design System Master File — LunaOS Marketing

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** LunaOS Marketing
**Generated:** 2026-05-23
**Style Target:** Apple HIG — calm, content-first, minimal
**Pattern:** Bento Grids + Swiss Modernism (12-col)

---

## Global Rules

### Color Palette (Light Mode — Apple HIG)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Page Background | `#F5F5F7` | `--bg` |
| Surface (cards) | `#FFFFFF` | `--surface` |
| Text Primary | `#1D1D1F` | `--text` |
| Text Secondary | `#6E6E73` | `--text-muted` |
| Text Tertiary | `#86868B` | `--text-faint` |
| Hairline / Divider | `#D2D2D7` | `--line` |
| CTA / Accent | `#0071E3` | `--accent` |
| CTA Hover | `#0077ED` | `--accent-hover` |
| Success | `#34C759` | `--ok` |
| Warning | `#FF9F0A` | `--warn` |
| Critical | `#FF3B30` | `--err` |
| Focus Ring | `rgba(0,113,227,0.35)` | `--focus` |

**Notes:** Apple system palette. Single accent (#0071E3). No gradients on text/CTAs. Use color sparingly.

### Dark Mode (auto via `prefers-color-scheme: dark`)

| Role | Hex |
|------|-----|
| Background | `#000000` |
| Surface | `#1C1C1E` |
| Text Primary | `#F5F5F7` |
| Text Muted | `#AEAEB2` |
| Line | `#2C2C2E` |
| Accent | `#0A84FF` |

### Typography

- **Heading & Body:** `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif`
- **Mono:** `"SF Mono", "JetBrains Mono", ui-monospace, monospace`
- **Mood:** calm, confident, generous spacing
- **Tracking:** `-0.022em` on display sizes, `-0.01em` on body
- **Line height:** 1.07 on display, 1.45 on body

### Type Scale (clamp-based, fluid)

| Token | Size |
|-------|------|
| `--fs-display` | `clamp(2.5rem, 5vw + 1rem, 4.5rem)` |
| `--fs-h1` | `clamp(2rem, 3vw + 1rem, 3rem)` |
| `--fs-h2` | `clamp(1.5rem, 2vw + 0.75rem, 2.25rem)` |
| `--fs-h3` | `1.25rem` |
| `--fs-body` | `1.0625rem` (17px) |
| `--fs-sm` | `0.9375rem` (15px) |
| `--fs-xs` | `0.8125rem` (13px) |

### Spacing (8-pt baseline)

| Token | Value |
|-------|-------|
| `--s-1` | `4px` |
| `--s-2` | `8px` |
| `--s-3` | `12px` |
| `--s-4` | `16px` |
| `--s-5` | `24px` |
| `--s-6` | `32px` |
| `--s-7` | `48px` |
| `--s-8` | `64px` |
| `--s-9` | `96px` |
| `--s-10` | `128px` |

### Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--r-sm` | `8px` | Inputs, tags |
| `--r-md` | `14px` | Buttons |
| `--r-lg` | `20px` | Cards |
| `--r-xl` | `28px` | Hero panels, bento tiles |

### Shadows (subtle only)

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-md` | `0 8px 24px rgba(0,0,0,0.06)` |
| `--shadow-lg` | `0 20px 48px rgba(0,0,0,0.08)` |

### Motion

- Duration: 200ms (micro), 300ms (cards), 400ms (hero)
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Apple standard)
- Respect `prefers-reduced-motion: reduce` — disable all non-essential transitions

---

## Component Specs

### Primary Button

```css
.btn-primary {
  background: var(--accent);
  color: #fff;
  padding: 12px 22px;
  border-radius: var(--r-md);
  font-weight: 500;
  font-size: 1rem;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background 200ms cubic-bezier(0.4,0,0.2,1);
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
```

### Secondary Button (Ghost)

```css
.btn-ghost {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--line);
  padding: 11px 21px;
  border-radius: var(--r-md);
  font-weight: 500;
  cursor: pointer;
  transition: background 200ms, border-color 200ms;
}
.btn-ghost:hover { background: rgba(0,0,0,0.04); border-color: var(--text); }
```

### Bento Card

```css
.bento {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: 32px;
  transition: border-color 250ms, box-shadow 250ms;
  cursor: default;
}
.bento--interactive { cursor: pointer; }
.bento--interactive:hover { border-color: rgba(0,113,227,0.35); box-shadow: var(--shadow-md); }
```

### Bento Grid (12-col, varied spans)

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}
.bento-grid > * { grid-column: span 12; }
@media (min-width: 768px) {
  .bento-grid > .span-4 { grid-column: span 6; }
  .bento-grid > .span-6 { grid-column: span 6; }
  .bento-grid > .span-8 { grid-column: span 12; }
}
@media (min-width: 1024px) {
  .bento-grid > .span-4 { grid-column: span 4; }
  .bento-grid > .span-6 { grid-column: span 6; }
  .bento-grid > .span-8 { grid-column: span 8; }
}
```

---

## Layout Rules

- Max content width: `1120px`
- Page gutter: `clamp(20px, 5vw, 48px)`
- Vertical section rhythm: `var(--s-10)` (128px) between sections on desktop, `var(--s-8)` (64px) mobile
- Nav: floating top, `top: 12px`, max-width 1120px, glass-light (`backdrop-filter: blur(20px) saturate(180%)`, `background: rgba(255,255,255,0.72)`)

---

## Iconography

- **NO emojis as UI icons.** Use inline SVG (Lucide-style 24×24, stroke 1.5, currentColor).
- Brand logos: official Simple Icons SVG only.
- Consistent size: `w-5 h-5` (20px) inline, `w-6 h-6` (24px) feature, `w-8 h-8` (32px) hero.

---

## Page Pattern: Bento Hero + Sectioned Bento

Section order:
1. Floating glass nav
2. Hero — display headline + sub + dual CTA + CLI install bar
3. Stat row (4 stats, hairline borders)
4. "Replaces X" chip row
5. Use cases — 6-tile bento grid
6. Platform — 6-tile bento grid (varied spans)
7. How it works — 4 numbered cards
8. Demo terminal — code-style card on light surface
9. Architecture — horizontal 5-item rail
10. Pricing — 3 tiers, middle featured
11. FAQ — accordion details
12. Final CTA — centered, calm
13. Footer — compact

---

## Anti-Patterns (Do NOT Use)

- ❌ Emojis as icons (use SVG)
- ❌ Heavy gradients on text or large surfaces
- ❌ Glow effects, neon borders, dark-mode-only palettes for marketing
- ❌ Scale transforms on hover that shift layout
- ❌ Animations longer than 400ms for UI
- ❌ Body text under 16px on mobile
- ❌ Color-only state indicators
- ❌ Invisible focus rings
- ❌ Auto-playing motion without `prefers-reduced-motion` check

---

## Pre-Delivery Checklist

- [ ] No emoji icons (SVG only)
- [ ] Single accent color used for all CTAs
- [ ] Focus rings visible (3px, --focus color)
- [ ] All clickable elements have cursor:pointer
- [ ] Hover changes color/border, never layout
- [ ] `prefers-reduced-motion: reduce` respected
- [ ] `prefers-color-scheme: dark` supported
- [ ] Body text ≥ 17px desktop, ≥ 16px mobile
- [ ] Contrast ≥ 4.5:1 for body text (verified for both modes)
- [ ] Responsive at 375 / 768 / 1024 / 1440 px
- [ ] No horizontal scroll on mobile
- [ ] SEO meta + FAQ JSON-LD preserved
- [ ] Plausible analytics script preserved
