# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** SDLC Platform
**Generated:** 2026-03-30
**Category:** Enterprise AI Security SaaS
**Style:** Trust & Authority + Swiss Minimalism

---

## Global Rules

### Color Palette

| Role | Hex | Tailwind | CSS Variable | Usage |
|------|-----|----------|--------------|-------|
| Primary | `#1E40AF` | `blue-800` | `--color-primary` | Headers, nav, primary actions |
| Primary Light | `#3B82F6` | `blue-500` | `--color-primary-light` | Hover states, highlights |
| Secondary | `#0EA5E9` | `sky-500` | `--color-secondary` | Links, secondary UI, gradients |
| CTA | `#059669` | `emerald-600` | `--color-cta` | Buttons, success, compliance badges |
| CTA Hover | `#047857` | `emerald-700` | `--color-cta-hover` | CTA hover state |
| Background | `#F8FAFC` | `slate-50` | `--color-background` | Page background |
| Surface | `#FFFFFF` | `white` | `--color-surface` | Cards, panels |
| Surface Elevated | `rgba(255,255,255,0.78)` | - | `--color-surface-elevated` | Glass panels |
| Text | `#0F172A` | `slate-900` | `--color-text` | Body text |
| Text Muted | `#475569` | `slate-600` | `--color-text-muted` | Secondary text |
| Text Subtle | `#94A3B8` | `slate-400` | `--color-text-subtle` | Placeholder, disabled |
| Border | `#E2E8F0` | `slate-200` | `--color-border` | Dividers, card borders |
| Danger | `#DC2626` | `red-600` | `--color-danger` | Errors, critical alerts |
| Warning | `#F59E0B` | `amber-500` | `--color-warning` | Warnings, attention |
| Info | `#0EA5E9` | `sky-500` | `--color-info` | Information callouts |

### Accent Gradient (Brand)

```css
background: linear-gradient(135deg, #1E40AF, #0EA5E9);
```

Tailwind: `bg-gradient-to-br from-blue-800 to-sky-500`

### Typography

| Element | Font | Weight | Size | Line Height |
|---------|------|--------|------|-------------|
| H1 (Hero) | Inter | 700 | 48-64px | 1.1 |
| H2 (Section) | Inter | 600 | 36-48px | 1.2 |
| H3 (Card) | Inter | 600 | 20-24px | 1.3 |
| Body | Inter | 400 | 16px | 1.6 |
| Body Small | Inter | 400 | 14px | 1.5 |
| Label | Inter | 500 | 14px | 1.4 |
| Code | Fira Code | 400-500 | 14px | 1.5 |
| Caption | Inter | 400 | 12px | 1.4 |

**Font Loading (Next.js):**
```tsx
import { Inter, Fira_Code } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const firaCode = Fira_Code({ subsets: ['latin'], variable: '--font-code' });
```

### Spacing Scale

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--space-xs` | `4px` | `1` | Tight gaps |
| `--space-sm` | `8px` | `2` | Icon gaps, inline |
| `--space-md` | `16px` | `4` | Standard padding |
| `--space-lg` | `24px` | `6` | Card padding |
| `--space-xl` | `32px` | `8` | Large gaps |
| `--space-2xl` | `48px` | `12` | Section gaps |
| `--space-3xl` | `64px` | `16` | Hero padding |
| `--space-section` | `80-96px` | `20-24` | Between sections |

### Border Radius

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--radius-sm` | `6px` | `rounded-md` | Badges, pills |
| `--radius-md` | `8px` | `rounded-lg` | Buttons, inputs |
| `--radius-lg` | `12px` | `rounded-xl` | Cards |
| `--radius-xl` | `16px` | `rounded-2xl` | Hero cards, modals |
| `--radius-2xl` | `24px` | `rounded-3xl` | Glass panels |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | Featured cards, hero |
| `--shadow-glow` | `0 10px 22px rgba(30,64,175,0.15)` | CTA glow |

### Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `150ms ease` | Hover color changes |
| `--transition-base` | `200ms ease` | Standard interactions |
| `--transition-slow` | `300ms ease` | Card hovers, modals |

---

## Component Specs

### Buttons

```css
/* Primary CTA */
.btn-primary {
  background: #059669;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  transition: all 200ms ease;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(5,150,105,0.25);
}
.btn-primary:hover {
  background: #047857;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(5,150,105,0.3);
}

/* Secondary */
.btn-secondary {
  background: transparent;
  color: #1E40AF;
  border: 1.5px solid #1E40AF;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
.btn-secondary:hover {
  background: #1E40AF;
  color: white;
  transform: translateY(-1px);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: #475569;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: color 150ms ease;
  cursor: pointer;
}
.btn-ghost:hover { color: #1E40AF; }
```

### Cards

```css
.card {
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 24px;
  transition: all 200ms ease;
}
.card:hover {
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

/* Glass variant (landing page) */
.card-glass {
  background: rgba(255,255,255,0.78);
  border: 1px solid rgba(255,255,255,0.74);
  backdrop-filter: blur(18px);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 12px 30px rgba(15,23,42,0.08);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  color: #0F172A;
  background: white;
  transition: border-color 200ms ease;
}
.input:focus {
  border-color: #1E40AF;
  outline: none;
  box-shadow: 0 0 0 3px rgba(30,64,175,0.12);
}
.input::placeholder { color: #94A3B8; }
```

### Trust Badges

```css
.trust-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 6px;
  background: rgba(5,150,105,0.08);
  border: 1px solid rgba(5,150,105,0.2);
  color: #047857;
  font-size: 13px;
  font-weight: 500;
}
```

---

## Style Guidelines

**Style:** Trust & Authority + Swiss Minimalism

**Keywords:** Security badges, compliance indicators, professional photography, metric cards, clean grid layouts, high contrast, functional whitespace

**Best For:** Enterprise security software, compliance platforms, financial services

**Key Effects:**
- Badge hover effects (subtle glow)
- Stat counter animations (count-up on scroll)
- Smooth section transitions (fade + slide)
- Glass morphism for elevated surfaces
- Micro-interactions: 200ms transitions

### Page Structure (Landing)

1. Hero (value proposition + trust bar)
2. Trust Bar (SOC2, HIPAA, GDPR badges)
3. Features (3-column grid)
4. Platform Capabilities (tabbed/grid)
5. Pricing (3 tiers, mid highlighted)
6. Demo Form (contact sales)
7. Footer

---

## Anti-Patterns (Do NOT Use)

- Playful/casual design language
- Purple/pink AI gradients
- Emojis as icons (use Lucide React SVGs)
- Missing cursor:pointer on clickable elements
- Layout-shifting hover effects (avoid scale > 1.02)
- Low contrast text (< 4.5:1 ratio)
- Instant state changes without transitions
- Invisible focus states
- Dark mode as default (enterprise = light mode)
- Rounded-full buttons (use rounded-lg/xl)
- Complex onboarding flows
- Cluttered dashboards without filtering

---

## Pre-Delivery Checklist

- [ ] No emojis used as icons (use Lucide React SVGs)
- [ ] All icons from Lucide React, consistent 24x24 viewBox
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast 4.5:1 minimum (WCAG AA)
- [ ] Focus states visible with ring (3px, primary color)
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
- [ ] Inter font loaded via next/font (no external link tags)
- [ ] Fira Code only for code blocks
- [ ] Glass panels have sufficient contrast in light mode
