# Qestro — Logo Generation Prompts

**Goal**: Generate a square, LinkedIn-ready logo (512x512 PNG) that:
- Reads clearly at 32x32 (LinkedIn top-nav) AND 100x100 (feed display)
- Works on both light (#FFFFFF) and dark (#0a0b0f) backgrounds
- Can be flattened to monochrome without losing identity
- Never contains cropped or illegible text

## Recommended Workflow

1. **If you have 15 seconds**: skip AI, rasterize `brand-assets/logo-v0.svg` at 512x512 and upload. It is battle-tested and meets every LinkedIn requirement.
2. **If you have 5 minutes**: run the DALL-E 3 prompt below (best balance of predictability and quality for logos).
3. **If you want artistic exploration**: use the Midjourney prompt and run `--seed` variations.
4. **If you need it fully local / royalty-free**: use the Stable Diffusion XL prompt with a vector LoRA.

---

## Winning Prompt: DALL-E 3 (use this first)

> **Why DALL-E 3**: best adherence to "no text", "centered", and "flat vector" constraints. Midjourney tends to over-embellish logos; SDXL needs a vector LoRA to behave. DALL-E 3 gives the most predictable LinkedIn-safe output on the first run.

```
A minimalist modern tech-company app icon, square format with rounded corners.
A single bold geometric letter Q as the only element, rendered in pure white on
a deep violet-to-indigo diagonal gradient background (from #8B5CF6 top-left to
#4C1D95 bottom-right). The Q is constructed from a perfect circular ring with a
short 45-degree tail that terminates in a rounded cap, suggesting forward motion.
A tiny white dot sits at the exact center of the ring, like a cursor or signal.

Style: flat vector, Apple-app-icon aesthetic, clean geometry, precise proportions,
generous padding around the mark (at least 15% of the canvas on each side so it
survives being displayed at 32x32 pixels). No text, no wordmark, no serifs,
no decorative flourishes, no 3D bevels, no drop shadows, no photorealism,
no gradients inside the Q itself (the Q stays pure white).

Mood: precise, calm, AI-native, trustworthy, premium developer tool.
Reference aesthetic: Linear, Vercel, Notion, Raycast app icons.

Square 1:1 aspect ratio, centered composition, logo fills approximately 60% of the
canvas with the remaining 40% as even violet-gradient padding.
```

**Expected output**: single-element Q mark on a violet gradient square. If DALL-E adds text or extra elements, regenerate with "NO TEXT, NO LETTERS OTHER THAN Q" prepended.

---

## Midjourney v6 Prompt (for artistic variations)

```
minimalist app icon, bold geometric letter Q, circular ring with short diagonal tail and a small dot at center, flat vector design, pure white mark on deep violet-to-indigo diagonal gradient (#8B5CF6 to #4C1D95), rounded-square container, generous padding, premium AI developer tool, Apple app icon style, Linear and Vercel aesthetic, clean precise geometry, no text, no wordmark, no serifs, no 3D, no drop shadow, calm and confident, enterprise-ready --ar 1:1 --style raw --v 6 --s 50 --no text, letters, words, wordmark, serif, shadow, bevel, gradient-inside-mark, realistic, 3d, photo
```

**Notes**:
- `--s 50` (low stylize) keeps Midjourney from adding painterly flourishes.
- `--style raw` suppresses the default Midjourney "beauty" pass that softens logos.
- Run 4 times, pick the one where the Q is most geometrically clean.

---

## Stable Diffusion XL Prompt (local / royalty-free)

**Base model**: SDXL 1.0 + a vector/logo LoRA (e.g. `logo-vector-sdxl-v2` from Civitai).

```
(masterpiece, best quality:1.2), minimalist app icon, bold geometric letter Q,
circular ring with short 45-degree tail, tiny white dot at center of ring,
flat vector logo, pure white mark, deep violet indigo diagonal gradient background,
(#8B5CF6:1.1) to (#4C1D95:1.1), rounded square container, centered composition,
generous padding, premium SaaS app icon, Linear Vercel Notion aesthetic,
clean geometry, (single element:1.3), (no text:1.4), Apple HIG style,
enterprise developer tool, trustworthy precision
```

**Negative prompt**:
```
text, letters other than Q, wordmark, typography, serif, script, signature,
watermark, 3d render, bevel, emboss, drop shadow, photorealistic, photo, blur,
gritty, painterly, multiple letters, decorative flourishes, ornaments, clip-art,
mascot, character, face, hands, low quality, jpeg artifacts, noise, grain
```

**Settings**: 1024x1024, Euler a, 30 steps, CFG 7, seed: random. Upscale winner to 2048 with 4x-UltraSharp, then downsample to 512 for LinkedIn.

---

## LinkedIn Upload Checklist

Before uploading to LinkedIn OAuth app settings:

- [ ] File is exactly **512x512 PNG** (LinkedIn rejects non-square silently and substitutes)
- [ ] File size is **under 4 MB**
- [ ] Padding on all sides is at least **10%** of canvas (LinkedIn crops to circle in some UI)
- [ ] Logo is legible when resized to **32x32** (open the file, zoom out, squint — if the shape survives, ship it)
- [ ] Logo is legible on **both** `#FFFFFF` and `#0a0b0f` backgrounds (paste into a dual-panel preview to confirm)
- [ ] No embedded text (single letters are fine, wordmarks are not)
- [ ] Alpha channel is fine; solid background is safer — LinkedIn's dark-mode preview can make transparent logos disappear

## Export Commands (macOS)

```bash
# Option A — rasterize the v0 SVG with rsvg-convert
brew install librsvg
rsvg-convert -w 512 -h 512 \
  .luna/qestro/brand/brand-assets/logo-v0.svg \
  > ~/Desktop/qestro-linkedin.png

# Option B — Inkscape (if you prefer)
inkscape -w 512 -h 512 \
  .luna/qestro/brand/brand-assets/logo-v0.svg \
  -o ~/Desktop/qestro-linkedin.png

# Option C — from Chrome (no install): open the SVG in a browser,
# screenshot at 512x512, done.
```

## If Your AI Output Fails LinkedIn

Common failure modes and fixes:

| Problem | Fix |
|---|---|
| DALL-E added a wordmark below the Q | Regenerate with "REMOVE ALL TEXT. Only a Q symbol." in the first sentence |
| Midjourney made the Q look painterly | Add `--s 25 --style raw` and rerun |
| The Q is off-center when cropped to circle | Add "with at least 15% padding on every side" explicitly |
| Output has 4 variants stitched together | You used `--repeat`; remove it and run single |
| Colors drift away from brand violet | Quote the hex values: `"exactly #7C3AED"` with quotes |
| Looks too generic / SaaS-template-y | Add "Linear.app app icon" as the reference — it anchors the style |
