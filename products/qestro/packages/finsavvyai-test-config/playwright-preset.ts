/**
 * @finsavvyai/test-config — Shared Playwright preset
 */

import type { PlaywrightTestConfig } from '@playwright/test';

export const playwrightPreset: PlaywrightTestConfig = {
  timeout: 60000,
  retries: 1,
  workers: undefined, // auto-detect
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['line'],
  ],
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 393, height: 851 },
        isMobile: true,
      },
    },
  ],
};
