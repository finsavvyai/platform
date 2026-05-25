# `agents.lunaos.ai` — the Luna Pipes site

The marketing and reference site for **Luna Pipes**, the concatenative DSL that ships inside `luna-agents`. Hosted at `agents.lunaos.ai`.

Treats the project like a first-edition language reference book. Five pages:

| Path         | Purpose                                                    |
|--------------|------------------------------------------------------------|
| `/`          | Frontispiece — title, masthead, the "hello, world" pipe    |
| `/lexicon`   | The 277-entry standard library, grouped by 45 categories   |
| `/grammar`   | The five operators and the EBNF productions                |
| `/etymology` | Version history, framed as language evolution              |
| `/install`   | npm / Claude Code plugin / source                          |
| `/colophon`  | How this site was set                                      |

## Stack

- **Astro 5** — static, MDX-ready, near-zero JS on most pages
- **Cloudflare Pages** — deploy target, edge-cached
- **Instrument Serif + Inter Tight + JetBrains Mono** — fonts, self-hosted
- **OKLCH** throughout, saffron drench primary

Design system lives in `../DESIGN.md`. Strategic context in `../PRODUCT.md`.

## Develop

```bash
cd site
npm install
npm run dev          # localhost:4321
```

The `predev` and `prebuild` hooks run `src/scripts/build-lexicon.mjs`, which reads `../commands/*.md` and writes `src/data/skills.json`. That JSON is the live corpus the lexicon, frontispiece, and footer counts read from. To refresh after editing commands, run `node src/scripts/build-lexicon.mjs`.

## Build

```bash
npm run build        # dist/
npm run preview      # serve dist/
```

## Deploy

Three paths, in order of laziness:

### 1. PushCI (recommended)

The repo has a `.pushci.yml` at the root. Every push to `main` that touches `site/` or `commands/` rebuilds, audits, and deploys to Cloudflare Pages. PRs get preview URLs.

One-time setup:

```bash
# in the repo root
npx pushci init       # if you haven't already
```

Secrets the pipeline expects (set in the PushCI dashboard):

| Secret           | Notes                                                  |
|------------------|--------------------------------------------------------|
| `cf-write-token` | Cloudflare API token, Pages:Edit scope                 |
| `cf-account-id`  | Cloudflare account id (sidebar of dash.cloudflare.com) |

The pipeline injects both kebab-case secrets into the env vars wrangler natively reads (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) at each deploy step.

After that: just push. PushCI runs the pipeline in `.pushci.yml` — build → audit (dashes, banned copy, side-stripe bans) → deploy. AI overrides at the bottom of the file enable auto-rollback on 5xx spikes and bundle-size alerts.

### 2. Manual wrangler push

```bash
wrangler login                  # one-time, opens browser
bash site/scripts/deploy.sh     # build + push to prod
bash site/scripts/deploy.sh --preview   # ephemeral preview branch
```

Or from the repo root:

```bash
npm run site:deploy
```

### 3. Pages dashboard (GUI)

Connect the repo at `dash.cloudflare.com → Pages → Create → Connect to Git`. Build command `cd site && npm run build`, output `site/dist`. Map `agents.lunaos.ai` under Custom Domains; cert auto-issues.

The deployment contract is `wrangler.toml` and `public/_headers` in this directory. All three paths above respect them.

## Fonts

`src/styles/fonts.css` references self-hosted `.woff2` files in `public/fonts/`. The files are not committed (they belong to Google and are licensed for self-hosting under the OFL). To fetch them:

```bash
# Instrument Serif — https://fonts.google.com/specimen/Instrument+Serif
# Inter Tight       — https://fonts.google.com/specimen/Inter+Tight
# JetBrains Mono    — https://fonts.google.com/specimen/JetBrains+Mono
```

Download `.woff2` weights and drop them into `public/fonts/`. The fallback chain (in `tokens.css`) keeps the site readable in their absence.

## Accessibility

WCAG 2.2 AA. Contrast verified. Full keyboard nav. `prefers-reduced-motion` resolves all timed animations to their final state. The pipe-prompt has a skip-link and announces output via `aria-live="polite"`.

## What's *not* on the site by design

- No hero metrics, no testimonial carousel, no pricing table on the home.
- No card grids on the lexicon — it is a real dictionary.
- No light/dark toggle. Light prose, dark terminals, on purpose.
- No analytics scripts on the critical path.

See `../PRODUCT.md` "Anti-references" for the full no-fly list.
