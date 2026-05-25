import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const API_URL = process.env.API_URL || 'https://api.tenantiq.app';

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'html',
	timeout: 30_000,
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'mobile',
			use: { ...devices['iPhone 14'] },
		},
	],
	webServer: {
		command: 'npx vite dev --port 5174',
		url: BASE_URL,
		reuseExistingServer: true,
		timeout: 30_000,
	},
});
