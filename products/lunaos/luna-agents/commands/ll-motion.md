---
name: ll-motion
displayName: Luna Motion System
description: Production motion design system — Framer Motion + GSAP + Lottie + Rive, spring presets, choreography hooks, page transitions, reduced-motion fallbacks, all in a typed, reusable layer.
version: 1.0.0
category: design
agent: luna-motion
parameters:
  - name: action
    type: string
    description: "install | audit | refactor"
    required: false
    default: "install"
  - name: scope
    type: string
    description: Project path
    required: false
    default: "."
  - name: stack
    type: string
    description: "react | vue | svelte | astro"
    required: false
    default: "react"
workflow:
  - detect_existing_motion
  - install_libraries
  - generate_motion_primitives
  - install_spring_presets
  - install_choreography_hooks
  - install_page_transitions
  - install_lottie_rive_loaders
  - apply_reduced_motion_guards
  - generate_storybook_motion_stories
  - audit_existing_animations
output:
  - src/lib/motion/
  - .luna/{current-project}/motion-report.md
prerequisites: []
---

# Luna Motion — Typed Motion Design System

A production motion layer that consolidates Framer Motion, GSAP, Lottie, and Rive into a single typed API with spring presets, choreography hooks, and accessibility guards baked in.

## Why a System, Not Ad-Hoc Animation

Most projects have 5-10 motion libraries layered randomly: someone added Framer for one component, someone else hand-rolled CSS keyframes, another wired GSAP for a single hero. Result: bundle bloat, inconsistent feel, no reduced-motion respect.

This command consolidates all motion behind a typed primitive layer.

## What Gets Installed

```
src/lib/motion/
├── index.ts              # Public API — Motion primitives, hooks
├── springs.ts            # Named spring presets (snappy, bouncy, glide, ease)
├── presets.ts            # Common animations (fadeUp, scaleIn, slideRight)
├── stagger.ts            # Stagger choreography helpers
├── pageTransitions.tsx   # Route-level transition wrappers
├── lottie.tsx            # Lottie loader with reduced-motion fallback
├── rive.tsx              # Rive loader, similar contract
├── scrollTrigger.ts      # Wrapper around GSAP ScrollTrigger
├── reducedMotion.ts      # Single source of truth for prefers-reduced-motion
└── types.ts              # Motion config types
```

## Spring Presets

| Name | Tension | Friction | Mass | Feel |
|------|---------|----------|------|------|
| `snappy` | 380 | 28 | 1 | Quick UI feedback (button press) |
| `glide` | 200 | 30 | 1.2 | Smooth panel reveals |
| `bouncy` | 280 | 14 | 1 | Playful (toggles, success) |
| `ease` | 100 | 20 | 1 | Long content reveals |
| `instant` | 600 | 60 | 0.5 | Near-instant settle |

Pick by intent, not by tweaking numbers ad-hoc.

## Animation Presets

```ts
import { motion } from '@/lib/motion';

<motion.div {...motion.fadeUp(0.1)} />
<motion.div {...motion.scaleIn} />
<motion.div {...motion.slideRight({ stagger: 0.06 })} />
```

Each preset returns Framer Motion variants OR GSAP timeline params depending on context. The choice is hidden from the call site.

## Choreography Hooks

```ts
const { ref, entered } = useEnterChoreography({
  trigger: 'in-view',
  preset: 'fadeUp',
  stagger: 0.08,
  spring: 'glide',
});
```

Underlying engine: IntersectionObserver + framer-motion (≤ 5 elements) or GSAP (> 5 elements, perf-critical).

## Page Transitions

```tsx
<PageTransition variant="curtain" duration={0.6}>
  {children}
</PageTransition>
```

Variants: `curtain`, `fade`, `morph` (View Transitions API), `cross-dissolve`, `slide`.

## Lottie & Rive

Standardized loader contract:

```tsx
<Animation
  src="/lottie/checkmark.json"
  loop={false}
  autoplay
  reducedMotionFallback="static-final-frame"
/>
```

Auto-detects `.json` (Lottie) vs `.riv` (Rive). Caches parsed animations across renders.

## Reduced Motion

Single source of truth:

```ts
import { useReducedMotion } from '@/lib/motion';
const reduce = useReducedMotion();
```

All primitives check this hook. Reduced motion = animation duration → 0, transforms → end state, page transitions → instant cut, Lottie → final frame static.

## Modes

- `install` (default): full system installed
- `audit`: scan existing motion code, recommend consolidation
- `refactor`: replace ad-hoc animations with system primitives

## Usage

```
/ll-motion                          # install full system
/ll-motion --action audit           # scan existing project
/ll-motion --action refactor        # consolidate ad-hoc animations
/ll-motion src/components --stack vue  # install for Vue
```

## Output

`.luna/{project}/motion-report.md`:
- Libraries detected before
- Libraries after consolidation
- Bundle size delta
- Components migrated
- Reduced-motion coverage %

## Storybook

If Storybook is detected, generates motion stories at `src/lib/motion/__stories__/` showing every preset side by side for design review.

## Rules

- **Max 200 lines per file**
- **No motion without reduced-motion fallback**
- **Tree-shakable**: each preset must be importable individually
- **Bundle budget**: motion lib + framer-motion ≤ 60KB gzip; if exceeded, drop unused presets
- **One animation engine per render path** — don't run framer + gsap on the same DOM node concurrently
- **No layout-triggering properties in animation** — animate `transform` and `opacity` only

## In Pipes

```bash
/pipe ll-motion install >> ll-boutique --aesthetic editorial
/pipe ll-motion audit >> ll-motion refactor >> rev
/pipe feature "page transition" >> ll-motion >> ship
```
