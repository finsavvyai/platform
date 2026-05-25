import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /luna-heal-prod-connect\.spec\.ts$/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: '/tmp/luna-heal-prod-connect/report.json' }]],
  retries: 0,
  workers: 3,
  use: {
    headless: true,
    actionTimeout: 10_000,
    navigationTimeout: 25_000,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
