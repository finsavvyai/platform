# Questro E2E Testing Suite

Comprehensive end-to-end testing suite for the Questro platform using Playwright.

## 📋 Overview

This test suite covers critical user flows and ensures the application works correctly from a user's perspective.

**Current Coverage:**
- ✅ Authentication flows (login, logout, OAuth)
- ✅ Dashboard navigation and functionality
- 🚧 Test creation workflows
- 🚧 Project management
- 🚧 Team collaboration
- 🚧 API integration features

## 🚀 Quick Start

### Prerequisites

1. Node.js 18+ installed
2. Application running locally or accessible via URL
3. Playwright browsers installed

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Running Tests

```bash
# Run all E2E tests
npm run test:playwright

# Run tests in headed mode (see browser)
npm run test:playwright:headed

# Run tests in UI mode (interactive)
npm run test:playwright:ui

# Run tests in debug mode
npm run test:playwright:debug

# Run specific test file
npx playwright test tests/e2e/auth/01-login.spec.ts

# Run tests for specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### View Test Reports

```bash
# Open HTML report
npm run test:playwright:report

# Or manually
npx playwright show-report
```

## 📁 Structure

```
tests/e2e/
├── auth/                      # Authentication tests
│   └── 01-login.spec.ts
├── dashboard/                 # Dashboard tests
│   └── 02-dashboard-navigation.spec.ts
├── projects/                  # Project management tests
│   └── [coming soon]
├── fixtures/                  # Test data
│   └── test-users.ts
├── page-objects/              # Page Object Models
│   ├── LoginPage.ts
│   └── DashboardPage.ts
├── utils/                     # Helper functions
│   └── test-helpers.ts
├── global-setup.ts            # Global test setup
├── global-teardown.ts         # Global test cleanup
└── README.md                  # This file
```

## 🧪 Writing Tests

### 1. Create Page Object Model

```typescript
// tests/e2e/page-objects/MyPage.ts
import { Page, Locator } from '@playwright/test';

export class MyPage {
  readonly page: Page;
  readonly myButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.myButton = page.locator('button#my-button');
  }

  async goto() {
    await this.page.goto('/my-page');
  }

  async clickButton() {
    await this.myButton.click();
  }
}
```

### 2. Write Test

```typescript
// tests/e2e/myfeature/my-feature.spec.ts
import { test, expect } from '@playwright/test';
import { MyPage } from '../page-objects/MyPage';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    const myPage = new MyPage(page);
    await myPage.goto();
    await myPage.clickButton();

    // Assertions
    await expect(page).toHaveURL(/\/success/);
  });
});
```

## 🎯 Best Practices

### 1. Use Page Object Model

Encapsulate page interactions in Page Object classes:

```typescript
// ✅ Good
await loginPage.login(user);

// ❌ Bad
await page.fill('#email', user.email);
await page.fill('#password', user.password);
await page.click('#login-button');
```

### 2. Wait for Elements Properly

```typescript
// ✅ Good
await expect(element).toBeVisible();
await element.click();

// ❌ Bad
await page.waitForTimeout(1000);
await element.click();
```

### 3. Use Test Fixtures

```typescript
// ✅ Good
await loginPage.login(testUsers.standardUser);

// ❌ Bad
await loginPage.login({ email: 'test@test.com', password: 'password' });
```

### 4. Clean Up After Tests

```typescript
test.afterEach(async ({ page }) => {
  // Logout, clear data, etc.
  await clearStorage(page);
});
```

### 5. Handle Async Operations

```typescript
// ✅ Good
await Promise.all([
  page.waitForNavigation(),
  page.click('button'),
]);

// ❌ Bad
await page.click('button');
await page.waitForNavigation();
```

## 📊 Test Coverage Goals

| Feature | Target Coverage | Current Status |
|---------|----------------|----------------|
| Authentication | 90% | ✅ 85% |
| Dashboard | 80% | ✅ 75% |
| Projects | 80% | 🚧 20% |
| Test Creation | 90% | 🚧 10% |
| API Management | 70% | ❌ 0% |
| Analytics | 70% | ❌ 0% |
| Settings | 80% | ❌ 0% |

## 🐛 Debugging Tests

### Debug Mode

```bash
# Run with inspector
npx playwright test --debug

# Run specific test in debug mode
npx playwright test tests/e2e/auth/01-login.spec.ts --debug
```

### Screenshots and Videos

Tests automatically capture:
- Screenshots on failure
- Videos on failure
- Traces on retry

Find them in `test-results/` directory.

### Console Logs

Enable verbose logging:

```bash
DEBUG=pw:api npx playwright test
```

## 🔧 Configuration

Main configuration file: `playwright.config.ts`

### Environment Variables

```bash
# Base URL for tests
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000

# Skip browser downloads
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

### Browser Configuration

Edit `playwright.config.ts` to modify:
- Browsers to test (chromium, firefox, webkit)
- Viewport sizes
- Timeout values
- Retry strategies

## 📝 Test Naming Convention

```
[number]-[feature]-[action].spec.ts
```

Examples:
- `01-login.spec.ts`
- `02-dashboard-navigation.spec.ts`
- `03-project-creation.spec.ts`

## 🚨 Common Issues

### Issue: Tests timeout

**Solution:** Increase timeout in `playwright.config.ts` or use `{ timeout: 60000 }` in specific tests.

### Issue: Elements not found

**Solution:** Use proper waiting strategies:
```typescript
await expect(element).toBeVisible();
```

### Issue: Flaky tests

**Solution:**
- Avoid `page.waitForTimeout()`
- Use proper element waiting
- Check for network idle states

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)

## ✅ Checklist for New Tests

- [ ] Create Page Object Model
- [ ] Write descriptive test names
- [ ] Use test fixtures for data
- [ ] Add proper assertions
- [ ] Handle async operations correctly
- [ ] Clean up after tests
- [ ] Test passes in all browsers
- [ ] Add to test coverage tracking

## 🎉 Contributing

When adding new tests:

1. Follow the existing structure
2. Use Page Object Model pattern
3. Add test data to fixtures
4. Write clear, descriptive test names
5. Update this README with new coverage
6. Run all tests before submitting

---

**Test Status:** 🟡 In Progress (Authentication & Dashboard: 80%, Other Features: <20%)
**Next Steps:** Complete project management and test creation workflows
**Goal:** Achieve 80%+ coverage across all critical user flows
