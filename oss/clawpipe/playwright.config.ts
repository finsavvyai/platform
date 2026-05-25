import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'https://api.clawpipe.ai',
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
  projects: [
    { name: 'api', testMatch: /api\.spec\.ts/ },
    {
      name: 'ui',
      testMatch: /ui\.spec\.ts/,
      use: { browserName: 'chromium', headless: true },
    },
  ],
});
