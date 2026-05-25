---
name: ll-e2e-flow
displayName: Luna E2E Flow Generator
description: Auto-generate Playwright E2E tests from your routes and components — login, CRUD, billing, all flows
version: 1.0.0
category: testing
agent: luna-full-test
parameters:
  - name: scope
    type: string
    description: Scope (all, auth, dashboard, billing, settings, or specific route)
    required: false
    prompt: true
workflow:
  - scan_routes_and_pages
  - detect_auth_requirements
  - generate_page_objects
  - generate_e2e_tests
  - generate_test_fixtures
  - run_tests
  - generate_e2e_report
output:
  - e2e/
  - .luna/{current-project}/e2e-report.md
prerequisites: []
---

# Luna E2E Flow Generator

Auto-generate complete Playwright E2E tests from your codebase.

## What This Command Does

1. **Scan** — reads all routes, pages, components, API endpoints
2. **Detect Auth** — determines which routes need login vs public
3. **Page Objects** — generates Page Object Model classes for each page
4. **E2E Tests** — creates full flow tests for every user journey
5. **Fixtures** — generates test data, auth state, mock APIs
6. **Run** — executes all tests, captures screenshots on failure
7. **Report** — coverage report showing which routes are tested

## Generated Test Structure

```
e2e/
  fixtures/
    auth.fixture.ts           # Login state, test users
    data.fixture.ts           # Seed data for tests
  pages/
    landing.page.ts           # Page Object: landing page
    login.page.ts             # Page Object: login page
    dashboard.page.ts         # Page Object: dashboard
    settings.page.ts          # Page Object: settings
    billing.page.ts           # Page Object: billing
  flows/
    auth.e2e.test.ts          # Sign up, sign in, sign out, password reset
    dashboard.e2e.test.ts     # Dashboard loads, widgets work, navigation
    crud.e2e.test.ts          # Create, read, update, delete entities
    billing.e2e.test.ts       # View plan, upgrade, manage payment
    settings.e2e.test.ts      # Profile, password, notifications
    team.e2e.test.ts          # Invite, accept, roles, remove
    search.e2e.test.ts        # Search, filter, sort, paginate
    responsive.e2e.test.ts    # All pages at mobile/tablet/desktop
    error.e2e.test.ts         # 404, 500, network errors, empty states
    a11y.e2e.test.ts          # Keyboard nav, screen reader, focus
  playwright.config.ts        # Multi-browser config
```

## Generated Test Example

```typescript
// e2e/flows/auth.e2e.test.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Authentication', () => {
  test('should sign in with email and password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillEmail('test@example.com');
    await loginPage.fillPassword('TestPassword123!');
    await loginPage.clickSignIn();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading')).toContainText('Dashboard');
  });

  test('should sign in with Google OAuth', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clickGoogleSignIn();
    // OAuth mock intercepts and returns test user
    await expect(page).toHaveURL('/dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillEmail('wrong@example.com');
    await loginPage.fillPassword('wrong');
    await loginPage.clickSignIn();
    await expect(loginPage.errorMessage).toBeVisible();
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/auth/signin');
  });
});
```

## Usage

```
/e2e-flow                              # Generate for all routes
/e2e-flow auth                         # Auth flows only
/e2e-flow dashboard                    # Dashboard flows only
/e2e-flow billing                      # Billing flows only
/e2e-flow /api/workflows               # Specific route
```

## In Pipes

```
# Generate E2E then run browser test
/pipe e2e-flow >> browser-test http://localhost:3000

# Full test pipeline
/pipe go *5 >> e2e-flow >> browser-test ?>> pr !>> (fix >> browser-test) *3?

# Generate, test, visual regression, ship
/pipe e2e-flow >> browser-test >> visual-regression >> ship
```
