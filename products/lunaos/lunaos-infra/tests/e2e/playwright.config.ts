import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const MARKETING_URL = process.env.MARKETING_URL || 'https://lunaos.ai';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://agents.lunaos.ai';
const STUDIO_URL = process.env.STUDIO_URL || 'https://studio.lunaos.ai';
const DOCS_URL = process.env.DOCS_URL || 'https://docs.lunaos.ai';
const API_URL = process.env.API_URL || 'https://api.lunaos.ai';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'en-US',
    colorScheme: 'dark',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: MARKETING_URL,
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: MARKETING_URL,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: MARKETING_URL,
      },
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 14'],
        baseURL: MARKETING_URL,
      },
    },
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 7'],
        baseURL: MARKETING_URL,
      },
    },
    {
      name: 'dashboard',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: DASHBOARD_URL,
      },
    },
    {
      name: 'studio',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: STUDIO_URL,
      },
    },
    {
      name: 'docs',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: DOCS_URL,
      },
    },
    {
      name: 'api',
      use: {
        baseURL: API_URL,
      },
    },
  ],
});

export { MARKETING_URL, DASHBOARD_URL, STUDIO_URL, DOCS_URL, API_URL };
