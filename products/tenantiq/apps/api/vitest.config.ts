import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		include: ['src/**/*.test.ts'],
		exclude: ['**/node_modules/**', 'dist'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'json-summary', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'node_modules/'],
			// Portfolio CLAUDE.md: >=90% line / >=85% branch overall.
			thresholds: {
				lines: 90,
				statements: 90,
				functions: 85,
				branches: 85,
				autoUpdate: false,
			},
		},
	},
	resolve: {
		alias: {
			'@tenantiq/db': path.resolve(__dirname, '../../packages/db/src'),
			'@tenantiq/shared': path.resolve(__dirname, '../../packages/shared/src'),
		},
	},
});
