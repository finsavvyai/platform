import * as Sentry from '@sentry/sveltekit';

// Server-side Sentry is disabled on the Cloudflare Workers runtime (Pages).
// `@sentry/sveltekit`'s worker bundle ships without `init`, so calling it
// crashes the Worker at startup. Client-side reporting (hooks.client.ts)
// still captures user-facing errors.
if (typeof (Sentry as { init?: unknown }).init === 'function') {
	Sentry.init({
		dsn: 'https://e7138e0d043e1833744cba0443b87754@o4511240085897216.ingest.de.sentry.io/4511240146976848',
		tracesSampleRate: 1.0,
		enableLogs: true,
	});
}
