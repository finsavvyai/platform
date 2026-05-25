# Testing Guide — LunaOS Studio

## Test Stack

| Layer | Tool | Config |
|-------|------|--------|
| Unit | Jest + jsdom | `jest.config.js` |
| Studio unit | Jest (TypeScript) | `jest.studio.config.ts` |
| E2E | Playwright | `playwright.config.js` |
| Visual regression | Playwright snapshots | `tests/e2e/visual-regression.spec.js` |
| Performance | Lighthouse CI | `lighthouserc.js` |

## Running Tests

```bash
# All unit tests
npm test

# With coverage report (opens in browser)
npm run test:coverage

# Studio TypeScript unit tests only
npm run test:studio

# E2E (headless)
npm run test:e2e

# E2E (headed — see the browser)
npm run test:e2e:headed

# Visual regression
npm run test:visual

# Update visual regression baselines
npm run test:visual:update

# Lighthouse CI
npm run lighthouse
```

## Coverage Requirements

Thresholds enforced in CI:

| Metric | Minimum |
|--------|---------|
| Branches | 80% |
| Lines | 80% |
| Functions | 80% |
| Statements | 80% |

Critical paths (auth, API calls, error handling) must be **100% covered**.

## Writing Unit Tests

Tests live next to their source file: `foo.ts` → `src/__tests__/foo.test.ts`.

```typescript
// Example unit test
import { serialize } from '../lib/pipeline-serializer';

describe('serialize', () => {
  it('converts nodes and edges to PipelineJSON', () => {
    const result = serialize({ nodes: [], edges: [], name: 'test' });
    expect(result.name).toBe('test');
    expect(result.nodes).toEqual([]);
  });
});
```

Rules:
- Mock all external dependencies (`fetch`, `localStorage`, APIs).
- Never call real endpoints in unit tests.
- Use `jest.fn()` for callbacks; verify call arguments.
- One `describe` block per module; one `it` per behaviour.

## Writing E2E Tests

E2E tests live in `tests/e2e/`. Use page object models.

```javascript
// Example E2E test (Playwright)
import { test, expect } from '@playwright/test';

test('user can create and execute a workflow', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="add-agent-node"]');
  await page.click('[data-testid="run-workflow"]');
  await expect(page.locator('[data-testid="execution-status"]'))
    .toHaveText('completed');
});
```

## Visual Regression

Baselines are stored in `tests/e2e/__snapshots__/`.
Update baselines when intentional UI changes are made:
```bash
npm run test:visual:update
```

## CI Integration

Every PR runs:
1. `npm run lint`
2. `npm run typecheck`
3. `npm test` (with coverage gate)
4. `npm run test:e2e`
5. `npm run lighthouse`

Red CI blocks merge.
