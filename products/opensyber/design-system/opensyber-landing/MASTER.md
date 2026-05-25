# OpenSyber Landing — Design System Master

> **LOGIC:** When building a specific page, first check `design-system/opensyber-landing/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, follow the rules below.

**Project:** OpenSyber marketing pages (logged-out routes in `apps/web/src/app/(marketing)/...`)
**Category:** Marketing — B2B security platform conversion
**Brand:** Control Room / "The Operator" (same brand as console — single voice across portfolio)
**Source of truth for tokens:** `docs/opensyber-brand.html`
**Status:** Migration spec
**Generated:** 2026-05-06

---

## Vision

Convert security-conscious developers and SecOps leads in under 90 seconds. Not "approachable cloud security" (Wiz), not "shift-left for everyone" (Snyk). **Operator-grade tooling for people who already know what an EDR is.** Trust comes from specificity, not testimonials.

---

## Color Tokens

Inherits from `design-system/opensyber-web/MASTER.md`. Same dark `--void` background — the marketing site is **also dark**, not a light hero.

**Why dark on marketing**: Distinguishes from every other security vendor (sea of light hero gradients). Reinforces "this is for people who run terminals". Single brand across product + marketing.

---

## Typography

- Hero headline: **Bebas Neue 96px** desktop, 56px mobile, line-height 0.95, letter-spacing 0.01em
- Subhead: DM Sans 20px, `--text-secondary`, max-width 580px
- Section headers: Bebas Neue 56px
- Eyebrow tags: Space Mono uppercase 12px, `--signal`, letter-spacing 0.16em
- Body: DM Sans 16px line-height 1.7
- CTA buttons: Space Mono uppercase 13px, 3px radius, `--signal` background

---

## Page Pattern: Operator Trust Stack

(Overrides skill output of "Social Proof-Focused" — adjusted for hostile-to-marketing target audience.)

Section order (one screen per scroll):

1. **Hero** — page-grid background + scanline overlay
   - Eyebrow: `[OPENSYBER // CONTROL ROOM]`
   - Headline: 5–7 word claim with hard numbers (e.g., "Deploy a hardened agent in 60 seconds")
   - Subhead: one sentence, what it does, no superlatives
   - Primary CTA: `GET ACCESS →` ; Secondary: `READ THE DOCS`
   - Live status indicator showing real platform metric (e.g., agents online, attacks blocked last 24h)

2. **What it does** — 3 columns, no icons-as-emoji
   - Each: Space Mono uppercase label + Bebas Neue stat + DM Sans description
   - Use real numbers (`248ms p95`, `512MB per agent`), not "blazing fast"

3. **Architecture diagram** — wire-frame, `--wire` lines on `--void`, teal signal flowing through
   - Annotated with Space Mono labels
   - Static SVG, no interaction (Linear / Vercel pattern)

4. **Code sample / live demo** — Space Mono terminal block showing actual install
   - Tabbed: `npm` / `bun` / `curl`
   - Real command, copyable

5. **Trust strip** — SOC 2 Type II badge, customer logos in `--text-muted`, no testimonials
   - One line of social proof: `Used by N security teams across X countries` (with real N, X)

6. **Pricing tease** — three tiers, Space Mono prices, link to full pricing

7. **Footer** — minimal, dense, every link reachable in one tab

### What NOT to include

- Hero animation that loops (distraction)
- Testimonial carousel
- "Trusted by" without logos
- Newsletter signup popup
- Live-chat widget on hero
- "Schedule a demo" as primary CTA (gates on a real attempt — show the docs first)

---

## Component Specs

### Hero CTA pair

```css
.cta-primary {
  background: var(--signal);
  color: var(--void);
  font-family: var(--font-mono);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 14px 28px;
  border-radius: 3px;
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
.cta-primary::after {
  content: '→';
  transition: transform 200ms ease;
}
.cta-primary:hover::after { transform: translateX(4px); }
```

### Live metric (hero status)

```css
.live-metric {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
}
.live-metric .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ok);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@media (prefers-reduced-motion: reduce) {
  .live-metric .dot { animation: none; }
}
```

### Section divider

A 1px `--border` line + Space Mono section number on the left:

```html
<div class="section-divider">
  <span>// 02</span>
  <span class="line"></span>
</div>
```

---

## Performance budgets (release-blocking)

- LCP ≤ 1.5s on slow 4G
- CLS = 0
- TBT ≤ 100ms
- JS bundle ≤ 80KB gz for landing route
- Web fonts subset (Latin only) and self-hosted via `/_next/static`

---

## SEO / OG

- Title: `OpenSyber — [primary value prop in ≤55 chars]`
- Meta description: ≤155 chars, lead with hard differentiator
- OG image: 1200×630, dark `--void` bg, Bebas Neue headline, crosshair logo, `--signal` accent corner
- Schema.org: `SoftwareApplication` with `applicationCategory: SecuritySoftware`

---

## Anti-Patterns

All OpenSyber-web anti-patterns apply, plus marketing-specific:

- Light hero gradient (every B2B SaaS does this — boring)
- Stock photos of people with laptops
- "Trusted by industry leaders" without specific names
- Vague headlines ("Empower your team", "Unlock potential", "Reimagine X")
- Wall-of-logos with bad alpha levels (logos must have transparent backgrounds, set to `--text-muted`)
- Testimonials with full-color portrait photos (use Space Mono attribution lines instead)
- Newsletter modals
- Live chat with friendly emoji avatar

---

## Pre-Delivery Checklist

Same as OpenSyber Web, plus:

- [ ] Hero loads complete (text + CTA visible) in ≤1.5s on slow 4G
- [ ] Architecture diagram is SVG (not PNG, not animated GIF)
- [ ] All numbers in copy are real, sourced from production analytics
- [ ] OG image generated and tested with `cards-dev.twitter.com/validator`
- [ ] No emoji in hero, in body, or in OG image
- [ ] No carousels (linear scroll only)
- [ ] Page weight ≤ 200KB total (HTML + CSS + JS, gzipped)
