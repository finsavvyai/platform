---
name: ll-3d-scene
displayName: Luna 3D Scene
description: Generate WebGL hero scenes with React Three Fiber + Drei — performance-budgeted, mobile-friendly, with Spline integration option, instanced meshes, and DPR-aware rendering.
version: 1.0.0
category: design
agent: luna-3d-scene
parameters:
  - name: scene_kind
    type: string
    description: "hero | particles | morph | parallax | productShowcase | logoLoop | spline"
    required: true
    prompt: true
  - name: location
    type: string
    description: Where to insert scene (file path or component name)
    required: false
    default: "src/components/Scene.tsx"
  - name: budget_ms
    type: number
    description: Per-frame budget in ms (default 8 for 120fps headroom)
    required: false
    default: 8
  - name: mobile_strategy
    type: string
    description: "fallback | reduced | full"
    required: false
    default: "reduced"
workflow:
  - install_three_r3f_drei
  - scaffold_scene_component
  - apply_perf_optimizations
  - install_dpr_throttling
  - configure_mobile_strategy
  - generate_loading_skeleton
  - smoke_render_test
  - lighthouse_check
output:
  - src/components/{scene_name}.tsx
  - src/components/{scene_name}.css
  - .luna/{current-project}/3d-scene-report.md
prerequisites:
  - react 18+
---

# Luna 3D Scene — WebGL Heroes That Don't Tank Lighthouse

Generates production WebGL scenes for marketing and product UI. Default stack: React Three Fiber + Drei. Optional Spline import for designer-built scenes.

## Why a Command, Not Just Copy-Paste R3F Boilerplate

Most "WebGL hero" tutorials produce sites that:
- Tank LCP because Three.js is loaded eagerly (~600KB gzip)
- Eat battery on mobile (uncapped DPR, full-frame redraw on idle)
- Break on iOS Safari (memory limits, missing features)
- Have no fallback when WebGL is disabled or context is lost

This command produces scenes that ship.

## Scene Kinds

| Kind | What | Typical use |
|------|------|-------------|
| `hero` | Camera-locked centerpiece (logo / product / abstract form) | Landing hero |
| `particles` | GPU-instanced field, mouse-reactive | Background ambient |
| `morph` | Vertex-shader morph between geometries | Feature transitions |
| `parallax` | Multi-layer depth on scroll | Long-form storytelling |
| `productShowcase` | Orbit + auto-rotate model viewer | E-commerce hero |
| `logoLoop` | Gallery of brand logos, instanced | Press/social-proof strip |
| `spline` | Wraps a Spline `.splinecode` URL | Designer-built scenes |

## Performance Budget

Default `budget_ms = 8` (per frame, leaves 8.3ms for compositing on 120fps target).

Enforced via:
- DPR cap at `min(window.devicePixelRatio, 1.5)` on mobile, 2.0 on desktop
- Render-on-demand for static scenes (`frameloop="demand"`)
- `useFrame` budget timer — if frame > 8ms, skip non-critical updates next frame
- Instanced meshes for repeats > 20
- Texture compression (KTX2 via `useKTX2`)

## Mobile Strategies

| Strategy | What |
|----------|------|
| `fallback` | Show static poster image; never load three.js on mobile |
| `reduced` (default) | Lower DPR, smaller geometry, fewer particles, skip post-processing |
| `full` | Same as desktop (use only if scene is small + verified) |

## Spline Integration

If `scene_kind = spline`:
- Install `@splinetool/react-spline`
- Take user's Spline URL (`https://prod.spline.design/.../scene.splinecode`)
- Generate component with lazy load, intersection-observer mount, mobile fallback

## Loading Strategy

- Three.js + scene loaded via dynamic import
- Mounted only after IntersectionObserver fires "near viewport"
- Skeleton placeholder occupies the same space → no CLS
- Scene fades in over 400ms with reduced-motion fallback to instant

## Usage

```
/ll-3d-scene hero                                           # default budget
/ll-3d-scene particles --budget-ms 6                        # tighter
/ll-3d-scene productShowcase --location src/Hero.tsx        # custom path
/ll-3d-scene spline --location src/SceneSpline.tsx          # Spline wrapper
/ll-3d-scene hero --mobile-strategy fallback                # static poster on mobile
```

## Output

- `src/components/{scene_name}.tsx` — main component (≤ 200 lines)
- `src/components/{scene_name}-fallback.tsx` — non-WebGL fallback
- `src/components/{scene_name}.css` — sizing, layout, no animation
- `.luna/{project}/3d-scene-report.md` — bundle size, render budget, mobile behavior, Lighthouse delta

## Lighthouse Guard

After generation, agent runs Lighthouse before/after:
- Performance must drop ≤ 5 points
- LCP must remain ≤ 2.5s mobile / 1.8s desktop
- TBT must remain ≤ 200ms
- If thresholds breached, agent suggests reverting to `fallback` strategy

## Rules

- **Max 200 lines per file**
- **No eager three.js import** — always dynamic
- **No DPR > 2** — diminishing returns vs cost
- **No requestAnimationFrame leaks** — every `useFrame` must check `gl.info` and unmount cleanly
- **WebGL context loss handler** — `gl.domElement.addEventListener('webglcontextlost')` swaps to fallback
- **Reduced motion** — auto-rotate disabled, scene becomes static frame
- **Battery API** — if `navigator.getBattery().level < 0.2 && !charging`, downgrade to fallback
- **Tab visibility** — pause `useFrame` when `document.hidden`

## In Pipes

```bash
/pipe ll-3d-scene hero >> ll-boutique --aesthetic awwwards
/pipe ll-boutique MyStudio >> ll-3d-scene productShowcase >> ship
/pipe ll-3d-scene spline --location Hero.tsx >> ll-motion install
```
