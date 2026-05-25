# Aegis Design System Master

> When building a page, first check `design-system/aegis/pages/[page].md`.
> If that file exists, its rules **override** this Master file.
> If not, follow the rules below.

**Project:** Aegis (AMLIQ — AML/CFT sanctions screening)
**Generated:** 2026-05-04 (reconciled with actual `web/src/` usage)
**Category:** Fintech / RegTech / Enterprise Compliance

Reconciled from ui-ux-pro-max generator output + real component code in
`web/src/components/match/*` and `web/src/components/entity/*`.

---

## Global Rules

### Color Palette — Chrome

| Role | Light | Dark | Usage |
|------|-------|------|-------|
| Background | `white` (#FFFFFF) | `gray-900` (#111827) | Page + card surface |
| Surface raised | `gray-50` | `gray-800` | Section header gradient, hover states |
| Border | `gray-200` | `gray-700` | Cards, dividers |
| Border subtle | `gray-100` | `gray-800` | Section dividers |
| Text primary | `gray-900` | `white` | Headings, entity names |
| Text body | `gray-700` / `gray-800` | `gray-200` / `gray-300` | Paragraph, field values |
| Text muted | `gray-500` / `gray-600` | `gray-400` / `gray-500` | Labels, captions (≥4.5:1) |
| Link / Chrome action | `blue-600` | `blue-400` | "Back", "View source", websites |
| Focus ring | `blue-500/40` | `blue-400/40` | Keyboard focus |

> **Hard rule:** never use `text-gray-400` on `bg-white` for body/label text — fails 4.5:1.
> Floor for muted on light bg = `gray-500` (#6B7280, 4.6:1).

### Color Palette — Risk Semantics

Risk colors map to confidence/severity, NOT to brand. Don't repurpose them for chrome.

| Bucket | Light | Dark | Trigger |
|--------|-------|------|---------|
| High (≥80%) | `bg-red-100 text-red-700` | `bg-red-900/30 text-red-400` | Confidence ≥80, AutoEscalate, sanction hit |
| Medium (50–79%) | `bg-amber-100 text-amber-700` | `bg-amber-900/30 text-amber-400` | Review queue, PEP tier, partial match |
| Low (<50%) | `bg-green-100 text-green-700` | `bg-green-900/30 text-green-400` | Cleared, no-match |

### Color Palette — Entity Type Badges

| Type | Color |
|------|-------|
| Individual | `bg-blue-50 text-blue-700` / dark `bg-blue-900/30 text-blue-400` |
| Company | `bg-purple-50 text-purple-700` / dark `bg-purple-900/30 text-purple-400` |
| Vessel | `bg-teal-50 text-teal-700` / dark `bg-teal-900/30 text-teal-400` |
| Aircraft | `bg-orange-50 text-orange-700` / dark `bg-orange-900/30 text-orange-400` |

### Color Palette — Sanctions List Badges

OFAC red · EU blue · UN purple · UK OFSI orange · others gray.

### Typography

System stack (Apple HIG aligned). No web font fetch.

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter",
  system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
font-feature-settings: "ss01", "cv11";
```

- Body line-height 1.5
- Body size: 14–16px (`text-sm` for dense data, `text-base` for prose)
- Heading: `font-bold` `text-xl`/`text-2xl`, `tracking-tight`
- Labels: `text-xs font-semibold uppercase tracking-wider` muted color

### Spacing Scale

Tailwind defaults. Card padding `px-6 py-4` for sections, `px-6 py-5` for headers, `p-4` for overlay container.

### Shadow Depth

| Level | Use |
|-------|-----|
| `shadow-sm` | Subtle lift on cards |
| `shadow-md` | Default cards, buttons |
| `shadow-lg` | Dropdowns, popovers |
| `shadow-2xl` | Slide-out overlay (`MatchDetailOverlay`) |

---

## Component Specs

### Badges

- Pill: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium`
- Always pair color tokens for both light + dark mode.
- Icon-bearing badges use Lucide SVG at `w-3.5 h-3.5`, never emojis.

### Buttons

- Primary action: `bg-blue-600 text-white hover:bg-blue-700` · `rounded-lg px-4 py-2 text-sm font-medium`
- Secondary: `border border-gray-300 text-gray-700 hover:bg-gray-50` (light) / `border-gray-700 text-gray-200 hover:bg-gray-800` (dark)
- Destructive: `bg-red-600 text-white hover:bg-red-700`
- All buttons: `cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40`
- Icon-only buttons require `aria-label`.

### Cards / Panels

```
bg-white dark:bg-gray-900 rounded-2xl
border border-gray-200 dark:border-gray-700
overflow-hidden
```

Hover: `transition-shadow duration-200 hover:shadow-lg` — never scale (avoids layout shift).

### Modals / Slide-out Overlay

- `role="dialog" aria-modal="true" aria-labelledby="<heading-id>"`
- Backdrop `bg-black/30 backdrop-blur-sm`, click-outside closes.
- Esc closes; focus moves to first focusable on open; restored on close.
- Animations gated behind `motion-safe:` (Tailwind) or `@media (prefers-reduced-motion: no-preference)`.

### Progress Bars (Layers)

- `h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full`
- Fill uses risk semantics. `motion-safe:transition-[width] duration-300`.

### Spinner

- `<div role="status" aria-label="Loading">` wrapper.
- `animate-spin` only inside `motion-safe:`.

---

## Style

**Style:** Trust & Authority (data-dense, calm, content-first — Apple HIG aligned).

- Show evidence (layers, programs, source links) prominently.
- Reserve color for risk signals; chrome stays neutral.
- No marketing gradients, no glassmorphism on data surfaces.

---

## Anti-Patterns (Do NOT Use)

- Emojis as icons → Lucide / Heroicons SVG only.
- `text-gray-400` on `bg-white` for body or label text.
- Scale-transform hovers on cards (causes layout shift in dense lists).
- Animations without `motion-safe:` guard.
- Icon-only buttons missing `aria-label`.
- Modal without `role="dialog" aria-modal="true"` and focus management.
- Tailwind risk colors used for chrome (red link, amber border on neutral cards).
- Inline AI-style purple/pink gradients.
- Body text under 14px on mobile.

---

## Pre-Delivery Checklist

- [ ] No emojis used as icons (use Lucide SVG)
- [ ] All icons sized consistently (`w-4 h-4` inline, `w-3.5 h-3.5` in badges)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover transitions 150–300ms, no scale
- [ ] Muted text ≥ `gray-500` on light, ≥ `gray-400` on dark (verify 4.5:1)
- [ ] Focus states visible (`focus-visible:ring-2`)
- [ ] `prefers-reduced-motion` respected (Tailwind `motion-safe:` prefix)
- [ ] Modals have `role="dialog" aria-modal="true"` + focus trap + Esc close
- [ ] Icon-only buttons have `aria-label`
- [ ] Spinners have `role="status"` + accessible label
- [ ] Responsive at 375 / 768 / 1024 / 1440 px
- [ ] No horizontal scroll on mobile
- [ ] CLAUDE.md per-file cap respected: ≤100 lines (incl. blanks/comments)
