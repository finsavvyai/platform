# Page Override: `/marketplace`

> Inherits from `design-system/opensyber-web/MASTER.md`. Only deviations are listed.

**Route:** `apps/web/src/app/marketplace/`
**Role:** Skill marketplace — browse, install, manage AI/security skills. Includes `[slug]` detail and `bundles` (e.g., $99/mo AI bundle).

---

## Layout

```
┌──────────────────────────────────────────────────┐
│  Filter rail (240px)  │  Skill grid (3 cols)     │
│  - Category checkboxes │  ┌──┐ ┌──┐ ┌──┐         │
│  - Price range         │  │  │ │  │ │  │         │
│  - Vendor              │  └──┘ └──┘ └──┘         │
│  - Verified only ☐    │  ┌──┐ ┌──┐ ┌──┐         │
│                        │  │  │ │  │ │  │         │
└──────────────────────────────────────────────────┘
```

Filter rail: `--panel` bg, sticky to top of scroll area. Grid uses MASTER `.card` with corner mark.

## Skill card spec

Each card shows:

- Icon (24×24 SVG, never emoji)
- Skill name — DM Sans 16px medium
- Vendor — Space Mono 11px uppercase, `--text-secondary`
- One-line description — DM Sans 13px, `--text-secondary`, max 2 lines (overflow ellipsis)
- Stats row — Space Mono: `★ 4.7` · `1.2K installs` · `Verified ✓` (badge in `--ok`)
- Price — Bebas Neue 24px, e.g., `$0` / `$29/mo` / `$99/mo`
- CTA: `INSTALL` (Space Mono uppercase, full-width on hover reveal)

### Bundle card variant

Bundles get a thicker corner mark (4px not 2px), `--signal` glow on hover, and explicit "BUNDLE — N skills" Space Mono header.

## `/marketplace/[slug]` detail page

Two-column: left = description + screenshots + changelog, right = sticky install panel with version selector + parameter form.

- Screenshots in carousel-style row but **without auto-rotation** (manual arrows only)
- Parameter form: each param shows the JSON schema field name in Space Mono on hover
- Install button confirms via modal showing exact permissions the skill will request

## Filter behavior

- Updates on debounced 200ms typing for search
- Filters persist in URL query string
- Empty results: show `[NO MATCH]` Space Mono header + suggested filter relax

## Anti-patterns

- Carousel auto-rotation on detail page
- "Most popular" / "Trending" if numbers are <100 installs (don't fake social proof — see `feedback_no_bluffing.md`)
- Modal popups during browse
- Mixing free + paid in same row without clear price differentiation
