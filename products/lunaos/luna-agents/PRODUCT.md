# Product

## Register

brand

## Users

Developers using Claude Code who already live in the terminal and want a real language for composing agent skills, not another GUI workflow tool. Three concentric circles:

1. **Power user** — already installs Luna Agents from npm. Comes to the site for the lexicon and the changelog. Cares about composition, ergonomics, escape hatches.
2. **Evaluator** — heard about Luna Pipes on HN/X. Lands cold. Has 90 seconds to decide if this is a serious language or another wrapper. Reads the home page and one runnable example, then closes the tab or installs.
3. **Language-curious** — reads programming-language papers for fun. Cares that concatenative composition is a real tradition (Forth, Joy, Factor, Unix pipes). Comes for the grammar page.

All three are reading on a 16" laptop, dark room or sunlit cafe, ad-blocker on, JS allowed.

## Product Purpose

Luna Pipes is a small concatenative DSL for composing AI agent skills. The site exists to:

- Establish Luna Pipes as a *language*, not a config format. Specs, grammar, prior art, examples.
- Index 200+ skills as the standard library of that language. Each skill is a callable lexicon entry.
- Convert evaluators in under 90 seconds via one runnable expression and one strong claim.
- Give the power user a permanent reference (lexicon, grammar, changelog) worth bookmarking.

Hosted on `agents.lunaos.ai`. Owner already controls `lunaos.ai`.

## Brand Personality

**Confident, dense, playful.** Three traits held in deliberate tension.

- *Confident* like a senior engineer who has built three other languages before this one and isn't going to soft-sell it. No hedging. No "AI-powered" framing. The language stands on composition primitives, not on the word AI.
- *Dense* like a fine-press reference book. High signal per inch. Marginalia. Footnotes. The reader earns the page; the page repays the read.
- *Playful* like Bun's homepage and Val.town's about page. The pipe operator is fun. The example outputs have jokes. The 404 is a malformed pipe expression. Console has Easter eggs.

The voice is first-person plural for the language itself ("Luna Pipes treats skills as words") and second-person for the reader ("you compose; the runtime executes"). Never marketing-corporate "we empower teams to."

## Anti-references

Explicit no-fly zones. If a draft drifts toward any of these, restart that section.

- **AI SaaS cream + purple gradient.** No `oklch(0.97 0.02 280)` lavender washes. No gradient blobs. No "glass" cards. No purple-to-pink gradient text. Cursor, Replit Agents, every Y Combinator AI startup right now.
- **Dev-tool dark-blue.** No GitHub-default navy. No `#0d1117`. No teal accent on dark blue. Sentry, Linear's old palette, every CLI launch page since 2018. This is the first-order reflex the second-order check rejects.
- **n8n / Zapier marketplace grid.** No 4-column grid of identical icon-card-tile integrations. The skills page is not a marketplace; it's a lexicon.
- **Generic startup landing.** No hero-metric template ("10,000 workflows shipped"). No three-feature grid. No testimonial carousel. No pricing table on the home page. No "trusted by" logo wall.
- **Generic editorial-tech-trendy.** Pink-and-cream serifs + asymmetric grid is its own saturated lane now (every fintech rebrand 2024–2025). We use serif italic display, but pair it with terminal monospace and a saffron drench that nobody in fintech would touch.

## Design Principles

1. **Treat Luna Pipes as a real language.** Grammar, semantics, prior art, edition number, errata. The site is structured like a language reference book, not a SaaS landing.
2. **Lexicon, not marketplace.** Skills are dictionary entries with etymology, call patterns, example sentences, and cross-references. Not tiles in a grid.
3. **Every example is runnable.** Code on the page executes (or simulates) in place. A margin REPL is the gutter of the book. The cursor IS the prompt.
4. **Density rewards reading.** Cap line length, but pack the page. Marginalia, footnotes, sidebars. A reader who scrolls slowly should be rewarded with more, not less.
5. **One drench, not five accents.** Saffron carries 30–60% of identity surfaces. Everything else is ink + paper. The accent green appears only on the pipe operator. Restraint elsewhere makes the drench land.

## Accessibility & Inclusion

WCAG 2.2 AA across the site. Specifically:

- Body copy contrast ≥ 4.5:1 against background, all themes.
- Hero and display type ≥ 3:1 (large-text exemption).
- Full keyboard navigation. Visible focus ring (`outline: 2px solid currentColor; outline-offset: 4px`).
- `prefers-reduced-motion: reduce` honored on every scroll-driven and typing animation. Reduced-motion fallback is the *finished* state, not a degraded one.
- Margin-REPL live regions announced with `aria-live="polite"` and a status word ("ran", "errored").
- Color is never the sole signal. Pipe operator highlighting also gets a weight/letter-spacing change.
- Mono code blocks ≥ 16px on desktop, 15px on mobile.
- Skip-link to main on every page.
- No autoplaying audio. No motion that lasts > 600ms without user trigger.
