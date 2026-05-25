# @amliq/investigate-web

Analyst case-review UI for AMLIQ Investigate. Astro 4 + Tailwind.
Standalone TypeScript package — **not** part of the pnpm workspace
(round-4 rule).

## Status

v0 scaffold (Brain Month 3, Week 11). Renders Investigate case list +
case detail + audit trail viewer. Backed by a 3-decision fixture when
`BRAIN_API_URL` is unset; calls the live `/v1/aml/decision/history`,
`/v1/aml/decision/:id`, and `/v1/aml/audit` endpoints otherwise.

## Run

```bash
cd products/amliq/api/decision/web
pnpm install --ignore-workspace
pnpm dev
```

Open <http://localhost:4321/investigate>.

Routes (mounted under `/investigate/` per Brain Month 3 mesh §9):

| Route                              | Page                                     |
|------------------------------------|------------------------------------------|
| `/investigate/`                    | Case list — recent decisions, table view |
| `/investigate/case/:decision_id`   | Case detail — engine scores + reasons    |
| `/investigate/audit`               | Audit trail — chain integrity + records  |

## Environment variables

| Variable           | Purpose                                                            | Required |
|--------------------|--------------------------------------------------------------------|----------|
| `BRAIN_API_URL`    | Base URL of the decision API (e.g. `https://api.amliq.dev`)        | No (fixture mode if unset) |
| `BRAIN_JWT`        | Bearer token for the decision API. Local-dev only.                 | If `BRAIN_API_URL` is set |
| `BRAIN_TENANT_ID`  | Tenant scope passed via `X-Tenant-Id` header. Defaults to `demo-tenant`. | No |

No real API base URL is committed. Configure via `.env.local` or your
deploy host's secret store.

## Deploy notes

- **Today:** `output: 'static'`. Build emits a Cloudflare-Pages-ready dist
  pre-rendered against the fixture. Suitable for the Week-11 internal
  demo per `decisive_plan_90day.md` Month 3 W9 row.
- **Live cutover:** swap `astro.config.mjs` to `output: 'server'` with
  the Cloudflare adapter (mirrors the planned brain/web swap). Remove
  `getStaticPaths()` from `src/pages/investigate/case/[id].astro` so the
  page renders on demand. Promote `BRAIN_API_URL` + `BRAIN_JWT` to the
  CF Pages secret store; never commit them.

## Apple HIG conformance

This scaffold follows portfolio + AMLIQ CLAUDE rules:

- **Type:** system font stack first (`-apple-system, BlinkMacSystemFont,
  SF Pro Text, ...`). Mono stack (`SF Mono, Menlo, ...`) for decision
  ids, subject hashes, and reason codes.
- **Color:** ink palette + one accent (system blue `#0a84ff`) for focus.
  Risk signal palette (`risk.low` / `risk.medium` / `risk.high`) is
  calibrated for AA contrast on `ink.50`; `prefers-color-scheme`
  respected via Tailwind `dark:` classes.
- **Spacing:** 8pt grid via Tailwind defaults; `gutter` semantic token.
- **Motion:** none in v0. Hover / focus transitions only. Future motion
  must respect `prefers-reduced-motion`.
- **Focus:** visible focus rings; skip-link on every page layout.
- **Accessibility (WCAG 2.1 AA target):**
  - Landmarks: `<header>`, `<nav aria-label="Primary">`, `<main id="main">`.
  - Active nav item carries `aria-current="page"`.
  - Tables include a `<caption class="sr-only">` describing columns.
  - All interactive elements (links, badges) carry descriptive
    `aria-label`s when their visible text is abbreviated.
  - Chain status uses `role="status"` + `aria-live="polite"`.
  - No `set:html`. No raw HTML interpolation.

## PII discipline

All fixture data is **PII-free** by construction:

- Subjects identified only by `subject_hash` (sha256-prefixed). No
  plaintext names or transaction descriptions.
- Aggregated explanations are stable reason codes
  (`sanctions_match`, `model_confidence_low`, etc.) — never free-form
  text. Asserted in `investigate-client.test.ts`.
- The detail page surfaces `subject_hash`, not a subject id. This
  matches the AMLIQ parent CLAUDE.md hard rule that the
  decision-detail endpoint MUST NOT return plaintext PII to the
  analyst console.

## Architecture notes

- Static output (`output: 'static'`) with `base: '/investigate'` so every
  internal link, including those built from `BASE_URL`, is correctly
  prefixed when the UI is mounted under that path on the deployment
  host.
- No `@finsavvyai/*` or sibling-product imports (round-2 rule). The
  `AmlDecision` shape is mirrored locally in `src/lib/types.ts`. If the
  upstream contract changes, this mirror must be updated in the same
  release.
- File-size cap: 200 lines per source file (portfolio rule). All current
  files are well under the cap.

## Tests

```bash
pnpm test
```

Unit tests cover `src/lib/` only (Astro components excluded per the
portfolio `.astro` exception):

- `format.test.ts` — 100% of `format.ts` paths (money formatter edge
  cases incl. zero, negative, JPY zero-decimal; timestamp invalid input
  fallback; score-to-tier mapping incl. NaN and out-of-range; action
  label coverage).
- `investigate-client.test.ts` — fixture-mode fallback, real-endpoint
  GET semantics (URL, bearer, `X-Tenant-Id` header), non-2xx mapping
  (`http_<status>`), throw mapping (`network_error`), id encoding, PII
  discipline assertions.

Vitest coverage thresholds: 95 line / 90 branch / 95 function. The
`src/lib/format.ts` module is exercised to 100% via the test cases
above; the `src/lib/investigate-fixtures.ts` module is reached via the
fixture-mode tests.

## Future work

- SSR adapter (Cloudflare Pages Functions) for live API calls.
- Playwright visual-regression baseline at all 3 viewports (375 / 768 / 1024).
- axe-core / pa11y a11y audit wired into CI.
- Case-search + filter on the list page.
- Settings page (tenant policy overrides, cutoff tuning).
- Pagination on the audit page (today: first page only).
