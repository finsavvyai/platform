# finsavvyai.com

The FinsavvyAI ecosystem marketing site.

Stack: **Astro 4** + **Tailwind CSS** + **TypeScript** (strict). Static
output, deployed to **Cloudflare Pages** (per round-3 infra decision).

Astro chosen over Next.js for this scaffold because: marketing-first,
MDX-friendly, ships zero JS by default, lighter footprint, easier to
keep under the 200-line/file cap. Master plan calls out Next.js as the
default frontend stack for **app** surfaces; marketing is a different
job and Astro is the better fit per round-4 ethos.

## Local development

```sh
# From the repo root
pnpm install
pnpm --filter @finsavvyai/website-finsavvyai-com dev
# Or from this directory
pnpm dev
```

Opens at <http://localhost:4321>.

## Build

```sh
pnpm --filter @finsavvyai/website-finsavvyai-com build
```

Output lands in `dist/`.

## Deploy (Cloudflare Pages)

The build output (`dist/`) is a static site. Two paths:

1. **Direct upload** (interim):
   ```sh
   pnpm build
   npx wrangler pages deploy dist --project-name finsavvy-website
   ```
2. **GitHub integration** (target): connect this monorepo to
   Cloudflare Pages with build command
   `pnpm --filter @finsavvyai/website-finsavvyai-com build` and output
   directory `websites/finsavvyai.com/dist`. Set the project root to
   the monorepo root so pnpm workspace resolution works.

Production domain: `finsavvyai.com`. Staging: a CF Pages preview URL.

## Structure

```
websites/finsavvyai.com/
├── astro.config.mjs        # Astro + Tailwind config, SSG static output
├── tailwind.config.mjs     # Custom palette + sans stack (Apple HIG)
├── tsconfig.json           # Extends repo tsconfig.base.json (strict)
├── package.json            # @finsavvyai/website-finsavvyai-com
├── public/
│   └── robots.txt          # Allow-all (pre-launch); update before SEO push
├── src/
│   ├── layouts/Default.astro   # HTML shell, color scheme, skip link
│   ├── components/Hero.astro   # Headline + subhead component
│   └── pages/index.astro       # Home — the only page at scaffold stage
└── README.md
```

## Coverage exception

Astro `.astro` components do not lend themselves to Vitest-style unit
testing (the runtime is a build-time renderer; visual rendering is the
contract, not function output). Per `CLAUDE.md`, this package
substitutes:

- **Visual regression** (Playwright snapshots) for components
- **a11y audit** (axe / pa11y) for pages
- **Lighthouse CI** (perf + best-practices) on build

These are scaffolded in a future round; not present yet.

## Roadmap

Round-4 ARCHIVE-WEBSITE delivered only the **skeleton**:
- one page (`/`)
- the master-plan headline + subhead
- typography + color scaffolding (Apple-HIG sans, calm ink palette)
- accessibility defaults (skip link, semantic landmarks, color-scheme
  awareness)

Out of scope for round 4 (left for future rounds):
- product pages (PushCI, Qestro, LunaOS, OpenSyber, SDLC.cc, AMLIQ,
  TenantIQ)
- pricing
- blog (MDX)
- CMS integration
- analytics
- form handlers / contact
- legacy `landing-page/` import from fintech-suite (per addendum §1)
