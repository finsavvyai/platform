import { defineConfig, devices } from '@playwright/test';

/**
 * TenantIQ E2E Test Configuration
 *
 * Runs real browser tests against live local servers.
 * No mocking — tests hit the actual API with real D1 database.
 */
export default defineConfig({
	testDir: './tests/e2e',

	timeout: 60_000,

	expect: {
		timeout: 10_000,
	},

	fullyParallel: true,

	forbidOnly: !!process.env.CI,

	retries: process.env.CI ? 2 : 0,

	workers: process.env.CI ? 1 : undefined,

	reporter: [
		['html', { outputFolder: 'playwright-report' }],
		['json', { outputFile: 'test-results/results.json' }],
		['list'],
	],

	use: {
		baseURL: process.env.BASE_URL || 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
		},
	],

	webServer: [
		{
			// wrangler pages dev: serves Cloudflare Pages output (production runtime).
			// Run 'pnpm build' before E2E tests locally. CI e2e job already does this.
			command:
				'wrangler pages dev apps/web/.svelte-kit/cloudflare --port 5173 --compatibility-date 2024-09-23',
			url: 'http://localhost:5173',
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			stdout: 'pipe',
			stderr: 'pipe',
		},
		{
			command: 'pnpm --filter @tenantiq/api dev',
			url: 'http://localhost:8787/health',
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			stdout: 'pipe',
			stderr: 'pipe',
		},
	],
});
