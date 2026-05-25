import { defineConfig, devices } from '@playwright/test';

/**
 * Unified Playwright Configuration
 * Supports development, production, and TestQuality integration via environment variables
 *
 * Environment Variables:
 * - PLAYWRIGHT_ENV: 'development' | 'production' | 'testquality'
 * - BASE_URL: Override base URL (e.g., 'https://qestro.app')
 * - CI: Set to '1' or 'true' for CI mode
 */

const environment = process.env.PLAYWRIGHT_ENV || 'development';
const isProduction = environment === 'production';
const isTestQuality = environment === 'testquality';
const isCI = !!process.env.CI;
const playwrightPort = process.env.PLAYWRIGHT_PORT || '3100';
const localBaseURL = process.env.BASE_URL || `http://127.0.0.1:${playwrightPort}`;
const playwrightApiUrl = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:3999';
const playwrightWsUrl = process.env.PLAYWRIGHT_WS_URL || 'ws://127.0.0.1:3998';

// Environment-specific base URLs
const baseURLMap = {
  development: localBaseURL,
  production: process.env.BASE_URL || 'https://qestro.app',
  testquality: localBaseURL,
};

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Run tests in parallel (except production for safety)
  fullyParallel: !isProduction,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: isCI,

  // Retry on CI or production
  retries: isCI || isProduction ? 2 : 0,

  // Workers: fewer in CI/production for stability
  workers: isCI || isProduction ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['line'],
    // Add TestQuality reporter if enabled
    ...(isTestQuality ? [['@testquality/playwright-reporter' as any]] : []),
  ],

  // Shared settings for all projects
  use: {
    // Environment-specific base URL
    baseURL: baseURLMap[environment as keyof typeof baseURLMap],

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Record video on failure
    video: 'retain-on-failure',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Global timeout for each action
    actionTimeout: 30000,

    // Global timeout for navigation
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    // Development: all browsers
    ...(!isProduction ? [
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
      {
        name: 'mobile',
        use: { ...devices['Pixel 5'] },
      },
    ] : []),

    // Production: Chromium only for faster feedback
    ...(isProduction ? [
      {
        name: 'production-chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ] : []),
  ],

  // Test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Output directory for test artifacts
  outputDir: 'test-results/',

  // Whether to preserve output directory on test failures
  preserveOutput: 'failures-only',

  // Automatically start the local frontend when testing against localhost.
  webServer: !isProduction && baseURLMap[environment as keyof typeof baseURLMap].startsWith('http://127.0.0.1:')
    ? {
        command: `VITE_API_URL=${playwrightApiUrl} VITE_WS_URL=${playwrightWsUrl} npm --prefix frontend run dev -- --host 127.0.0.1 --port ${playwrightPort}`,
        url: baseURLMap[environment as keyof typeof baseURLMap],
        reuseExistingServer: true,
        timeout: 120000,
      }
    : undefined,
});
