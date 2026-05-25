---
name: ll-boutique
displayName: Luna Boutique UI
description: Generate award-winning editorial landing pages — Lenis smooth scroll, GSAP ScrollTrigger choreography, variable-font kinetic typography, custom cursor with magnetic hover, View Transitions, dark editorial aesthetic by default.
version: 1.0.0
category: design
agent: luna-boutique
parameters:
  - name: site_name
    type: string
    description: Project name
    required: true
    prompt: true
  - name: aesthetic
    type: string
    description: "editorial | awwwards | fashion | gallery | brutalist-luxury"
    required: false
    default: "editorial"
  - name: stack
    type: string
    description: "next | astro | sveltekit | nuxt"
    required: false
    default: "next"
  - name: motion_intensity
    type: string
    description: "subtle | balanced | intense"
    required: false
    default: "balanced"
workflow:
  - scaffold_project
  - install_motion_stack
  - install_smooth_scroll
  - install_kinetic_type
  - generate_cursor_system
  - build_hero_choreography
  - build_section_transitions
  - configure_view_transitions
  - add_reduced_motion_fallbacks
  - lighthouse_check
  - awwwards_self_audit
output:
  - {site_name}/ (full project tree)
  - .luna/{current-project}/boutique-report.md
prerequisites:
  - node 20+
---

# Luna Boutique — Award-Ready Editorial Sites

Generates a boutique-grade web project that could land on Awwwards / FWA / CSSDA. Not another shadcn marketing template.

## Aesthetic Variants

| Variant | Look | Reference vibe |
|---------|------|----------------|
| `editorial` (default) | Magazine-style, generous whitespace, serif display, oversized images | The New York Times Magazine, Apple Newsroom |
| `awwwards` | Maximal motion, colored cursor trails, scroll-driven 3D | Locomotive, Active Theory |
| `fashion` | Dark monochrome, oversized type, slow reveals | Saint Laurent, Off-White, Aimé Leon Dore |
| `gallery` | Image-first, museum-style grid, parallax depth | MoMA, Gagosian, Hauser & Wirth |
| `brutalist-luxury` | Raw grids + premium materials, mono+serif clash | Balenciaga, Bottega Veneta |

## Stack

- **Framework**: Next.js 14 / Astro 5 / SvelteKit 2 / Nuxt 3
- **Motion**: GSAP 3 + Framer Motion 12
- **Smooth scroll**: Lenis (RAF-driven, no jank)
- **Type**: variable fonts via `next/font` or `@fontsource-variable`
- **3D (optional)**: React Three Fiber + Drei
- **Imagery**: Cloudinary / Sanity / Contentful
- **Deploy**: Vercel / Cloudflare Pages

## Motion Choreography (default `balanced`)

| Element | Behavior |
|---------|----------|
| Page load | Lenis warms up, hero text mask-reveals over 800ms |
| Scroll into view | Sections fade-translate 24px, stagger 60ms |
| Hover button | Magnetic pull (24px radius), label shift on cursor side |
| Hover image | Scale 1.02 + cursor turns into "View" pill |
| Section change | View Transitions API morph (or GSAP fallback) |
| Page exit | Curtain wipe top→bottom, 600ms, with site name strip |

`subtle`: divide all values by 2. `intense`: multiply by 1.5 + add cursor-following blur layer.

## Custom Cursor

Default: 8px circle, multiply blend mode, scales 4× over interactive elements, swaps to a contextual pill (`View` / `Read` / `Open`) on click targets. Falls back to native cursor on touch devices and `prefers-reduced-motion`.

## Kinetic Typography

Hero uses a variable font with at least 2 axes (e.g., wght + opsz). Animations:
- Weight oscillation on scroll (`scrollProgress → wght 300..900`)
- Optical-size adjusts with viewport
- Letter-spacing breathes on hover (-2 → 4 over 300ms)

Typeface defaults per aesthetic:
- editorial: Söhne / Tiempos
- awwwards: Recoleta + Inter Variable
- fashion: Helvetica Now + Caslon
- gallery: Suisse Int'l + Editorial New
- brutalist-luxury: ABC Diatype + Romana

(Agent picks free-tier alternatives if user lacks licenses.)

## View Transitions

For `next`: uses `next.config.js` `experimental.viewTransition: true` + `<Link>` wrapper.
For `astro`: native `<ViewTransitions />` component.
For `sveltekit` / `nuxt`: GSAP-based fallback.

## Reduced Motion

Every motion primitive ships paired with `@media (prefers-reduced-motion: reduce)` fallback that:
- Disables Lenis (uses native scroll)
- Removes magnetic hover, custom cursor
- Replaces animated reveals with instant 1.0 opacity
- Disables variable-axis animation

## Awwwards Self-Audit

Before declaring success, agent runs a self-check:
- Lighthouse: Perf ≥ 90 mobile, ≥ 95 desktop
- A11y ≥ 95
- LCP ≤ 2.5s, CLS ≤ 0.05, INP ≤ 200ms
- 0 layout shifts during entry choreography
- Tab order matches visual order
- All decorative images have empty alt; all content images have meaningful alt

If any check fails, agent fixes before finishing.

## Modes

- Default: scaffold + open `npm run dev`
- `--render-only`: build static export, no dev server
- `--audit`: run Awwwards self-audit on existing project

## Usage

```
/ll-boutique MyStudio                                    # editorial, Next, balanced
/ll-boutique Saint --aesthetic fashion --stack astro     # fashion + Astro
/ll-boutique Gallery --motion-intensity intense          # max motion
/ll-boutique . --audit                                   # audit existing site
```

## Output

- `{site_name}/` — full project
- `.luna/{project}/boutique-report.md` — Lighthouse scores, motion inventory, accessibility checklist, Awwwards readiness checklist

## In Pipes

```bash
/pipe ll-boutique MyStudio >> ll-3d-scene hero >> ll-tokens >> ship
/pipe idea "fashion brand site" >> ll-boutique --aesthetic fashion >> hig
```
