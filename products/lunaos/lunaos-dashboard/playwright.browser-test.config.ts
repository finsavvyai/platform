import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'browser-test.spec.ts',
  fullyParallel: true,
  retries: 1,
  workers: 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: '.luna/browser-test/report' }],
    ['json', { outputFile: '.luna/browser-test/results.json' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  timeout: 60000,
  expect: { timeout: 10000 },
});
