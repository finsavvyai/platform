import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createPlaywrightConfig } from '@finsavvyai/test-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const baseConfig = createPlaywrightConfig({
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  timeout: 60_000,
});

export default defineConfig({
  ...baseConfig,
  testDir: './tests',
  testMatch: ['**/*.spec.ts', '**/*.e2e.ts', '**/*.test.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['github'],
  ],
  use: {
    ...baseConfig.use,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
    { name: 'Tablet', use: { ...devices['iPad Pro'] } },
    {
      name: 'visual-regression',
      use: { ...devices['Desktop Chrome'], screenshot: 'only-on-failure' },
      testMatch: /.*\.visual\.spec\.ts/,
    },
    {
      name: 'accessibility',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.a11y\.spec\.ts/,
    },
  ],
  expect: { timeout: 10_000 },
  outputDir: 'test-results/artifacts',
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),
  webServer: process.env.CI ? undefined : {
    command: 'cd ../landing-page && npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
