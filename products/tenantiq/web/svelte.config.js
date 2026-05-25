import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// BUILD_TARGET=mobile → static build for Capacitor (npm run build:mobile)
// BUILD_TARGET=cloudflare or unset → cloudflare adapter for web (npm run build)
const target = process.env.BUILD_TARGET ?? 'cloudflare';
const adapter = target === 'mobile'
	? staticAdapter({
		pages: 'build',
		assets: 'build',
		fallback: 'index.html', // SPA mode — Capacitor needs client-side routing
		precompress: false,
		strict: false,
	})
	: cloudflareAdapter({
		routes: { include: ['/*'], exclude: ['<all>'] },
	});

/** @type {import('@sveltejs/kit').Config} */
const config = {
				preprocess: vitePreprocess(),
				kit: {
				 adapter,

				 alias: {
									$components: 'src/lib/components',
									$stores: 'src/lib/stores',
									$api: 'src/lib/api',
									$utils: 'src/lib/utils'
					},

				 experimental: target === 'mobile' ? {} : {
					 tracing: {
						 server: true
						},

					 instrumentation: {
						 server: true
						}
					}
				}
};

export default config;