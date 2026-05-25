import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for smoke testing
 * Focused on critical user journeys
 */
export default defineConfig({
  // Test directory for smoke tests
  testDir: './tests/e2e/smoke',

  // Run tests in series for smoke tests
  fullyParallel: false,

  // No retries for smoke tests
  retries: 0,

  // Single worker for smoke tests
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-smoke-report' }],
    ['junit', { outputFile: 'test-results/junit-smoke-playwright.xml' }],
    ['console'],
  ],

  // Global setup
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),

  // Shorter timeout for smoke tests
  timeout: 15 * 1000,
  expect: {
    timeout: 3 * 1000,
  },

  // Artifact configuration
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 5 * 1000,
    navigationTimeout: 15 * 1000,
  },

  // Use only Chrome for smoke tests
  projects: [
    {
      name: 'smoke-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Web server configuration
  webServer: [
    {
      command: 'npm run dev:api',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev:web',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  // Output directory
  outputDir: 'test-results/smoke/',

  // Metadata
  metadata: {
    'Test Type': 'Smoke',
    'Test Environment': process.env.NODE_ENV || 'test',
    'Base URL': process.env.BASE_URL || 'http://localhost:3000',
  },
});
