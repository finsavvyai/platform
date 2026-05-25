# Qestro E2E Test Suite Documentation

## Overview

This directory contains comprehensive Playwright E2E tests for the Qestro platform. The test suite covers critical user flows including authentication, dashboard navigation, test management, execution, billing, and settings.

## Test Files

### 1. **auth.spec.ts** (213 lines)
Authentication and user flows

**Tests:**
- Display login form with all required fields
- Login with valid credentials and redirect to dashboard
- Display error message with invalid credentials
- Show password visibility toggle
- Handle remember me checkbox
- Navigate to signup page
- Navigate to forgot password page
- Display OAuth login buttons (GitHub, Azure AD)
- Validate required email and password fields
- Validate email format
- Show loading state while submitting

**Key Selectors:**
- Email input: `input[name="email"]`
- Password input: `input[name="password"]`
- Sign-in button: `button:has-text("Sign in")`
- Remember-me: `input[name="remember-me"]`

**Entry Points:**
- `${BASE_URL}/login` - Login page
- `${BASE_URL}/register` - Signup page
- `${BASE_URL}/forgot-password` - Password recovery

---

### 2. **dashboard.spec.ts** (217 lines)
Dashboard display and navigation

**Tests:**
- Load dashboard with stats cards
- Display test execution stats
- Display security score
- Display AI stats (self-healed tests)
- Display recent activity feed
- Navigate to projects
- Navigate to test cases
- Display coverage metric
- Display device status
- Refresh stats on button click
- Responsive layout on mobile
- Display breadcrumb navigation

**Key Selectors:**
- Dashboard header: `h1:has-text("Dashboard")`
- Stats cards: `[data-testid*="stat"]`
- Projects link: `a:has-text("Projects")`
- Tests link: `a:has-text("Tests")`
- Refresh button: `button[title*="Refresh"]`

**Entry Points:**
- `${BASE_URL}/dashboard` - Dashboard page

---

### 3. **test-creation.spec.ts** (341 lines)
Test case management and CRUD operations

**Tests:**
- Display test cases list with create button
- Create new test case via form
- Edit existing test case
- Duplicate test case
- Delete test case (with confirmation)
- Filter test cases by status
- Search for test cases
- Clear search results
- Display test properties correctly
- Sort test cases by name

**Key Selectors:**
- Create button: `button:has-text("Create")`
- Test items: `[data-testid*="test-item"]`
- Edit button: `button:has-text("Edit")`
- Duplicate button: `button:has-text("Duplicate")`
- Delete button: `button:has-text("Delete")`
- Filter: `[data-testid="status-filter"]`
- Search: `input[placeholder*="search"]`

**Entry Points:**
- `${BASE_URL}/tests` - Test cases list page

---

### 4. **test-execution.spec.ts** (295 lines)
Test running and results monitoring

**Tests:**
- Start test run from dashboard
- Display test run progress
- Display live test execution logs
- Display test results summary
- Display passed tests count
- Display failed tests count
- Display test execution time
- Display screenshot on test failure
- Show assertion failures with details
- Allow retry of failed test
- Display test environment details
- Export test results
- Display test result comparison for reruns
- Show test run timeline

**Key Selectors:**
- Run button: `button:has-text("Run")`
- Progress bar: `[data-testid="progress-bar"]`
- Test logs: `[data-testid="test-logs"]`
- Results: `[data-testid="results-summary"]`
- Screenshots: `img[alt*="screenshot"]`
- Export: `button:has-text("Export")`

**Entry Points:**
- `${BASE_URL}/dashboard` - Start test runs
- `${BASE_URL}/test-results` - View results

---

### 5. **billing.spec.ts** (284 lines)
Pricing and subscription management

**Tests:**
- Display pricing page with all plans
- Display Free plan details
- Display Starter plan details
- Display Pro plan details
- Have Get Started buttons on pricing cards
- Display feature comparison table
- Navigate to billing settings from authenticated state
- Display current subscription
- Display subscription renewal date
- Show upgrade option if on lower plan
- Display payment method
- Display billing history
- Display usage metrics in billing
- Show FAQ on pricing page

**Key Selectors:**
- Pricing cards: `[data-testid*="pricing"]`
- Plans: `:text("Free")`, `:text("Starter")`, `:text("Pro")`
- Get Started: `button:has-text("Get Started")`
- Comparison table: `table[role="table"]`
- Current plan: `[data-testid="current-plan"]`

**Entry Points:**
- `${BASE_URL}/pricing` - Pricing page
- `${BASE_URL}/settings/billing` - Billing settings

---

### 6. **settings.spec.ts** (361 lines)
User settings, integrations, and security

**Tests:**
- Display settings page with navigation
- Display integrations list
- Display GitHub integration
- Display Slack integration
- Generate API key
- Allow copying API key
- Display list of API keys
- Allow revoking API key
- Configure webhook notifications
- Configure notification preferences
- Display profile settings
- Allow team member invitations
- Display team members list
- Display security settings
- Display help/documentation links
- Display version information

**Key Selectors:**
- Integrations tab: `a:has-text("Integrations")`
- API Keys tab: `a:has-text("API Keys")`
- Generate button: `button:has-text("Generate")`
- Copy button: `button[title*="Copy"]`
- Webhooks tab: `a:has-text("Webhooks")`

**Entry Points:**
- `${BASE_URL}/settings` - Settings page
- `${BASE_URL}/settings/api-keys` - API keys section
- `${BASE_URL}/settings/integrations` - Integrations section

---

## Running Tests

### Run all E2E tests
```bash
npx playwright test tests/*.spec.ts
```

### Run specific test file
```bash
npx playwright test tests/auth.spec.ts
```

### Run specific test suite
```bash
npx playwright test tests/auth.spec.ts -g "should login"
```

### Run in debug mode
```bash
npx playwright test --debug tests/auth.spec.ts
```

### Run in headed mode (see browser)
```bash
npx playwright test --headed tests/auth.spec.ts
```

### Run on specific browser
```bash
npx playwright test --project=chromium tests/auth.spec.ts
```

### Generate report
```bash
npx playwright test tests/*.spec.ts
npx playwright show-report
```

## Configuration

### Environment Variables

Set these environment variables to customize test execution:

```bash
# Base URL for the application
export BASE_URL=http://localhost:3000

# Playwright environment
export PLAYWRIGHT_ENV=development  # or 'production'

# CI mode
export CI=1

# Custom port
export PLAYWRIGHT_PORT=3100
```

### playwright.config.ts

The configuration file already handles:
- Multiple browser projects (Chromium, Firefox, WebKit, Mobile)
- Screenshots on failure
- Video recording on failure
- HTML reporting
- JUnit XML output

## Best Practices

### 1. Use data-testid attributes
Prefer `data-testid` selectors over CSS classes or text content:
```typescript
// Good
page.locator('[data-testid="submit-button"]')

// Less ideal
page.locator('button.primary')

// Brittle
page.locator('button:has-text("Submit")')
```

### 2. Wait for network idle
Always wait for the page to load completely:
```typescript
await page.goto(url);
await page.waitForLoadState('networkidle');
```

### 3. Handle optional elements
Use `.catch()` for elements that may not exist:
```typescript
const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
```

### 4. Use .first() for flexible selectors
When targeting multiple potential matches, use `.first()`:
```typescript
const button = page.locator('button:has-text("Save"), button:has-text("Update")').first();
```

### 5. Test skip conditions
Skip tests gracefully when preconditions aren't met:
```typescript
if (currentURL.includes('login')) {
  test.skip();
}
```

## Test Patterns

### Pattern 1: Navigate + Wait for Load
```typescript
await page.goto(`${baseURL}/dashboard`);
await page.waitForLoadState('networkidle');
```

### Pattern 2: Fill Form + Submit
```typescript
await page.fill('input[name="email"]', 'test@example.com');
await page.fill('input[name="password"]', 'SecurePassword123!');
await page.click('button:has-text("Sign in")');
```

### Pattern 3: Check for Optional Element
```typescript
const element = page.locator('[data-testid="status"]');
const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);

if (isVisible) {
  await expect(element).toBeInViewport();
}
```

### Pattern 4: Handle Dialogs/Modals
```typescript
const dialog = page.locator('[role="dialog"]');
await dialog.first().waitFor({ state: 'visible', timeout: 5000 });

// Interact with dialog
await page.fill('input[name="name"]', 'Test Value');

// Confirm
await page.click('button:has-text("Confirm")');
```

### Pattern 5: Filter and Click
```typescript
const items = page.locator('[data-testid*="item"]');
const firstItem = items.first();
const editButton = firstItem.locator('button:has-text("Edit")');
await editButton.click();
```

## Troubleshooting

### Test fails with "element not found"
1. Verify the selector exists in the DOM
2. Check if page needs more time to load
3. Add explicit waits: `await page.waitForSelector()`
4. Use browser DevTools to inspect elements

### Flaky tests (intermittent failures)
1. Increase timeout values
2. Add `await page.waitForLoadState('networkidle')`
3. Use `waitFor()` instead of just checking visibility
4. Avoid sleeping (`await page.waitForTimeout()`)

### Tests hang or timeout
1. Check for missing network waits
2. Verify API endpoints are available
3. Check for modals/dialogs blocking interactions
4. Review console for JavaScript errors

### Screenshots not captured
1. Ensure `screenshot: 'only-on-failure'` in config
2. Create `test-results/` directory
3. Check file permissions

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run E2E tests
  run: |
    export BASE_URL=http://localhost:3000
    npm run dev &
    sleep 10
    npx playwright test tests/*.spec.ts

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Coverage Goals

Current test suite covers:
- ✅ Authentication (login, signup, password recovery)
- ✅ Dashboard navigation and stats display
- ✅ Test case CRUD operations
- ✅ Test execution and results
- ✅ Billing and pricing
- ✅ Settings and integrations

Future additions:
- [ ] Mobile responsive testing
- [ ] Dark mode verification
- [ ] Accessibility testing (WCAG)
- [ ] Performance benchmarking
- [ ] Visual regression testing

## Support

For issues or questions:
1. Check test output for detailed error messages
2. Review playwright documentation: https://playwright.dev
3. Run tests in debug mode: `--debug` flag
4. Enable trace recording: `trace: 'on-first-retry'`

---

**Last Updated:** April 2026
**Qestro Version:** Latest
