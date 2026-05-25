import { defineConfig, devices } from '@playwright/test';

const studioUrl = process.env.STUDIO_URL || 'http://localhost:5173';
const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
const marketingUrl = process.env.MARKETING_URL || 'http://localhost:4000';
const apiUrl = process.env.API_URL || 'http://localhost:8787';
const mockOnly = process.env.MOCK_ONLY !== 'false';
const autoServe = process.env.AUTO_SERVE !== 'false';
const repoRoot = '../..';

const webServer = autoServe
    ? [
          {
              command: `cd ${repoRoot}/lunaos-studio && npm run dev`,
              url: studioUrl,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
              stdout: 'pipe' as const,
          },
          {
              command: `cd ${repoRoot}/lunaos-dashboard && npm run dev`,
              url: dashboardUrl,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
              stdout: 'pipe' as const,
          },
          {
              command: `cd ${repoRoot}/lunaos-marketing && npx --yes serve -l 4000 -s .`,
              url: marketingUrl,
              reuseExistingServer: !process.env.CI,
              timeout: 60_000,
              stdout: 'pipe' as const,
          },
      ]
    : undefined;

export default defineConfig({
    webServer,
    testDir: './specs',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: [
        ['list'],
        ['json', { outputFile: 'test-results/results.json' }],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ],
    timeout: 30_000,
    expect: { timeout: 5_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 10_000,
        navigationTimeout: 15_000,
    },
    projects: [
        {
            name: 'studio',
            testMatch: /studio\.spec\.ts/,
            use: { baseURL: studioUrl, ...devices['Desktop Chrome'] },
        },
        {
            name: 'dashboard',
            testMatch: /dashboard\.spec\.ts/,
            use: { baseURL: dashboardUrl, ...devices['Desktop Chrome'] },
        },
        {
            name: 'marketing',
            testMatch: /marketing\.spec\.ts/,
            use: { baseURL: marketingUrl, ...devices['Desktop Chrome'] },
        },
        {
            name: 'visual',
            testMatch: /visual\.spec\.ts/,
            use: { baseURL: marketingUrl, viewport: { width: 1280, height: 720 } },
        },
        {
            name: 'extension',
            testMatch: /extension\.spec\.ts/,
            use: { baseURL: apiUrl, extraHTTPHeaders: { 'User-Agent': 'LunaOS-Ext/1.0' } },
        },
        {
            name: 'ai-agent',
            testMatch: /ai-agent\.spec\.ts/,
            use: { baseURL: studioUrl },
        },
    ],
    metadata: { mockOnly, apiUrl, studioUrl, dashboardUrl, marketingUrl },
});
