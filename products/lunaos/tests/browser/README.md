# tests/browser — Cross-surface Playwright suite

Single Playwright project covering all LunaOS web surfaces + API + AI browser agent.

## Projects

| Project | Target | Spec file |
|---|---|---|
| `studio` | Studio editor | `specs/studio.spec.ts` |
| `dashboard` | Dashboard | `specs/dashboard.spec.ts` |
| `marketing` | Marketing site | `specs/marketing.spec.ts` |
| `visual` | Visual regression | `specs/visual.spec.ts` |
| `extension` | Extension API integration | `specs/extension.spec.ts` |
| `ai-agent` | AI browser agent wrapper | `specs/ai-agent.spec.ts` |

## Quick start

```bash
cd tests/browser
npm install
npx playwright install --with-deps chromium
npm run list        # list all tests
npm test            # run everything
npm run test:marketing
npm run test:update-snapshots    # approve new visual baselines
```

## Environment

| Var | Default | Purpose |
|---|---|---|
| `STUDIO_URL` | `http://localhost:5173` | Studio dev server |
| `DASHBOARD_URL` | `http://localhost:3000` | Dashboard dev server |
| `MARKETING_URL` | `http://localhost:4000` | Marketing static server |
| `API_URL` | `http://localhost:8787` | Engine Workers dev |
| `LUNAOS_TEST_API_KEY` | `luna_key_test_placeholder` | Extension test key |
| `MOCK_ONLY` | `true` | Mock APIs via `page.route` |
| `CI` | — | Enables retries + `forbidOnly` |

## Auto-fix loop

```bash
npm run test:heal             # run suite, emit heal-proposals.json
npm run test:heal -- --project=marketing   # narrow scope
```

Emits `test-results/heal-proposals.json` with failure signatures + remediation hints.

## Design notes

- **Hermetic by default**: `fixtures.ts` installs API mocks via `page.route` for Studio + Dashboard specs.
- **Marketing** hits real dev server; no mocks needed (static HTML).
- **Visual regression** uses Playwright's `toHaveScreenshot` with `0.02` diff threshold. Masks dynamic counters.
- **Extension spec** skips gracefully on 404 so you can run before the engine is deployed.
- **AI browser agent** has a pluggable `llmCall` — pass a real LLM for true agentic behavior, or use the stub for unit tests.

## File sizes

| File | Lines |
|---|---|
| `playwright.config.ts` | ~60 |
| `helpers/mock-apis.ts` | ~75 |
| `helpers/fixtures.ts` | ~25 |
| `helpers/ai-browser-agent.ts` | ~95 |
| `specs/*.spec.ts` | 50-80 each |
| `scripts/browser-heal.mjs` | ~95 |

All under the 200-line cap.
