# @amliq/brain-web

Minimal analyst search UI for AMLIQ Brain. Astro 4 + Tailwind. Standalone
TypeScript package — **not** part of the pnpm workspace (round-4 rule).

## Status

v0 scaffold (Brain Month 2, Week 5). Renders search input + result cards
with inline citation pills. Backed by a local fixture when
`BRAIN_API_URL` is unset; calls the real `POST /v1/search` endpoint
otherwise.

## Run

```bash
cd products/amliq/brain/web
pnpm install --ignore-workspace
pnpm dev
```

Open <http://localhost:4321>.

## Environment variables

| Variable           | Purpose                                                            | Required |
|--------------------|--------------------------------------------------------------------|----------|
| `BRAIN_API_URL`    | Base URL of the Brain API (e.g. `https://brain.amliq.dev`)         | No (fixture mode if unset) |
| `BRAIN_JWT`        | Bearer token for the Brain API. Local-dev only.                    | If `BRAIN_API_URL` is set |
| `BRAIN_TENANT_ID`  | Tenant scope passed in the search request. Defaults to `demo-tenant`. | No        |

No real API base URL is committed. Configure via `.env.local` or your
deploy host's secret store.

## Apple HIG conformance

This scaffold follows the portfolio Apple HIG rules
(`/Users/shaharsolomon/dev/projects/CLAUDE.md`):

- **Type**: system font stack first (`-apple-system, BlinkMacSystemFont,
  SF Pro Text, …`).
- **Color**: ink palette (`ink.50` → `ink.900`) with one accent (system
  blue `#0a84ff`) reserved for citation pills. `prefers-color-scheme`
  respected via Tailwind `dark:` classes.
- **Spacing**: 8pt grid via Tailwind defaults; `gutter` semantic token.
- **Motion**: none in v0. Hover / focus transitions only. Future motion
  must respect `prefers-reduced-motion`.
- **Focus**: visible focus rings, skip-link in every page layout.
- **Accessibility**: WCAG 2.1 AA targeted. Landmarks (`<main>`, `<nav>`,
  `<header>`), `role="search"` on the search form, `aria-live` for the
  result count, no `set:html`. Citation pills carry descriptive
  `aria-label`s.

## Architecture notes

- Static output (`output: 'static'`). The search page reads `q` from the
  URL during build and renders results from the fixture; a real deploy
  swaps in an SSR adapter and calls the live API at request time.
- No `@finsavvyai/*` or sibling-product imports (round-2 rule). The
  `SearchResult` shape is mirrored locally in `src/lib/types.ts`.
- File-size cap: 200 lines per source file (portfolio rule). All current
  files are well under the cap.

## Tests

```bash
pnpm test
```

Unit tests cover the `src/lib/` utilities (`highlight.ts`,
`search-client.ts`). Astro components themselves are exempt from Vitest
coverage per the portfolio `.astro` exception (visual / a11y regression
will be wired in a later round).

## Future work

- SSR adapter (Cloudflare Pages Functions) for live API calls.
- Playwright visual-regression baseline.
- axe-core / pa11y a11y audit wired into CI.
- Recent-searches local storage (currently a placeholder on the home
  page).
- `source_uri` per citation (today citations link to `#doc_id` anchors;
  the API will surface canonical source URIs in a later iteration).
