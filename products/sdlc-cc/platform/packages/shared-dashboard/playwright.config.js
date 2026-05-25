import { devices } from '@playwright/test';
import { createPlaywrightConfig } from '@finsavvyai/test-config';

const baseConfig = createPlaywrightConfig({
  baseURL: 'http://localhost:3000',
});

const config = {
  ...baseConfig,
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],
  use: {
    ...baseConfig.use,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'echo "Dashboard server already running on port 3000"',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  globalSetup: './tests/global-setup.js',
  globalTeardown: './tests/global-teardown.js',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
};

export default config;
