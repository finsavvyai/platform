import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig({
	// Expose PUBLIC_* env vars to the client bundle. Vite's default
	// envPrefix is VITE_; SvelteKit's $env/static/public is the
	// framework-native way but isn't available in plain vitest, so we
	// widen Vite's prefix and read via import.meta.env directly.
	envPrefix: ['VITE_', 'PUBLIC_'],
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
