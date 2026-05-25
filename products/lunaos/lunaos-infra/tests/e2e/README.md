# LunaOS Platform E2E Test Suite

Comprehensive Playwright E2E test suite covering the full LunaOS platform across all products and user personas.

## Products Under Test

| Product | URL | Stack |
|---------|-----|-------|
| Marketing | lunaos.ai | HTML/CSS/JS |
| Dashboard | agents.lunaos.ai | Next.js 14 |
| Studio IDE | studio.lunaos.ai | Vite + ReactFlow |
| Docs | docs.lunaos.ai | VitePress |
| API | api.lunaos.ai | Hono Workers |

## Test Personas

- **New Customer** - Landing page, signup, onboarding, first agent
- **Investor/Evaluator** - Marketing, investors page, docs, demo, pricing
- **Paying User** - Login, dashboard, API keys, agents, billing, settings

## Prerequisites

- Node.js 20+
- npm 10+

## Quick Start

```bash
# Navigate to test directory
cd lunaos-infra/tests/e2e

# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers

# Copy environment config
cp .env.example .env
# Edit .env with your test URLs and credentials

# Run all tests
npm test
```

## Running Tests

### All Tests

```bash
npm test
```

### By Persona

```bash
# New customer journey
npm run test:new-customer

# Investor/evaluator journey
npm run test:investor

# Paying user journey
npm run test:paying-user

# Cross-product navigation
npm run test:cross-product

# API health checks
npm run test:api
```

### By Browser

```bash
# Chromium only (fastest)
npm run test:chromium

# Mobile Safari
npm run test:mobile

# Specific project from config
npx playwright test --project=firefox
npx playwright test --project=dashboard
npx playwright test --project=studio
npx playwright test --project=docs
```

### Interactive Modes

```bash
# Headed mode (see the browser)
npm run test:headed

# Debug mode (step through tests)
npm run test:debug

# UI mode (interactive test runner)
npm run test:ui
```

### Specific Tests

```bash
# Single file
npx playwright test tests/api-health.spec.ts

# By test name pattern
npx playwright test -g "should load the marketing homepage"

# With grep and project
npx playwright test --project=chromium -g "SEO"
```

## Test Reports

```bash
# Open HTML report after test run
npm run report

# Reports are saved to:
# - playwright-report/     (HTML report)
# - test-results/results.json (JSON)
# - test-results/junit.xml    (JUnit for CI)
```

## Project Structure

```
tests/e2e/
  playwright.config.ts    # Multi-product Playwright config
  package.json            # Dependencies and scripts
  tsconfig.json           # TypeScript configuration
  .env.example            # Environment template
  .gitignore              # Ignore reports and screenshots
  fixtures/
    test-users.ts         # Test user factory functions
    urls.ts               # URL constants for all products
  helpers/
    auth.ts               # Login/signup/token helpers
    accessibility.ts      # WCAG 2.1 AA checks
    hig-checks.ts         # Apple HIG design validation
    visual.ts             # Visual regression helpers
  pages/
    marketing.page.ts     # Marketing site Page Object
    dashboard.page.ts     # Dashboard Page Object
    studio.page.ts        # Studio IDE Page Object
    docs.page.ts          # Docs site Page Object
  tests/
    new-customer.spec.ts  # New customer journey tests
    investor.spec.ts      # Investor/evaluator journey tests
    paying-user.spec.ts   # Paying user journey tests
    cross-product.spec.ts # Cross-product navigation tests
    api-health.spec.ts    # API endpoint health checks
```

## CI/CD Integration

### GitHub Actions

Add to your workflow file:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, release/*]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'  # Daily at 6am UTC

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        working-directory: lunaos-infra/tests/e2e
        run: npm ci

      - name: Install Playwright
        working-directory: lunaos-infra/tests/e2e
        run: npx playwright install --with-deps

      - name: Run E2E tests
        working-directory: lunaos-infra/tests/e2e
        env:
          CI: true
          MARKETING_URL: https://lunaos.ai
          DASHBOARD_URL: https://agents.lunaos.ai
          STUDIO_URL: https://studio.lunaos.ai
          DOCS_URL: https://docs.lunaos.ai
          API_URL: https://api.lunaos.ai
        run: npm test

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: lunaos-infra/tests/e2e/playwright-report/
          retention-days: 14

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: lunaos-infra/tests/e2e/test-results/
          retention-days: 14
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MARKETING_URL` | `https://lunaos.ai` | Marketing site URL |
| `DASHBOARD_URL` | `https://agents.lunaos.ai` | Dashboard URL |
| `STUDIO_URL` | `https://studio.lunaos.ai` | Studio IDE URL |
| `DOCS_URL` | `https://docs.lunaos.ai` | Docs site URL |
| `API_URL` | `https://api.lunaos.ai` | API base URL |
| `TEST_USER_EMAIL` | `test@lunaos.ai` | Test user email |
| `TEST_USER_PASSWORD` | - | Test user password |
| `TEST_API_KEY` | - | Test API key |
| `CI` | `false` | CI mode (enables retries) |

## Adding New Tests

1. **New test file**: Create in `tests/` with `.spec.ts` extension
2. **New page object**: Create in `pages/` with `.page.ts` extension
3. **New helper**: Create in `helpers/` with `.ts` extension
4. **New fixture**: Add factory functions to `fixtures/`

### Template for a new test:

```typescript
import { test, expect } from '@playwright/test';
import { URLS } from '../fixtures/urls';
import { checkA11y } from '../helpers/accessibility';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto(URLS.marketing.base);
    await expect(page).toHaveTitle(/LunaOS/);
    await checkA11y(page);
  });
});
```

### Rules

- Max 200 lines per file
- Use Page Object Model for page interactions
- Include accessibility checks in each journey
- Include HIG design checks where applicable
- Use factory functions for test data
- Clear test descriptions

## Troubleshooting

### Tests timing out

Increase timeout in `playwright.config.ts` or per-test:

```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(120_000);
  // ...
});
```

### Browser installation issues

```bash
# Full install with system deps
npx playwright install --with-deps

# Single browser
npx playwright install chromium
```

### HTTPS certificate errors

For local development with self-signed certs:

```typescript
// In playwright.config.ts use section
use: {
  ignoreHTTPSErrors: true,
}
```

### Flaky tests

- Check network stability
- Increase `actionTimeout` and `navigationTimeout`
- Use `waitForLoadState('networkidle')` before assertions
- Add retries: `retries: 2` in config

### Screenshots not matching

```bash
# Update baseline screenshots
npx playwright test --update-snapshots
```

### Cannot reach test URLs

- Verify URLs in `.env` are correct
- Check VPN/proxy settings
- Ensure products are deployed and running

## Test Coverage Matrix

| Area | New Customer | Investor | Paying User | Cross-Product | API |
|------|:---:|:---:|:---:|:---:|:---:|
| Homepage load | x | x | | x | |
| SEO metadata | x | x | | | |
| Accessibility | x | x | x | x | |
| HIG design | x | x | x | | |
| Navigation | x | x | x | x | |
| Signup flow | x | | | | |
| Login flow | | | x | | |
| Dashboard | | | x | x | |
| API keys | | | x | | |
| Billing | | | x | | |
| Studio IDE | | | x | | |
| Docs site | | x | | x | |
| Demo page | | x | | | |
| Investors | | x | | | |
| Health check | | | | | x |
| SSL/HTTPS | | x | | | x |
| Rate limiting | | | | | x |
| Error handling | | | | | x |
| Responsiveness | | | | x | |
| Branding | | | | x | |
