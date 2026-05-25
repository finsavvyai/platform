# Qestro — Logo Specifications

## Concept

**The Q-ring-with-signal**: a perfect circular ring with a short 45-degree tail, plus a small dot at the center of the ring.

### Rationale

- **The ring** = a test loop. Tests run, return, run again — the core metaphor of continuous testing.
- **The tail** = forward motion. Not static surveillance; shipping.
- **The center dot** = the signal. A cursor, a pulse, an AI probe — the "something is happening" marker. Reads as a confident stop-to-listen before the next iteration.
- **Combined**: a Q that is unmistakably a Q, but also reads as a stylized playback/test-run icon at small sizes. Serves both brand identity and functional icon use.

Precedent aesthetic: the Linear "L", the Vercel triangle, the Raycast square — a single geometric letter that becomes a memorable app icon without ever needing a wordmark to be understood.

## Variations

### 1. Primary square mark (the LinkedIn-ready one)

- **Canvas**: 512x512 (scales cleanly to 2048, 1024, 256, 128, 64, 32, 16)
- **Container**: rounded square, corner radius = 22% of canvas (`rx="112"` on 512)
- **Background**: `--gradient-hero` (violet 500 → 600 → 900, 135°)
- **Mark**: pure white ring + tail + dot
- **Mark size**: ~60% of canvas (fills confidently without crowding)
- **File**: `brand-assets/logo-v0.svg`

### 2. Horizontal lockup (website header, email signature)

- **Layout**: mark (left) + wordmark "Qestro" (right)
- **Wordmark**: Inter 700, tracking `-0.02em`, sized to match cap-height of mark
- **Spacing**: mark-to-wordmark gap = 1x mark-stroke-width
- **Mark color**: can drop the gradient container — solid `--brand-primary` (`#7C3AED`) ring on transparent is fine here since text provides context
- **Wordmark color**: `--text-primary` (adapts to theme)

### 3. Stacked lockup (pitch decks, merch)

- **Layout**: mark (top) + wordmark (bottom)
- **Spacing**: vertical gap = 0.5x mark-height
- **Use only when**: horizontal won't fit the aspect ratio

### 4. Symbol-only (app icon, favicon, OG image corner)

- **Same as primary square mark**, but available in:
  - `brand-assets/logo-v0.svg` (full gradient)
  - `brand-assets/logo-mono-white.svg` (white on transparent — for colored backgrounds)
  - `brand-assets/logo-mono-black.svg` (`#1D1D1F` on transparent — for white backgrounds)

### 5. Wordmark-only (legal footers, inline text)

- **Inter 700**, tracking `-0.02em`
- **Color**: `--text-primary`
- Use when the symbol would add visual noise in a pure-text context

## Clear Space

Minimum padding around the logo = **1x the height of the ring stroke** (42px on a 512 canvas, scales proportionally). No other graphic element — rule, icon, typography — may enter this zone.

On the LinkedIn-ready square mark, the built-in padding is already 15%+ on all sides; no additional clear space is needed for OAuth-app-style uses.

## Minimum Sizes

| Context | Minimum size | Notes |
|---|---|---|
| Digital — square mark | 24 x 24 px | Below this, the center dot starts to blur |
| Digital — horizontal lockup | 96 px wide | Below this, the wordmark drops off |
| Digital — favicon | 16 x 16 px | Use a special 16px variant with thicker ring stroke (see "Optical adjustments") |
| Print — square mark | 12 mm |
| Print — horizontal lockup | 30 mm wide |

## Color Usage

### On violet gradient (default, preferred)
- Ring, tail, and center dot in pure white (`#FFFFFF`)

### On dark solid (`#0A0B0F`, `#14151A`)
- Ring, tail, and center dot in `--brand-primary-500` (`#8B5CF6`) OR pure white — designer's call based on surrounding mood

### On light solid (`#FFFFFF`, `#F5F5F7`)
- Ring, tail, and center dot in `--brand-primary-800` (`#5B21B6`) for AAA body-text contrast
- Never use `#8B5CF6` on white — drops below AA for small-size text pairing

### Monochrome
- Black-on-white or white-on-black. No grays. No half-tones.

### Reversed (on photography, on a brand hero image)
- Always white mark on a 40-50% black scrim. Never place the mark directly on unmodified photography.

## Optical Adjustments at Small Sizes

### 32x32 px and below
- Increase ring stroke by 15% (proportional). This compensates for sub-pixel rendering that visually thins strokes.
- The center dot may need to enlarge by ~25% to stay perceptible.
- Ship a dedicated 16x16 favicon SVG; don't auto-downscale.

### Retina / @2x / @3x
- Always ship SVG. The current `logo-v0.svg` is resolution-independent and preferred over any raster export.
- If a raster is required, export at 2x the display size and let the browser downscale (anti-aliasing > upscaling).

## Forbidden Modifications

Never:

- Skew, rotate (beyond 0°), or flip the mark
- Change the stroke weight of the ring relative to the tail
- Recolor the center dot to anything other than the ring color
- Add a drop shadow, outer glow, bevel, or inner gradient to the mark itself (the container can keep its hero gradient)
- Place the mark inside a second container (rounded square inside a circle inside a square = no)
- Use the wordmark in any font other than Inter 700
- Increase letter-spacing on the wordmark — it's engineered tight on purpose

## Construction Grid (for future redraws)

The primary square mark is built on a 512-unit grid:

- Canvas: 512 x 512
- Corner radius: 112 (≈22%)
- Ring center: (256, 246) — 2.5% above true center for optical balance (the tail adds visual weight below)
- Ring radius: 118 (center-line)
- Ring stroke: 42
- Tail: from (316, 306) to (378, 368), stroke 42, round caps
- Center dot: radius 14, solid fill

Any future vector edits should preserve these ratios — the geometry is tuned to survive LinkedIn's circular crop and 32x32 downscaling simultaneously, which is a tight design window.
