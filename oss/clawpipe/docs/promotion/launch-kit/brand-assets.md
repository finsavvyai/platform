# Brand assets — AI generation prompts

## Brand constants (use in every prompt)

- **Accent color:** `#6e56cf` (violet — primary brand)
- **Background:** `#0a0a0f` (near-black, slight violet undertone) for dark mode; `#fafafa` for light variants
- **Typography intent:** clean geometric sans-serif (Inter, Söhne, or similar). JetBrains Mono for code. Generous letter-spacing on headlines, tight on body. Apple-quality restraint — no shadows, no glows unless functional.
- **Composition:** content-first, lots of negative space, no AI-generated faces, no stock-photo people, no clipart. Diagrammatic, geometric, calm.
- **Forbidden elements:** drop shadows beyond functional elevation, neon glows, lens flares, generic rocket/ai-brain icons, photorealistic robots, Helvetica (overused).

When pasting into Midjourney, append `--ar <ratio> --style raw --v 6` (or the current model). For DALL-E and Imagen, the prompts are written for direct paste; the aspect ratio is encoded in the prompt itself.

---

## 1. Twitter / X header (1500×500)

```
Wide horizontal banner, 1500×500 pixels, near-black background #0a0a0f with
subtle violet vignette. Six glass-morphism rounded rectangle nodes arranged
left-to-right with soft connector lines flowing between them, labeled in
clean geometric sans-serif: "Booster", "Packer", "Cache", "Router",
"Gateway", "Learner". Each node has a single thin violet accent
(#6e56cf) on its top edge. The first node, "Booster", glows slightly
brighter than the others to anchor the eye. ClawPipe wordmark in the
upper-left corner using a clean modern sans-serif, "Claw" in white,
"Pipe" in violet. Negative space dominant. No human figures, no clipart,
no stock-photo elements, no decorative gradients beyond the vignette.
Apple-quality restraint, AI-engineering-publication aesthetic.
```

---

## 2. Open Graph default image (1200×630)

```
Centered hero composition, 1200×630 pixels, dark background #0a0a0f.
Large headline in clean sans-serif white text reading "Skip the LLM."
across the upper-third. Beneath it, a single-line subhead in lighter
weight: "The only AI gateway with a deterministic Booster stage."
Bottom-third: a thin violet accent line (#6e56cf) and the ClawPipe
wordmark (white "Claw" + violet "Pipe") with the URL "clawpipe.ai" in
muted gray. No imagery in the center — the whitespace IS the design.
Generous letter-spacing on the headline. No icons, no glow effects, no
gradients. Restrained, editorial, like a New Yorker tech-essay header.
```

---

## 3. GitHub social preview (1280×640)

For repo `github.com/finsavvyai/clawpipe-sdk`.

```
Wide horizontal social card, 1280×640 pixels, dark background #0a0a0f
with subtle violet ambient lighting from the lower-right corner. Centered:
the ClawPipe wordmark in large clean sans-serif (white "Claw", violet
"Pipe" #6e56cf). Below: monospace text reading "npm i clawpipe-ai" in
JetBrains Mono with a faint terminal-prompt "$" prefix in violet.
Bottom-strip: three small badges in row reading "MIT", "647 tests",
"21 providers" in light gray on transparent background, separated by
thin vertical dividers. No decorative imagery, no robots, no abstract
gradients. The composition reads like a Vercel or Linear OG image —
restrained, technical, premium.
```

---

## 4. Dev.to / Hashnode cover images (1000×500 each)

### 4a. Article 1 — "Booster architecture"

```
Horizontal cover, 1000×500 pixels, dark background #0a0a0f. Center-left:
the word "skip" rendered very large in clean sans-serif white, with a
single violet (#6e56cf) horizontal strikethrough line across the entire
word — visually expressing the act of skipping. To the right of "skip",
in smaller weight on two stacked lines: "the LLM" in white, "stage" in
muted gray. Lower-right corner: tiny ClawPipe wordmark. Generous
negative space. No icons, no diagrams, no people. Editorial typography
poster aesthetic. Letter-spacing slightly loose for the hero word.
```

### 4b. Article 2 — "21 providers ranked"

```
Horizontal cover, 1000×500 pixels, dark background #0a0a0f. A vertical
ranking column on the left with the numbers 1 through 5 stacked in
medium-weight sans-serif white, slightly faded for ranks 4 and 5.
Adjacent to each number, a thin violet (#6e56cf) horizontal bar of
varying length suggesting a leaderboard — bars get progressively shorter
from rank 1 down. No labels visible (intentionally — the article
provides them). Right side: large headline in white sans-serif reading
"21 providers, ranked" with the number "21" in violet for emphasis.
Bottom-right corner: small ClawPipe wordmark. Editorial chart
aesthetic, like a New York Times data graphic header.
```

### 4c. Article 3 — "Stripe to LemonSqueezy"

```
Horizontal cover, 1000×500 pixels, near-black background #0a0a0f.
Centered: two simple geometric shapes side-by-side connected by a thin
horizontal arrow in violet (#6e56cf). The left shape: a solid white
rounded square with the word "Stripe" in clean sans-serif at its
center. The right shape: identical rounded square in white with the
word "Lemon" on top line and "Squeezy" beneath, also clean sans-serif.
Above the shapes, in small light-gray text: "1 day". Below, in tiny
light-gray text: "MoR migration". No fruit illustrations, no payment
icons, no credit card visuals. Clean, schematic, almost diagrammatic.
ClawPipe wordmark in lower-right corner.
```

---

## 5. Slack emoji set (128×128 each, 5 emojis)

Each emoji must be readable at 22×22 (Slack's display size) AND look polished at 128×128 hover-preview.

### 5a. `:clawpipe-logo:`

```
Square 128×128 emoji. Centered: a stylized claw glyph in violet (#6e56cf)
made from three converging curved strokes meeting at a central point —
abstract, geometric, not literal. Transparent background. No drop shadow.
No text. Reads cleanly when scaled to 22×22.
```

### 5b. `:booster:`

```
Square 128×128 emoji. Centered: a single upward-pointing chevron in violet
(#6e56cf) with a thin horizontal bar beneath it forming a stylized rocket
silhouette without being literal. Geometric, two-stroke composition.
Transparent background. No flames, no smoke, no detail noise. Reads as
"forward / accelerate" at any scale.
```

### 5c. `:cache-hit:`

```
Square 128×128 emoji. Centered: a green (#22c55e) checkmark inside a
rounded square outline in white. The checkmark is medium-weight, slightly
oversized to fill the square. Transparent background. No text, no extra
detail. Universal "success / matched" symbol, restyled for ClawPipe.
```

### 5d. `:fallback:`

```
Square 128×128 emoji. Centered: a curved arrow in amber (#f59e0b) bending
back on itself in a U-shape, suggesting "rerouted" or "tried alternate
path". Single-stroke, medium weight. Transparent background. No text. No
secondary elements. Reads at any scale as "fallback / detour".
```

### 5e. `:savings:`

```
Square 128×128 emoji. Centered: a green (#22c55e) downward arrow with a
thin horizontal baseline beneath it — abstract "cost going down" glyph.
Two-stroke geometric composition. No dollar signs, no money imagery, no
piggy banks. Transparent background. Universal "decrease / savings" symbol.
```

---

## 6. Animated logo loop (concept brief for an animator)

You can't generate animations with image AI; this is a written brief for whoever you hand the work to (Lottie, After Effects, or a code-driven SVG animation).

**Duration:** 2.0 seconds, looping.

**Frame-by-frame intent:**

- **0.0-0.3s:** the ClawPipe wordmark sits static, white "Claw" + violet "Pipe", center-screen on dark background.
- **0.3-0.7s:** a thin violet horizontal line draws itself from left to right across the bottom of the wordmark — like an underline being inscribed. Easing: cubic ease-out.
- **0.7-1.0s:** six small dot markers appear on the line, spaced evenly, representing the six pipeline stages. They appear sequentially with a 50ms stagger.
- **1.0-1.3s:** the leftmost dot (Booster) pulses once — scales from 100% to 130% and back, with a soft violet glow that fades in and out. The other dots stay static.
- **1.3-1.7s:** a thin trace travels from the Booster dot leftward off the line, suggesting "exit before the rest of the pipeline" — this is the visual metaphor for skipping the LLM. The trace fades into nothing past the wordmark's left edge.
- **1.7-2.0s:** all elements hold for the final beat, then the loop restarts smoothly (the line and dots dissolve in the last 100ms so the loop doesn't pop).

**Constraints:**
- No bouncing, no overshoots beyond 5%, no easing curves wilder than cubic.
- Must read at small sizes (header, favicon hover, loading state) — animations should feel "calm" not "fun."
- Single ambient sound effect optional, but default to silent.
- Provide deliverables as: Lottie JSON (preferred for web), SVG-with-CSS-animation fallback, MP4 with transparent background, GIF for Slack.

---

## 7. Conference talk title slide (1920×1080)

For when a CFP gets accepted (think AI Engineer Summit, KubeCon, JSConf-class events).

```
Widescreen 1920×1080 presentation slide, dark background #0a0a0f with
extremely subtle violet vignette in the lower-right quadrant. Composition:
left-aligned, generous left margin (~15% of width).

Top stripe: a thin violet (#6e56cf) horizontal line, 4 pixels tall,
spanning the full width.

Hero block (occupies vertical center, left-aligned):
- Eyebrow text in light gray uppercase, small weight: "ClawPipe"
- Title in large bold white sans-serif: "Skip the LLM."
- Subtitle in medium-weight white sans-serif beneath: "Building deterministic
  pre-LLM stages that apply pre-LLM compression and dedup (per-bucket cost-reduction range pending measured benchmark)."
- Speaker block beneath, smaller, in two lines: "[Speaker Name]" in white,
  "Founder, ClawPipe — clawpipe.ai" in muted gray.

Bottom stripe: identical thin violet line mirroring the top.

No imagery. No icons. No conference logo (added in template). No QR code on
title slide (placed on closing slide instead). Editorial restraint
appropriate for a serious technical talk. Letter-spacing on the title hero
slightly loose; body text tight.
```

---

## Notes on production

- **Run each prompt 4-8 times.** AI image generators are stochastic; pick the cleanest result.
- **Hand-fix typography.** AI image models still mangle text. Drop the generated background into Figma/Sketch and re-set the headline using the actual brand typography.
- **Color-correct the violet.** Generators tend to drift toward magenta; sample the result and shift hue back to `#6e56cf` exactly.
- **Export in the right color profile.** sRGB for web, P3 if you're targeting Apple platforms specifically. Avoid CMYK for any of these — they're all screen-only.
- **Keep an asset library.** Once you have a clean hero, OG image, and emoji set, version them under `landing-page/assets/brand/v1/`, `v2/`, etc. Don't overwrite. Later launches will want to A/B against earlier visuals.
