# SDLC Platform - User Onboarding Playwright Tests

Comprehensive end-to-end test suite for the SDLC Platform user onboarding flow using Playwright.

## Overview

This test suite covers the complete user onboarding journey for the SDLC.ai platform, including:

- Landing page functionality
- User registration/sign-up flow
- User authentication/login flow
- Dashboard access and API key management
- Settings and profile management
- Visual regression testing
- Mobile responsiveness testing
- Accessibility testing (WCAG compliance)

## Features

- **Page Object Model (POM)** pattern for maintainable test code
- **Visual regression tests** with screenshot comparison
- **Mobile responsiveness** testing across various devices
- **Accessibility checks** using axe-core
- **Test data fixtures** for realistic test scenarios
- **Multi-browser support** (Chrome, Firefox, Safari, Edge)
- **Cross-device testing** (Desktop, Tablet, Mobile)

## Project Structure

```
tests/onboarding/
├── fixtures/              # Test fixtures and data
│   ├── pages.fixture.ts   # Page Object Model fixtures
│   ├── test-data.fixture.ts # Test data generators
│   └── index.ts           # Fixtures export
├── pages/                 # Page Object Models
│   ├── landing.page.ts    # Landing page POM
│   ├── sign-up.page.ts    # Sign up page POM
│   ├── sign-in.page.ts    # Sign in page POM
│   ├── dashboard.page.ts  # Dashboard POM
│   └── getting-started.page.ts # Getting started POM
├── tests/                 # Test files
│   ├── landing-page.spec.ts
│   ├── sign-up.spec.ts
│   ├── sign-in.spec.ts
│   ├── dashboard-access.spec.ts
│   ├── api-keys.spec.ts
│   ├── settings.spec.ts
│   ├── visual.visual.spec.ts
│   ├── mobile.spec.ts
│   └── accessibility.a11y.spec.ts
├── playwright.config.ts   # Playwright configuration
├── global-setup.ts        # Global test setup
├── global-teardown.ts     # Global test teardown
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── .env.example           # Environment variables template
```

## Installation

1. Install dependencies:

```bash
cd tests/onboarding
npm install
```

2. Install Playwright browsers:

```bash
npm run setup
```

3. Configure environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

## Configuration

### Environment Variables

Create a `.env` file in the `tests/onboarding` directory:

```env
# Base URL for the application under test
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Test user credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=TestPass123!

# Clerk authentication keys (if using Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key_here
CLERK_SECRET_KEY=your_secret_here

# API endpoints
API_BASE_URL=http://localhost:8080
```

### Playwright Config

The `playwright.config.ts` file contains all test configurations:

- **Browser selection**: Chromium, Firefox, WebKit
- **Viewport sizes**: Mobile (375x667), Tablet (768x1024), Desktop (1280x720)
- **Timeouts**: Action timeout 15s, Navigation timeout 30s
- **Reporters**: HTML, JSON, JUnit
- **Retries**: 2 on CI, 1 locally

## Running Tests

**Prerequisite:** The app under test must be reachable at `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`). From the repo root, start the landing app in another terminal: `cd landing-page && npm run dev`. Alternatively set `PLAYWRIGHT_BASE_URL` to a deployed URL (e.g. `https://sdlc.cc`).

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Landing page tests
npm run test:landing

# Sign up flow tests
npm run test:signup

# Sign in flow tests
npm run test:signin

# Dashboard tests
npm run test:dashboard

# Settings tests
npm run test:settings
```

### Run Visual Regression Tests

```bash
npm run test:visual
```

To update visual snapshots:

```bash
npm run update-snapshots
```

### Run Mobile Responsiveness Tests

```bash
npm run test:mobile
```

### Run Accessibility Tests

```bash
npm run test:a11y
```

### Run Tests with UI Mode

```bash
npm run test:ui
```

### Run Tests in Headed Mode

```bash
npm run test:headed
```

### Run Tests in Debug Mode

```bash
npm run test:debug
```

### View Test Report

```bash
npm run test:report
```

## Test Coverage

| Feature | Test File | Coverage |
|---------|-----------|----------|
| Landing Page | `landing-page.spec.ts` | Hero section, navigation, features, pricing, demo form, footer |
| Sign Up Flow | `sign-up.spec.ts` | Form validation, successful registration, OAuth options, email verification |
| Sign In Flow | `sign-in.spec.ts` | Form validation, successful login, password features, session management |
| Dashboard Access | `dashboard-access.spec.ts` | Auth requirements, protected routes, session validation |
| API Key Management | `api-keys.spec.ts` | Key generation, display, copy, delete functionality |
| Settings & Profile | `settings.spec.ts` | Profile editing, security settings, sign out flow |
| Visual Regression | `visual.visual.spec.ts` | Full page and component screenshots |
| Mobile Responsive | `mobile.spec.ts` | Touch interactions, mobile menu, orientation changes |
| Accessibility | `accessibility.a11y.spec.ts` | WCAG compliance, keyboard navigation, ARIA labels |

## Page Object Model

### Example Usage

```typescript
import { test, expect } from '../fixtures';

test('user can sign up', async ({ signUpPage, testData }) => {
  await signUpPage.goto();
  
  const user = testData.users.generate();
  await signUpPage.register({
    email: user.email,
    password: user.password,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  
  // Assertions...
});
```

### Available Page Objects

- `LandingPage`: Landing page interactions
- `SignUpPage`: Registration form interactions
- `SignInPage`: Login form interactions
- `DashboardPage`: Dashboard interactions
- `GettingStartedPage`: Getting started guide interactions

## Test Data Fixtures

### Example Usage

```typescript
import { test } from '../fixtures/test-data.fixture';

test('uses generated test data', async ({ testData }) => {
  const user = testData.users.generate();
  const tenant = testData.tenants.generate();
  const demoData = testData.demoFormData.generate();
  
  // Use test data in test...
});
```

### Available Test Data

- `testUsers.valid`: Valid user data
- `testUsers.generate()`: Generate unique user with timestamp
- `testTenants.generate()`: Generate unique tenant
- `demoFormData.generate()`: Generate demo form data
- `piiTestData`: PII test data for playground

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install dependencies
  run: npm ci
  working-directory: tests/onboarding

- name: Install Playwright browsers
  run: npx playwright install --with-deps
  working-directory: tests/onboarding

- name: Run tests
  run: npm run test:ci
  working-directory: tests/onboarding

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: tests/onboarding/test-results/
```

## Troubleshooting

### Tests Fail with "Browser Not Found"

```bash
npm run setup
```

### Tests Fail with Connection Refused

Make sure your application is running:

```bash
cd ../landing-page
npm run dev
```

### Visual Tests Fail

Update snapshots if changes are intentional:

```bash
npm run update-snapshots
```

### Accessibility Tests Fail

Install axe-core:

```bash
npm install --save-dev @axe-core/playwright
```

## Best Practices

1. **Use Page Objects**: Always interact with pages through Page Object Models
2. **Generate Unique Data**: Use `testData.users.generate()` for unique test users
3. **Wait for Load States**: Use `waitForLoadState()` before assertions
4. **Clean Up**: Sign out users after tests to avoid state pollution
5. **Descriptive Tests**: Use clear test names that describe the behavior

## Contributing

When adding new tests:

1. Create/update Page Object Models in `pages/`
2. Add test data fixtures if needed
3. Write tests in the appropriate `*.spec.ts` file
4. Run tests locally before committing
5. Update this README if adding new features

## License

MIT
