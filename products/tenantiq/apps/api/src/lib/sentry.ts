import * as Sentry from '@sentry/cloudflare';
import type { Env } from '../index';

const SENSITIVE_HEADER_PATTERN = /^(authorization|cookie|set-cookie|x-.*-token|x-.*-secret|x-.*-key)$/i;
const SENSITIVE_QUERY_KEYS = new Set(['token', 'xcode', 'code', 'state', 'secret', 'apikey', 'api_key', 'access_token', 'refresh_token']);
const SENSITIVE_FIELD_PATTERN = /(password|secret|token|apikey|api_key|cookie|authorization|client_secret|refresh_token|access_token|kek)/i;
const REDACTED = '[redacted]';

function redactUrl(raw: unknown): unknown {
	if (typeof raw !== 'string') return raw;
	try {
		const u = new URL(raw);
		for (const [k] of u.searchParams) {
			if (SENSITIVE_QUERY_KEYS.has(k.toLowerCase())) u.searchParams.set(k, REDACTED);
		}
		return u.toString();
	} catch { return raw; }
}

function scrubObject(obj: Record<string, unknown> | undefined): void {
	if (!obj) return;
	for (const k of Object.keys(obj)) {
		if (SENSITIVE_FIELD_PATTERN.test(k)) { obj[k] = REDACTED; continue; }
		const v = obj[k];
		if (v && typeof v === 'object' && !Array.isArray(v)) scrubObject(v as Record<string, unknown>);
	}
}

function scrubEventInPlace(event: Sentry.Event): void {
	const req = event.request;
	if (req) {
		req.url = redactUrl(req.url) as string | undefined;
		if (req.headers) {
			for (const k of Object.keys(req.headers)) {
				if (SENSITIVE_HEADER_PATTERN.test(k)) (req.headers as Record<string, string>)[k] = REDACTED;
			}
		}
		req.cookies = undefined;
		req.data = undefined;
		req.query_string = undefined;
	}
	scrubObject(event.extra as Record<string, unknown> | undefined);
	scrubObject(event.contexts as Record<string, unknown> | undefined);
	if (event.user) {
		event.user = { id: event.user.id }; // strip email/name/ip
	}
	for (const bc of event.breadcrumbs ?? []) {
		bc.data && scrubObject(bc.data);
		if (bc.message) bc.message = String(redactUrl(bc.message));
	}
}

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Call this once when the worker starts handling a request.
 */
export function initSentry(env: Env, ctx: ExecutionContext) {
	// Only initialize if SENTRY_DSN is configured
	if (!env.SENTRY_DSN) {
		return;
	}

	(Sentry as any).init?.({
		dsn: env.SENTRY_DSN,
		environment: env.ENVIRONMENT || 'production',

		// Set sample rate for production (100% in development)
		sampleRate: env.ENVIRONMENT === 'development' ? 1.0 : 1.0,

		// Performance monitoring
		tracesSampleRate: env.ENVIRONMENT === 'development' ? 1.0 : 0.1, // 10% in production

		// Release tracking
		release: env.SENTRY_RELEASE || 'unknown',

		// Integrate with Cloudflare Workers context
		integrations: [
			Sentry.captureConsoleIntegration({
				levels: ['error', 'warn']
			})
		],

		// Strip credentials before egress. M365 Cert TB5 (Sentry) — see
		// docs/SENTRY_SCRUBBING.md for rules + auditor narrative.
		beforeSend(event) {
			event.tags = { ...(event.tags ?? {}), worker: 'api' };
			scrubEventInPlace(event);
			return event;
		}
	});
}

/**
 * Capture an exception with additional context.
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
	Sentry.captureException(error, {
		extra: context
	});
}

/**
 * Capture a message (non-error event).
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, unknown>) {
	Sentry.captureMessage(message, {
		level,
		extra: context
	});
}

/**
 * Set user context for error tracking.
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
	Sentry.setUser(user);
}

/**
 * Set custom tags for filtering errors.
 */
export function setTags(tags: Record<string, string>) {
	Sentry.setTags(tags);
}

/**
 * Set additional context data.
 */
export function setContext(name: string, context: Record<string, unknown>) {
	Sentry.setContext(name, context);
}

/**
 * Add a breadcrumb for key operations (auth, sync, scan, etc.).
 */
export function addBreadcrumb(
	category: string,
	message: string,
	data?: Record<string, unknown>,
	level: Sentry.SeverityLevel = 'info'
) {
	Sentry.addBreadcrumb({ category, message, data, level });
}

/**
 * Start a transaction for performance monitoring.
 */
export function startTransaction(name: string, op: string) {
	return Sentry.startSpan(
		{
			name,
			op
		},
		(span) => span
	);
}

/**
 * Wrap an async function with Sentry error tracking.
 */
export function withSentry<T>(fn: () => Promise<T>): Promise<T> {
	return Sentry.withScope(async () => {
		try {
			return await fn();
		} catch (error) {
			if (error instanceof Error) {
				Sentry.captureException(error);
			}
			throw error;
		}
	});
}
