# AMLIQ — Brand & DALL·E Asset Prompts

Single source for all brand-asset generation. Copy the prompt block into
DALL·E 3 (ChatGPT / API) as-is. Every prompt enforces Apple HIG aesthetics
(clear, calm, content-first), transparent backgrounds where relevant,
and pixel dimensions that match the frontend embed targets.

---

## Brand system (canonical)

- **Product name**: AMLIQ
- **Pronunciation**: *am-liq* (rhymes with "click")
- **Positioning**: AI-Enhanced Global Intelligence Screening
- **Tagline (primary)**: *Clarity at every transaction.*
- **Tagline (alt, short)**: *Screen smart. Decide fast.*
- **Tagline (alt, institutional)**: *Global intelligence. Instant clarity.*
- **Voice**: calm, precise, confident. Never breathless.
- **Audience**: compliance officers, CTOs, FinTech founders.

### Color tokens

| Token | Hex | Use |
|-------|-----|-----|
| `amliq.ink` | `#0A2540` | Primary mark, headlines |
| `amliq.sky` | `#0066CC` | Interactive, links (SF Blue) |
| `amliq.signal` | `#F59E0B` | Alerts, highlights (sparingly) |
| `amliq.clear` | `#10B981` | Success, "cleared" states |
| `amliq.mist` | `#F5F7FA` | Canvas |
| `amliq.graphite` | `#1C1C1E` | Dark mode canvas |

### Typography

- Display: **Inter Tight** 600/700 (web), **SF Pro Display** (macOS/iOS)
- Body: **Inter** 400/500
- Mono (IDs, codes): **JetBrains Mono** 400

### Visual concept — *Aperture Shield*

A stylised rounded-triangle shield with a single horizontal "scan line"
cutting across two-thirds of the way up. Reads simultaneously as
(a) a protective shield and (b) an aperture / screening lens. No
serifs, no noise, no gradients with more than two stops. Always
renders flat at small sizes.

---

## 1. Logo — primary mark

**Use**: navbar (32–48px height), marketing header, PDF reports.
**Format target**: 1024×1024 PNG with transparent background → convert
to SVG via Illustrator / `vtracer` after generation.

```
A minimalist flat vector logo mark for "AMLIQ", a financial
sanctions-screening platform. A single geometric shape: a rounded
equilateral triangle shield, slightly taller than wide, with one
clean horizontal scan line cutting across at the upper third. Deep
navy ink color #0A2540 on a fully transparent background. No text,
no wordmark, no gradient, no shadow, no bevel, no 3D effects, no
background elements. Perfectly symmetrical, crisp vector edges,
Apple Human Interface Guidelines aesthetic: calm, precise, content-
first. 1024x1024 square canvas, centered, with generous padding so
the mark occupies the central 60% of the frame. Style: flat
geometric iconography, reminiscent of SF Symbols and the Stripe
logo system. No photographic elements. No text anywhere in the
image.
```

**Generate 4 variations**, then pick the cleanest. Post-process:
1. Open in Illustrator → Image Trace → Expand.
2. Snap anchor points to integer pixel grid.
3. Export `logo.svg` (single path, currentColor-ready).

### Logo — monochrome variants (also generate)

```
Same mark as above, rendered in pure white (#FFFFFF) on a transparent
background. Identical geometry.
```

```
Same mark as above, rendered in pure black (#000000) on a transparent
background. Identical geometry.
```

---

## 2. Wordmark — name + mark lockup

**Use**: landing hero, email signature, slide decks.

```
A horizontal logo lockup: the AMLIQ aperture-shield mark (rounded
triangle with a horizontal scan line across the upper third, deep
navy #0A2540) on the LEFT, followed by the wordmark "AMLIQ" in
Inter Tight Semibold, all-caps, tracked +40, same navy color, same
visual weight as the mark. 8px of clear space between mark and
wordmark. Transparent background. 1600x400 canvas, centered. Apple
HIG aesthetic, flat vector, no effects. Render the word AMLIQ
clearly, legibly, correctly spelled A-M-L-I-Q, no ligatures, no
decorative glyphs. No other text, no subtitle, no tagline in the
image.
```

> DALL·E wordmark spelling is unreliable. **Plan B**: generate mark
> only, compose the wordmark in Figma / CSS using Inter Tight.

---

## 3. Hero banner

**Use**: marketing site top fold (1920×1080 → responsive).

```
A wide cinematic hero banner for a financial sanctions-screening
SaaS. Aspect ratio 16:9, 1920x1080. Abstract composition: a large
soft-focus gradient orb in deep navy #0A2540 blending into SF blue
#0066CC, positioned in the right third of the frame. Faint
concentric ripple rings radiating from the orb suggest real-time
screening at global scale. Left two-thirds: negative space (pale
mist #F5F7FA) reserved for headline text (do NOT render the text —
leave this area clean). A single thin amber #F59E0B horizontal
accent line, 2px, sits 40% down from the top, spanning 20% of the
width on the left side. No people, no hands, no devices, no code,
no user interface screenshots, no lock icons, no shields. Style:
Apple keynote slide, Stripe marketing, Linear hero; calm, premium,
minimalist, editorial. Matte finish, no photorealism, no glare.
```

---

## 4. App icon (iOS/macOS/Dock)

**Use**: iOS home screen, macOS Dock, PWA install icon.

```
An iOS/macOS app icon for "AMLIQ" sanctions screening app. 1024x1024
square canvas with the standard iOS rounded-square mask (iOS 17
superellipse / squircle shape). Background: a smooth vertical
gradient from deep navy #0A2540 at the top to SF blue #0066CC at
the bottom. Centered on top: the AMLIQ aperture-shield mark
(rounded triangle with a horizontal scan line at the upper third)
in pure white #FFFFFF, occupying the central 55% of the icon. No
text, no letters, no numbers anywhere in the icon. No shadow
beneath the mark. Subtle inner highlight at the top edge of the
squircle for depth, no harsh gloss. Apple HIG icon guidelines:
legible at 40x40 px, no fine detail that would disappear when
scaled. Flat vector style, no skeuomorphism.
```

**Export ladder** (from 1024): 1024, 512, 256, 180 (iOS), 167 (iPad),
152, 120, 87, 80, 76, 60, 58, 40. Use ImageMagick:

```bash
for s in 1024 512 256 180 167 152 120 87 80 76 60 58 40; do
  magick icon-1024.png -resize ${s}x${s} icon-${s}.png
done
```

---

## 5. Favicon

**Use**: browser tab, `<link rel="icon">`. 32×32 is the hero size;
16×16 must still be readable.

```
A favicon-scale version of the AMLIQ aperture-shield mark. 512x512
square canvas, transparent background. The shield mark fills 85% of
the frame (minimal padding) in deep navy #0A2540, with the
horizontal scan line clearly visible and pixel-aligned. Solid flat
color, no gradient, no shadow, no shine. Maximum legibility at
16x16 pixels: every edge must snap cleanly to a 16-unit grid. No
text, no letters, no wordmark.
```

**Post-process pipeline**:

```bash
# Generate the .ico bundle (16, 32, 48)
magick favicon-512.png -resize 48x48 favicon-48.png
magick favicon-512.png -resize 32x32 favicon-32.png
magick favicon-512.png -resize 16x16 favicon-16.png
magick favicon-16.png favicon-32.png favicon-48.png favicon.ico

# Modern browsers prefer the SVG
# (hand-author or Illustrator-trace favicon-512 → favicon.svg)
```

`<head>` embed:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
```

---

## 6. Social / OpenGraph card

**Use**: Twitter, LinkedIn, Slack unfurls. 1200×630.

```
A social preview card for AMLIQ, 1200x630. Left half: the horizontal
AMLIQ wordmark lockup (aperture-shield mark + "AMLIQ" in Inter Tight
Semibold) in deep navy #0A2540, vertically centered, with the
tagline "Clarity at every transaction." beneath it in Inter
Regular, SF gray #6B7280. Right half: a soft navy-to-SF-blue
gradient orb with faint concentric ripple rings, matching the hero
banner treatment. Pale mist #F5F7FA background. 64px padding on
all sides. Apple keynote aesthetic. No photos, no devices, no UI
screenshots. Render text accurately and legibly — "AMLIQ" spelled
A-M-L-I-Q, and the full tagline line "Clarity at every transaction."
```

> Text in DALL·E is unreliable at this size. **Plan B**: generate
> the orb-only right-half background, then composite the wordmark +
> tagline in Figma using the real typefaces.

---

## 7. Slogan / verbal identity (not for DALL·E)

Copy these into `web/src/branding/slogans.ts`:

```ts
export const slogans = {
  primary: "Clarity at every transaction.",
  short:   "Screen smart. Decide fast.",
  institutional: "Global intelligence. Instant clarity.",
  productLine: "AI-Enhanced Global Intelligence Screening",
} as const;
```

Usage rules:

- **Primary** on hero + homepage + first-touch sales.
- **Short** on dashboard empty-states + auth screens.
- **Institutional** on enterprise decks + RFP responses.
- Never combine two slogans in the same viewport.
- Never localise the product name ("AMLIQ" stays Latin ASCII).

---

## 8. Frontend embedding (React + Vite)

Target tree:

```
web/public/
  favicon.ico
  favicon.svg
  icon-180.png           # apple-touch-icon
  og-card.png            # 1200x630
web/src/assets/brand/
  logo.svg               # mono, currentColor
  logo-navy.svg          # #0A2540 baked in
  logo-white.svg         # #FFFFFF baked in
  wordmark.svg           # mark + AMLIQ lockup
  hero-orb.svg           # banner right-half, standalone
```

`web/src/assets/brand/logo.tsx`:

```tsx
import Logo from './logo.svg?react';

export function AmliqLogo({ className = 'h-8 w-auto text-ink' }) {
  return <Logo aria-label="AMLIQ" className={className} />;
}
```

`web/index.html` head (Vite):

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
<meta name="theme-color" content="#0A2540">
<meta property="og:title" content="AMLIQ — Clarity at every transaction.">
<meta property="og:image" content="/og-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

Tailwind tokens — add to `web/tailwind.config.ts`:

```ts
colors: {
  ink:      '#0A2540',
  sky:      '#0066CC',
  signal:   '#F59E0B',
  clear:    '#10B981',
  mist:     '#F5F7FA',
  graphite: '#1C1C1E',
}
```

---

## 9. Generation checklist

- [ ] Run Prompt 1 → pick best, trace to SVG, commit `logo.svg`.
- [ ] Run Prompt 1 mono variants → `logo-white.svg`, `logo-black.svg`.
- [ ] Run Prompt 2 for wordmark **or** compose in Figma (preferred).
- [ ] Run Prompt 3 → hero banner PNG, then trace gradient/orb for SVG.
- [ ] Run Prompt 4 → app icon 1024, export the ladder, drop into
      `web/public/icons/`.
- [ ] Run Prompt 5 → favicon 512, build `.ico` bundle + `favicon.svg`.
- [ ] Run Prompt 6 → OG card (or Figma-compose for text accuracy).
- [ ] Wire Tailwind tokens + `<head>` block above.
- [ ] Run Lighthouse + WebAIM contrast check on every token pair
      actually used on screen.
