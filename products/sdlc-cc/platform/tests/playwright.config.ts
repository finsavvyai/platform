import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { createPlaywrightConfig } from '@finsavvyai/test-config';

require('dotenv').config({ path: path.resolve(__dirname, 'test.env') });

const baseConfig = createPlaywrightConfig({
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  timeout: 60_000,
});

export default defineConfig({
  ...baseConfig,
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'test-results/html-report' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
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
    { name: 'Microsoft Edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'Google Chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  timeout: 60000,
  expect: { timeout: 5000 },
  outputDir: 'test-results/artifacts',
});
