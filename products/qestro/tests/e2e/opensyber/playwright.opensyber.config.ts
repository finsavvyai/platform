import { defineConfig, devices } from '@playwright/test';

/**
 * Qestro Test Configuration — OpenSyber.cloud
 *
 * Run: npx playwright test --config=tests/e2e/opensyber/playwright.opensyber.config.ts
 *
 * Environment Variables:
 * - OPENSYBER_URL: Override target URL (default: https://opensyber.cloud)
 * - TOKENFORGE_URL: Override TokenForge URL (default: https://tokenforge.opensyber.cloud)
 */

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',

  fullyParallel: false,
  retries: 1,
  workers: 1,

  reporter: [
    ['html', { outputFolder: '../../../playwright-report/opensyber', open: 'never' }],
    ['json', { outputFile: '../../../test-results/opensyber/results.json' }],
    ['junit', { outputFile: '../../../test-results/opensyber/results.xml' }],
    ['line'],
  ],

  use: {
    baseURL: process.env.OPENSYBER_URL || 'https://opensyber.cloud',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: '09-i18n-responsive.spec.ts',
    },
  ],

  timeout: 60_000,

  expect: {
    timeout: 10_000,
  },

  outputDir: '../../../test-results/opensyber/',
});
