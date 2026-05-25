import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: 'audit-prod.spec.ts',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL: 'https://app.tenantiq.app',
		trace: 'off',
		screenshot: 'only-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
