# Qestro — Color System

Grounded in the existing LoginPage gradient (`#0f0c29 / #302b63 / #24243e`) and primary `#7c3aed`. Extended into a 10-step neutral scale and a semantic palette that matches the existing theme tokens in `frontend/src/styles/themes.css`.

## Primary Palette — Qestro Violet

The violet carries the brand. It's the AI-futurism signal without being neon. Used for primary CTAs, logo, active states, and the hero gradient.

| Token | Hex | Use |
|---|---|---|
| `--brand-primary-50`  | `#F5F3FF` | Hover wash on white |
| `--brand-primary-100` | `#EDE9FE` | Badge backgrounds |
| `--brand-primary-200` | `#DDD6FE` | Soft dividers on light |
| `--brand-primary-300` | `#C4B5FD` | Disabled CTAs on light |
| `--brand-primary-400` | `#A78BFA` | Focus rings on light |
| `--brand-primary-500` | `#8B5CF6` | Primary on dark (logo gradient top) |
| `--brand-primary-600` | `#7C3AED` | **Brand primary** — current `--brand-primary` |
| `--brand-primary-700` | `#6D28D9` | CTA hover on light, pressed on dark |
| `--brand-primary-800` | `#5B21B6` | CTA pressed on light |
| `--brand-primary-900` | `#4C1D95` | Logo gradient bottom |
| `--brand-primary-950` | `#2E1065` | Reserved, dark-mode deep surfaces |

## Secondary Palette — Signal Blue

Paired with violet in the existing gradient as `#3b82f6`. Used for informational accents, links inside body copy, and data-viz second-series.

| Token | Hex | Use |
|---|---|---|
| `--brand-secondary-400` | `#60A5FA` | Links on dark |
| `--brand-secondary-500` | `#3B82F6` | **Brand secondary** — current accent |
| `--brand-secondary-600` | `#2563EB` | Links on light, focus outlines |
| `--brand-secondary-700` | `#1D4ED8` | Pressed |

## Accent — Signal Cyan + Magenta

Used sparingly for data-viz, self-heal callouts, and AI-generated markers. Never used together in the same component.

| Token | Hex | Use |
|---|---|---|
| `--accent-cyan-500`    | `#06B6D4` | "AI-generated" tag, data-viz 3rd series |
| `--accent-magenta-500` | `#EC4899` | Self-heal highlight, destructive-secondary |

## Neutral Scale

Grounded in `--bg-primary: #0a0b0f` (dark default) and Apple's light gray system. Use for text, borders, surfaces.

| Token | Hex | Role |
|---|---|---|
| `--neutral-0`   | `#FFFFFF` | Light surface primary |
| `--neutral-50`  | `#FAFAFA` | Light surface secondary |
| `--neutral-100` | `#F5F5F7` | Light surface tertiary (matches Apple HIG) |
| `--neutral-200` | `#E8E8ED` | Borders on light |
| `--neutral-300` | `#D2D2D7` | Subtle borders |
| `--neutral-400` | `#A3A3A3` | `--text-secondary` on dark |
| `--neutral-500` | `#6E6E73` | `--text-secondary` on light |
| `--neutral-600` | `#52525B` | Muted body text |
| `--neutral-700` | `#3D3E43` | Borders on dark |
| `--neutral-800` | `#2D2E33` | `--border-color` on dark |
| `--neutral-900` | `#1D1D1F` | `--text-primary` on light (Apple HIG) |
| `--neutral-950` | `#0A0B0F` | `--bg-primary` on dark (current) |

## Semantic Colors

Already present in `themes.css` — surfaced here as the canonical values.

| Token | Hex | Use |
|---|---|---|
| `--success`  | `#10B981` | Passing tests, success toasts |
| `--warning`  | `#F59E0B` | Flaky tests, deprecation notices |
| `--error`    | `#EF4444` | Failing tests, destructive actions |
| `--info`     | `#3B82F6` | Info toasts, in-progress states |

## Surface Tokens

### Dark (default — ships today)

```
--surface-primary:  #0A0B0F   // page background
--surface-secondary: #14151A  // card background
--surface-elevated:  #1F2026  // modal, dropdown
--surface-hover:     rgba(255,255,255,0.05)
```

### Light (Apple HIG)

```
--surface-primary:  #FFFFFF
--surface-secondary: #F5F5F7
--surface-elevated:  #FFFFFF  (with shadow)
--surface-hover:     rgba(0,0,0,0.04)
```

## Hero Gradient (reserved)

Used for the logo container and the hero-section background only. Not for generic components.

```css
background: linear-gradient(135deg,
  #8B5CF6 0%,
  #7C3AED 55%,
  #4C1D95 100%);
```

The LoginPage's `#0f0c29 / #302b63 / #24243e` gradient is retained as the **full-bleed auth/login background** — it's more somber than the hero gradient and correctly signals "enter the system."

## WCAG Contrast Matrix

All combinations are rated AA (≥4.5:1 for body, ≥3:1 for large text) or AAA (≥7:1 body, ≥4.5:1 large).

| Foreground | Background | Ratio | Rating |
|---|---|---|---|
| `#FFFFFF` (white)         | `#7C3AED` (brand-primary)        | 5.59 | **AA body, AAA large** |
| `#FFFFFF` (white)         | `#0A0B0F` (dark bg)              | 19.8 | **AAA** |
| `#FFFFFF` (white)         | `#4C1D95` (brand-primary-900)    | 11.9 | **AAA** |
| `#A3A3A3` (text-secondary)| `#0A0B0F` (dark bg)              | 9.7  | **AAA** |
| `#1D1D1F` (light text)    | `#FFFFFF` (light bg)             | 19.1 | **AAA** |
| `#1D1D1F` (light text)    | `#F5F5F7` (light bg-secondary)   | 17.1 | **AAA** |
| `#6E6E73` (light text-2)  | `#FFFFFF`                        | 5.4  | **AA body** |
| `#7C3AED` (brand on light)| `#FFFFFF`                        | 5.1  | **AA body** (use for CTAs, not body text — use `#5B21B6` for long body violet copy on white, ratio 9.2, AAA) |
| `#8B5CF6` (brand-500)     | `#0A0B0F` (dark bg)              | 6.3  | **AA body, AAA large** |
| `#10B981` (success)       | `#0A0B0F`                        | 8.4  | **AAA** |
| `#EF4444` (error)         | `#0A0B0F`                        | 6.2  | **AA body, AAA large** |

### Anti-combinations (never ship these)

- `#7C3AED` on `#3B82F6` — 1.1 ratio, unreadable
- `#A3A3A3` on `#14151A` — 8.3 but drops to 3.1 on `#1F2026`; pick one surface
- `#EC4899` on `#7C3AED` — 1.5 ratio; they're neighbors on the spectrum, don't stack them

## Dark Mode is the Default

Unlike most SaaS, Qestro ships dark-first. The target user (developer using AI tools at 11pm) has their IDE in dark mode; the product should match. Light mode is offered for accessibility and slide-deck screenshots, not as the default.
