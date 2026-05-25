# Testing Infrastructure

This directory contains the complete testing infrastructure for LunaOS Studio, including unit tests, integration tests, E2E tests, visual regression tests, and performance tests.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── workflow-engine.test.js
│   └── node-system.test.js
├── integration/             # Integration tests (to be added)
├── e2e/                     # End-to-end tests with Playwright
│   ├── fixtures/
│   │   └── test-fixtures.js
│   ├── page-objects/
│   │   ├── WorkflowPage.js
│   │   └── CanvasPage.js
│   ├── workflow-creation.spec.js
│   ├── node-operations.spec.js
│   ├── workflow-execution.spec.js
│   ├── workflow-persistence.spec.js
│   └── visual-regression.spec.js
├── performance/             # Performance testing documentation
│   └── README.md
└── setup.js                 # Jest global setup
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug

# Run E2E tests with UI
npm run test:e2e:ui
```

### Visual Regression Tests

```bash
# Run visual regression tests
npm run test:visual

# Update visual snapshots
npm run test:visual:update
```

### Performance Tests

```bash
# Run Lighthouse CI performance tests
npm run test:performance
```

## Test Configuration

### Jest Configuration

Jest is configured in `jest.config.js` with:
- **Test Environment**: jsdom (browser-like environment)
- **Transform**: Babel for ES modules
- **Coverage Threshold**: 80% for all metrics
- **Test Match**: `tests/unit/**/*.test.js` and `tests/integration/**/*.test.js`

### Playwright Configuration

Playwright is configured in `playwright.config.js` with:
- **Test Directory**: `tests/e2e`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Base URL**: http://localhost:5173 (dev server)
- **Retries**: 2 in CI, 0 locally
- **Screenshots**: On failure only
- **Video**: Retained on failure

### Lighthouse CI Configuration

Lighthouse CI is configured in `lighthouserc.js` with performance budgets:
- First Contentful Paint: < 2s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Total Blocking Time: < 300ms
- Speed Index: < 3s

## Writing Tests

### Unit Tests

Unit tests should focus on testing individual functions and modules in isolation:

```javascript
import { jest } from '@jest/globals';

describe('MyModule', () => {
  let myModule;

  beforeEach(async () => {
    const Module = await import('../../js/my-module.js');
    myModule = new Module.default();
  });

  it('should do something', () => {
    const result = myModule.doSomething();
    expect(result).toBe(expected);
  });
});
```

### E2E Tests

E2E tests should use page objects for better maintainability:

```javascript
import { test, expect } from './fixtures/test-fixtures.js';

test.describe('Feature Name', () => {
  test('should perform action', async ({ workflowPage, canvasPage }) => {
    await workflowPage.goto();
    await workflowPage.createNewWorkflow('Test');
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    // ... more actions
  });
});
```

### Visual Regression Tests

Visual tests compare screenshots:

```javascript
test('should match component screenshot', async ({ page }) => {
  await expect(page).toHaveScreenshot('component.png', {
    maxDiffPixels: 100
  });
});
```

## Coverage Requirements

The project maintains the following coverage requirements:

- **Workflow Engine**: 90%
- **Node System**: 90%
- **Utility Functions**: 95%
- **Error Handlers**: 85%
- **Overall**: 80%

## CI/CD Integration

Tests run automatically in GitHub Actions:

1. **On Push**: All tests run on push to `main` or `develop`
2. **On PR**: All tests run on pull requests to `main`
3. **Performance**: Lighthouse CI runs and comments results on PRs

## Troubleshooting

### Tests Failing Locally

1. Ensure all dependencies are installed: `npm install`
2. Clear Jest cache: `npx jest --clearCache`
3. Check Node version: `node --version` (should be 18+)

### E2E Tests Failing

1. Install Playwright browsers: `npx playwright install`
2. Ensure dev server is running: `npm run dev`
3. Check browser console for errors

### Visual Tests Failing

1. Update snapshots if intentional: `npm run test:visual:update`
2. Check for environment differences (fonts, rendering)
3. Review diff images in test results

### Performance Tests Failing

1. Build the application: `npm run build`
2. Check for large dependencies
3. Review Lighthouse report for specific issues

## Best Practices

1. **Write tests first**: Follow TDD when possible
2. **Keep tests focused**: One assertion per test when possible
3. **Use descriptive names**: Test names should describe behavior
4. **Mock external dependencies**: Don't rely on external services
5. **Clean up after tests**: Reset state in `afterEach` hooks
6. **Avoid test interdependence**: Tests should run independently
7. **Use page objects**: For E2E tests, use page object pattern
8. **Test user behavior**: E2E tests should simulate real user actions

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Testing Best Practices](https://testingjavascript.com/)
