# TenantIQ — Autonomous Browser Testing

Prompts for feeding into Atlas / browser-use / Claude Chrome MCP /
any agentic browser to walk prod and surface real bugs without
manual clicking.

## Two levels

| Prompt | Duration | When to use |
|--------|----------|-------------|
| [`atlas-smoke-prompt.md`](./atlas-smoke-prompt.md) | ~5 min · 8 tests | After every deploy; CI-style sanity check |
| [`atlas-full-prompt.md`](./atlas-full-prompt.md) | ~30 min · ~40 tests | Release gates, weekly regression sweep, post-migration audits |

Both are read-only against prod. No POST/PUT/DELETE on customer
tenants. Safe to run unattended.

## How to run

### Atlas (Cursor) / Claude Chrome MCP
1. Copy the file contents into the agent's initial prompt.
2. Provide the credentials as secrets, never paste them into the
   prompt body itself.
3. Let the agent drive until it returns the final report table.

### Playwright (if you'd rather automate)
The authored E2E suite is in `tests/e2e/audit-prod.spec.ts` and
covers most of the smoke checks. Run:

```bash
npx playwright test --config=playwright-prod.config.ts
```

### Target URLs
- Landing: https://tenantiq.app
- App: https://app.tenantiq.app
- API: https://api.tenantiq.app

## Interpreting the report

The agent returns a markdown table + a "Top N bugs" list. Each
row has status `PASS` / `FAIL` / `TIMEOUT` / `SKIPPED`.

- `FAIL` with evidence → file a GitHub issue, attach the screenshot
- `TIMEOUT` → typically a slow Graph API call; re-run to confirm
- `SKIPPED (auth blocker)` → someone revoked the test credentials
  or hit an admin-consent wall; unrelated to the code

## Adding new test paths

When you ship a new page or route, append a test step to the
relevant section (A–H in the full prompt). Keep the smoke version
lean — only add to smoke if the test takes < 15s and gates a
revenue path.
