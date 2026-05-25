import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against a live API server (wrangler dev).
 * Start the API first: pnpm --filter api dev
 */
export default defineConfig({
	test: {
		include: ['**/*.test.ts'],
		testTimeout: 15_000,
		hookTimeout: 30_000,
	},
});
