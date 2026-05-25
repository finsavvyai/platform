# Qestro — Brand Identity Report

**Generated**: 2026-04-17
**Scope**: Advisory. Files live in `.luna/qestro/brand/`. No in-place code changes were made.
**Style direction**: modern + slight AI-futurism. References: Linear, Vercel, Raycast, Notion.

## Immediate next action (LinkedIn OAuth)

You need a 512x512 PNG for LinkedIn right now. Two paths:

### Fast path (15 seconds)
1. Open `.luna/qestro/brand/brand-assets/logo-v0.svg` in Chrome.
2. Take a 512x512 screenshot, OR run:
   ```bash
   brew install librsvg
   rsvg-convert -w 512 -h 512 \
     /Users/shaharsolomon/dev/projects/portfolio/qestro/.luna/qestro/brand/brand-assets/logo-v0.svg \
     > ~/Desktop/qestro-linkedin.png
   ```
3. Upload `~/Desktop/qestro-linkedin.png` to LinkedIn OAuth app settings.

### AI path (5 minutes)
Paste the **DALL-E 3 prompt** from `logo-prompts.md` section "Winning Prompt". That prompt is engineered for LinkedIn's constraints (no text clipping, 32px legibility, light+dark background safety).

## Deliverables

All files in `/Users/shaharsolomon/dev/projects/portfolio/qestro/.luna/qestro/brand/`:

| File | Purpose | Immediate use? |
|---|---|---|
| `brand-foundation.md` | Name, tagline, mission, voice, tone | Reference for website copy |
| `color-system.md` | Full palette rationale + WCAG matrix | Design docs |
| `color-tokens.css` | Drop-in CSS variables | Merge into `themes.css` (optional) |
| `tailwind-brand.config.ts` | Tailwind extension proposal | Merge into `tailwind.config.js` (optional) |
| `logo-specifications.md` | Construction grid, clear space, forbidden modifications | Design ops reference |
| **`logo-prompts.md`** | **DALL-E 3 / MJ v6 / SDXL prompts for logo generation** | **Use today for LinkedIn** |
| `typography-system.md` | Inter + JetBrains Mono scale | Design docs |
| `brand-guide.html` | Interactive, self-contained, click-to-copy | Open locally, share via screenshots |
| `brand-assets/logo-v0.svg` | **Works-in-15-seconds LinkedIn logo** | **Rasterize and upload now** |
| `brand-assets/color-palette.svg` | Shareable palette card | Slack, pitch decks |

## Brand foundation summary

- **Tagline** (keep the current one): *"The copilot for testing AI vibe coding."*
- **Voice**: confident, technical, understated — Linear / Vercel / Raycast school
- **Values**: precision over noise · calm velocity · respect the developer · honesty about failure · cross-surface by default
- **Never do**: stock photos of people pointing at laptops; superlatives stacked three-high; apologize for being technical

## Color system summary

- **Primary**: Violet `#7C3AED` (unchanged from your current `--brand-primary`). Full 50-950 scale defined.
- **Secondary**: Blue `#3B82F6`. Used for links, info state, data-viz second series.
- **Accents** (rare, never stacked): Cyan `#06B6D4` for AI-generated tags; Magenta `#EC4899` for self-heal callouts.
- **Neutrals**: 12-step scale grounded in Apple HIG light mode + your existing `#0A0B0F` dark mode.
- **Semantic**: Success `#10B981`, Warning `#F59E0B`, Error `#EF4444` — unchanged from your `themes.css`.
- **Hero gradient**: `linear-gradient(135deg, #8B5CF6 0%, #7C3AED 55%, #4C1D95 100%)` — new, for logo container and landing hero only.
- **Auth gradient**: your existing `#0f0c29 / #302b63 / #24243e` — preserved, for login flow.
- **Contrast**: every brand-foreground/background pair has a documented WCAG rating; see `color-system.md`. The one watchout: use `--brand-primary-800` not `-600` for violet body copy on white.

## Logo system summary

- **Concept**: a capital Q built from a ring + 45-degree tail + center dot. Reads as Q at all sizes, but also doubles as a "test-loop + signal" functional icon.
- **Primary variant**: white mark on violet gradient inside a rounded-square (22% corner radius) — tuned to survive LinkedIn's circular crop and 32x32 downscale simultaneously.
- **Wordmark**: Inter 700 at -0.02em tracking. Horizontal and stacked lockups specified.
- **Forbidden**: drop shadows, rotation, wordmark in any non-Inter font, glow effects, skew. See `logo-specifications.md` for the full list.

## Typography summary

- **No font changes** — Inter + JetBrains Mono already loaded. Document formalizes the scale.
- **Scale**: 12px caption → 64px display, 10 sizes. Tight letter-spacing on large display sizes (-0.03em at 64px).
- **Pairing rule**: Inter medium labels with JetBrains Mono values in data-heavy UI. This is the "scientific instrument" look that anchors the Linear/Vercel aesthetic.

## What's intentionally out of scope

- **No code changes**. `tailwind-brand.config.ts` is a proposal, not wired in.
- **No asset overwrites**. Existing Sparkles icon in `LoginPage.tsx` and `Header` is untouched.
- **No new pages or components**. This is pure brand documentation + assets.
- **No logo variants beyond the primary square mark**. Horizontal/stacked lockups are specified but not drawn — add in a follow-up if you decide to adopt the Q-ring mark.

## Recommended next steps (in order)

1. **Now (5 minutes)**: Upload `logo-v0.svg` to LinkedIn. Done.
2. **This week**: Skim `brand-foundation.md`, decide if the tagline + voice match your taste. Adjust freely — this is a draft.
3. **Before public launch**: Generate 2-3 AI variants using the DALL-E prompt, A/B against `logo-v0.svg` for your team. Pick a winner.
4. **At Q2 2026 launch**: Merge `color-tokens.css` and `tailwind-brand.config.ts` into the frontend (optional — your existing tokens already work). Replace Sparkles icon in `Header` with the new Q mark.
5. **Before enterprise push**: Commission a professional vector refinement of the chosen logo (the v0 is solid but a vector designer will tighten the tail geometry by ~5%).

## Open questions for you

- **Do you want a non-Q mark as an alternative?** The Q-mark is on-brief but some founders prefer abstract marks (Vercel, Linear). I can generate 2-3 abstract alternatives in a follow-up.
- **Brand color drift — keep violet or pivot?** Violet is safe and inherited from your existing code. If you want to differentiate from the sea of violet AI tools (Anthropic, Vercel AI, etc.), consider a "Qestro cyan" (`#06B6D4`) primary instead — rarer, more "precision instrument". Your call.
- **Wordmark in logo — include or not?** I argued for the pure-symbol variant for small sizes. If you want the full lockup as the primary logo, say so and I'll generate it.
