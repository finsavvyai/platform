const SENTRY_DSN = import.meta.env.PUBLIC_SENTRY_DSN as string | undefined;

interface SentryConfig {
	dsn: string;
	org: string;
	projectId: string;
	publicKey: string;
}

let config: SentryConfig | null = null;

/** Parse Sentry DSN into components for envelope API. */
function parseDsn(dsn: string): SentryConfig | null {
	try {
		const url = new URL(dsn);
		const publicKey = url.username;
		const projectId = url.pathname.replace('/', '');
		const org = url.hostname.split('.')[0];
		return { dsn, org, projectId, publicKey };
	} catch {
		return null;
	}
}

/** Initialize Sentry client-side error tracking. */
export function initSentry(): void {
	if (!SENTRY_DSN) return;
	config = parseDsn(SENTRY_DSN);
	if (!config) return;

	window.addEventListener('error', (event) => {
		captureError(event.error ?? event.message);
	});

	window.addEventListener('unhandledrejection', (event) => {
		captureError(event.reason);
	});
}

const SENSITIVE_QUERY_KEYS = new Set(['token', 'xcode', 'code', 'state', 'secret', 'apikey', 'api_key', 'access_token', 'refresh_token']);

function redactUrl(raw: string): string {
	try {
		const u = new URL(raw);
		for (const [k] of u.searchParams) {
			if (SENSITIVE_QUERY_KEYS.has(k.toLowerCase())) u.searchParams.set(k, '[redacted]');
		}
		return u.toString();
	} catch { return raw; }
}

function redactString(s: string): string {
	// Redact bearer tokens, JWTs, and inline ?token= patterns embedded in error messages.
	return s
		.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
		.replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[jwt-redacted]')
		.replace(/([?&](?:token|xcode|code|state|access_token|refresh_token|secret)=)[^&\s]+/gi, '$1[redacted]');
}

/** Send an error event to Sentry via the envelope API. */
export function captureError(error: unknown): void {
	if (!config) return;

	const rawMessage = error instanceof Error ? error.message : String(error);
	const message = redactString(rawMessage);
	const stack = error instanceof Error && error.stack ? redactString(error.stack) : undefined;

	const header = JSON.stringify({
		event_id: crypto.randomUUID().replace(/-/g, ''),
		dsn: config.dsn,
		sent_at: new Date().toISOString()
	});
	const itemHeader = JSON.stringify({ type: 'event' });
	const payload = JSON.stringify({
		exception: {
			values: [{ type: 'Error', value: message, stacktrace: stack ? { frames: [{ filename: stack }] } : undefined }]
		},
		platform: 'javascript',
		timestamp: Date.now() / 1000,
		environment: import.meta.env.MODE || 'production'
	});

	const envelope = `${header}\n${itemHeader}\n${payload}`;
	const url = `https://o${config.org}.ingest.sentry.io/api/${config.projectId}/envelope/`;

	navigator.sendBeacon?.(url, envelope) ||
		fetch(url, { method: 'POST', body: envelope, keepalive: true }).catch(() => {});
}
