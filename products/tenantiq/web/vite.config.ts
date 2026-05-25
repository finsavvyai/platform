import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			org: 'finsaviai',
			project: 'javascript-sveltekit',
			// Auto-instrumentation injects `Sentry.init` into a generated
			// hooks.server.ts, which fails on the Cloudflare Workers runtime
			// (Pages) because @sentry/sveltekit's worker bundle omits `init`.
			// We init manually in hooks.client.ts only.
			autoInstrument: false,
		}),
		tailwindcss(),
		sveltekit(),
		...(process.env.ANALYZE
			? [
					visualizer({
						filename: 'bundle-stats.html',
						open: false,
						gzipSize: true,
						brotliSize: true,
					}),
				]
			: []),
	],
});
