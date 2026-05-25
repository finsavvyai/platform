import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		conditions: ['browser']
	},
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'json-summary', 'html'],
			reportsDirectory: 'coverage',
			include: ['src/**/*.{ts,svelte}'],
			exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/__mocks__/**'],
			// Portfolio CLAUDE.md: >=90% line / >=85% branch overall.
			thresholds: {
				lines: 90,
				statements: 90,
				functions: 85,
				branches: 85,
				autoUpdate: false,
			},
		},
		alias: {
			$lib: path.resolve('./src/lib'),
			$stores: path.resolve('./src/lib/stores'),
			$api: path.resolve('./src/lib/api'),
			$utils: path.resolve('./src/lib/utils'),
			'$app/environment': path.resolve('./src/lib/__mocks__/app-environment.ts'),
			'$app/navigation': path.resolve('./src/lib/__mocks__/app-navigation.ts')
		},
		globals: true
	}
});
