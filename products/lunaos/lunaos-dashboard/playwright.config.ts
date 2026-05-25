import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Claude Agent Platform
 * 
 * Run all tests: npx playwright test
 * Run specific test: npx playwright test tests/e2e/web.spec.ts
 * Run with UI: npx playwright test --ui
 * Generate report: npx playwright show-report
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet viewport
    {
      name: 'Tablet',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev --workspace=@claude-agent/web',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Global timeout
  timeout: 60 * 1000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },
});
