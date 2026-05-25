import { defineConfig, devices } from '@playwright/test';

const PRODUCTION_URL = 'https://opensyber.cloud';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 35_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? PRODUCTION_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth-setup\.spec\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /auth-setup\.spec\.ts|dashboard-(pages|flows)\.spec\.ts|journey-.*\.spec\.ts|visual-regression\.spec\.ts|visual\/.*\.spec\.ts/,
    },
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/user.json',
      },
      testMatch: /dashboard-(pages|pages-extended|flows)\.spec\.ts|agent-lifecycle|security-suite|cloud-cspm|vault-secrets|team-org|admin-panel|persona-marcus|persona-amira|persona-priya|signup-deploy|marketplace-install|billing-upgrade|team-invite|journey-.*|visual-regression\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'visual',
      testDir: './e2e/visual',
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
        deviceScaleFactor: 1,
        viewport: { width: 1440, height: 900 },
      },
      retries: 0,
    },
  ],
});
