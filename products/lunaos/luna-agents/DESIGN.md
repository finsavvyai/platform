# Design

Visual system for `agents.lunaos.ai` — the Luna Pipes language reference site. Follows the [Google Stitch DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/format/). Reads alongside [PRODUCT.md](PRODUCT.md).

## Theme

**Light primary, dark terminal blocks.** Not "light mode" as a toggle — a fixed dual surface. Editorial prose lives on paper. Code lives in terminal. The page is a typeset book with terminal sessions glued in.

Scene sentence: *a developer reading the Luna Pipes reference on a 16" MacBook in a sunlit cafe on a Sunday afternoon, with the lid tilted, ad-blocker on, scrolling slowly.* The sun forces light theme. The reader's familiarity with terminals forces dark code blocks. Both, deliberately, together.

No dark toggle. The terminal blocks are not "dark mode"; they are terminals. Treating them as a toggle would collapse the metaphor.

`prefers-color-scheme: dark` is honored only for the system chrome (scrollbars, form controls). Page surfaces stay editorial-light.

## Color

OKLCH throughout. **Committed strategy** — saffron carries 30–60% of identity surfaces (hero drenches, section dividers, the pipe-prompt at the bottom).

### Tokens

```css
/* Surfaces */
--ink:        oklch(0.18 0.012 70);   /* near-black, warm-tinted toward saffron */
--paper:      oklch(0.975 0.008 85);  /* off-white, warm-tinted */
--paper-deep: oklch(0.94 0.012 80);   /* second paper tone for cards/quotes */
--rule:       oklch(0.86 0.014 75);   /* hairline borders, table rules */

/* Drench */
--saffron:        oklch(0.74 0.165 62);  /* primary brand drench */
--saffron-deep:   oklch(0.58 0.18 50);   /* drench shadow / pressed states */
--saffron-on:     oklch(0.18 0.014 60);  /* ink ON saffron — keeps contrast 7:1 */

/* Accent — pipe operator only */
--pipe-green: oklch(0.86 0.20 125);   /* electric chartreuse, used ≤2% surface */

/* Terminal */
--term-bg:    oklch(0.16 0.012 60);   /* terminal background */
--term-fg:    oklch(0.94 0.008 85);   /* terminal foreground */
--term-dim:   oklch(0.62 0.012 80);   /* comments, prompts */
--term-pipe:  oklch(0.86 0.20 125);   /* pipe operator in code */
--term-warn:  oklch(0.78 0.16 62);    /* saffron echo, warnings */
```

Verified contrast: `--ink on --paper` = 14.3:1. `--saffron-on on --saffron` = 7.1:1. `--term-fg on --term-bg` = 13.8:1. `--pipe-green on --term-bg` = 11.4:1. All pass AA, body passes AAA.

### Strategy

- Most of the site is paper + ink. Saffron arrives in section breaks, the pipe-prompt bar, the home masthead, and one chapter-opener per long page.
- Pipe operator `>>` is the *only* place chartreuse appears outside terminals. It is the language's signature glyph; it gets its own color.
- No gradients. None. Not on text, not on backgrounds. Solid drenches only.
- No black. `#000` is banned. Ink is warmed.
- No white. `#fff` is banned. Paper is warmed.

## Typography

Three-axis pairing. Editorial serif italic for display × neo-grotesque for body × monospace for code/pipes.

```css
--font-display: "Instrument Serif", "Times New Roman", serif;
--font-body:    "Inter Tight", "Inter", system-ui, sans-serif;
--font-mono:    "JetBrains Mono", "Berkeley Mono", ui-monospace, monospace;
```

All three live on Google Fonts (Instrument Serif, Inter Tight, JetBrains Mono) — self-hosted via `@font-face` for performance and offline.

### Scale (1.333 — perfect-fourth)

| Step | Size      | Use                                        |
|------|-----------|--------------------------------------------|
| h1   | clamp(3rem, 10vw, 9rem)  | Home masthead, chapter openers (serif italic) |
| h2   | clamp(2rem, 5vw, 4.5rem) | Section openers (serif italic OR body bold) |
| h3   | 1.777rem  | Subsection headers (body, weight 600)       |
| h4   | 1.333rem  | Lexicon entry headwords (mono, weight 500)  |
| body | 1.0625rem | Default prose, 67ch max width               |
| small| 0.875rem  | Marginalia, footnotes, etymologies          |
| code | 0.9375rem | Inline code, pipe expressions               |

Line-heights: display 0.95 (tight, poster-feel). Body 1.55 (long-form reading). Mono 1.5.

Italics are *deliberate*. Instrument Serif italic is the brand voice — chapter openers, the masthead, pull-quotes. Roman serif is used sparingly for whole-paragraph chapter blocks; ~90% of serif type on the site is italic.

## Layout

**Asymmetric editorial grid.** 12 columns, but content lives on 7. The other 5 are gutter for marginalia, footnotes, and the live REPL.

- Max content width 78ch (≈ 720px). Marginalia uses the adjacent 16ch column on desktop, becomes inline footnotes ≤ 1024px.
- Vertical rhythm in 8px ticks; section breaks in multiples of 96px (12 ticks). Density between, breath at section seams.
- One page can use the full bleed for chapter-opener posters. Posters are saffron-drenched, display type ≥ 8rem, no body copy.

### Components

- **Lexicon entry** — headword (mono), pronunciation-like glyph guide, part-of-speech (verb / operator / aux), one-line gloss, example pipe(s), "see also" cross-refs. Hangs left-aligned with a 4ch hanging indent from the headword.
- **Production rule** — EBNF grammar for the pipe language, in mono, ink on `--paper-deep`. No box, no border; the paper tone *is* the affordance.
- **Pipe-prompt bar** — fixed bottom, saffron drench, a mono input with `>>` glyph and blinking caret. Type any pipe expression; see simulated output above it. Collapsible via `Esc`.
- **Margin REPL** — small terminal panel pinned to the right gutter on desktop. Shows the output of the nearest code block in view. Streams character-by-character (respects reduced motion: appears instant).
- **Section divider poster** — full-bleed saffron, single display word (e.g., "lexicon"), maybe one tiny example pipe in mono below.

No cards. No card grids. No nested cards. Lists are real `<dl>` and `<ol>`, styled with rules and rhythm.

## Motion

- **Type-in animation** on the home pipe expression. 60–80ms per glyph for the first 4 seconds. Then idle.
- **Streaming output** in margin REPL and inline terminal blocks. Append-only; appears as a real run.
- **Page chrome animations**: none. No fades on route change. No section reveals on scroll. Editorial pages don't shimmer.
- All easing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo).
- Durations: 240ms for component state changes, 600ms cap on stream/type animations.
- `prefers-reduced-motion: reduce` → all timed sequences resolve to final state immediately.
- Never animate layout properties. Transforms and opacity only.

## Tone of voice

Match-and-rewrite checklist for copy on this site:

- No em dashes. None. Use commas, colons, periods, parentheses.
- No "powerful". No "modern". No "blazing fast". No "AI-powered".
- No exclamation marks outside terminal output where they're literal.
- Sentence case for headings, except the masthead.
- First-person plural for the language ("Luna Pipes treats…"). Second-person for the reader ("you compose…").
- Footnote voice is allowed to be dry-funny. Body voice is plain.
