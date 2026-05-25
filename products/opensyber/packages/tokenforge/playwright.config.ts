import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser smoke matrix for @opensyber/tokenforge browser SDK.
 *
 * Runs the bind / sign / refresh flows against the BUILT package
 * (dist/client/) — mirroring what customers actually `npm install` —
 * across three browser engines: Chromium, Firefox, WebKit.
 *
 * The mock TF API server is started by Playwright's `webServer` config
 * on http://localhost:4173. Test fixture HTML loads the built ESM
 * client as a module and exposes `window.tf` for the test driver.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'tsx e2e/fixtures/mock-server.ts',
    port: 4173,
    timeout: 10_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
});
