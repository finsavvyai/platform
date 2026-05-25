import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { logger as appLogger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { captureException, setContext, setTags, setUser } from '../lib/sentry';
import { validateEnv } from '../lib/validate-env';
import { performanceMiddleware } from '../middleware/performance';
import { requestId } from '../middleware/request-id';
import { securityHeaders } from '../middleware/security-headers';
import { tracingMiddleware } from '../middleware/tracing';
import { registerRoutes } from './register-routes';
import type { AppEnv } from './types';
import { URLS } from '../lib/constants';

function normalizeOrigin(o: string): string {
	return o.toLowerCase().replace(/\/+$/, '');
}

const productionOrigins: string[] = URLS.ALLOWED_ORIGINS.map(normalizeOrigin);

export function createApp() {
	const app = new Hono<AppEnv>();

	app.use('*', logger());
	app.use('*', tracingMiddleware);
	app.use('*', requestId);
	app.use('*', performanceMiddleware);
	app.use('*', secureHeaders({
		xFrameOptions: 'DENY',
		xContentTypeOptions: 'nosniff',
		referrerPolicy: 'strict-origin-when-cross-origin',
		strictTransportSecurity: 'max-age=31536000; includeSubDomains',
	}));
	app.use('*', securityHeaders);
	// CSRF protects browser-cookie auth. SCIM uses long-lived Bearer tokens
	// from external IdPs (Okta, Entra) — no cookies, no ambient credentials,
	// no CSRF risk. Skip the check so SCIM POST/PATCH/DELETE aren't blocked.
	app.use('*', async (c, next) => {
		if (c.req.path.startsWith('/scim/v2/')) return next();
		return csrf({
			origin: (origin: string, ctx: any) => {
				const n = normalizeOrigin(origin);
				if (ctx.env.ENVIRONMENT !== 'production' && n.startsWith('http://localhost')) return true;
				return productionOrigins.includes(n);
			},
		})(c, next);
	});
	app.use('*', async (c, next) => {
		const allowedOrigins =
			c.env.ENVIRONMENT === 'production'
				? productionOrigins
				: [...productionOrigins, 'http://localhost:5173'];

		return cors({
			origin: (origin) => (allowedOrigins.includes(normalizeOrigin(origin)) ? origin : null),
			allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
			allowHeaders: [
				'Content-Type',
				'Authorization',
				'X-Tenant-Id',
				// TokenForge device-binding headers (sent by apps/web api client).
				'X-TF-Device-Fingerprint',
				'X-TF-Public-Key-Hash',
				'X-TF-Signature',
				'X-TF-Timestamp',
			],
			// Browser needs to see X-Refresh-Session so client can trigger /auth/refresh
			// when the JWT is stale (set by the tenant-access middleware on DB-fallback hits).
			exposeHeaders: ['X-Refresh-Session'],
			credentials: true,
			maxAge: 86400,
		})(c, next);
	});

	let envValidated = false;
	app.use('*', async (c, next) => {
		if (!envValidated) {
			validateEnv(c.env);
			envValidated = true;
		}
		await next();
	});

	registerRoutes(app);

	app.notFound((c) => {
		return c.json({
			error: { code: 'NOT_FOUND', message: 'Route not found' },
		}, 404);
	});

	app.onError((err, c) => {
		const reqId = c.get('requestId');

		// Structured AppError — return its code and status directly
		if (err instanceof AppError) {
			appLogger.warn('AppError', { code: err.code, message: err.message, requestId: reqId });
			return c.json(err.toJSON(), err.status as any);
		}

		// Hono HTTPException (CSRF, validator, etc.) — surface the intended
		// status (403, 400, ...) instead of masking as generic 500.
		const e = err as { status?: number; getResponse?: () => Response; message?: string };
		if (typeof e?.status === 'number' && typeof e?.getResponse === 'function') {
			appLogger.warn('HttpException', { status: e.status, message: e.message, requestId: reqId });
			return e.getResponse();
		}

		appLogger.error('Unhandled request error', err, {
			path: c.req.path, method: c.req.method, requestId: reqId,
		});

		// Attach user context for Sentry breadcrumbs
		try {
			const user = c.get('user');
			if (user?.sub) {
				setUser({ id: user.sub, email: user.email });
				setTags({ orgId: user.orgId, role: user.role });
			}
		} catch { /* user may not be set */ }

		setContext('request', {
			path: c.req.path, method: c.req.method, requestId: reqId,
			headers: Object.fromEntries(c.req.raw.headers),
		});
		setTags({ path: c.req.path, method: c.req.method });
		captureException(err, {
			requestId: reqId, path: c.req.path, method: c.req.method,
		});

		return c.json({
			error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
		}, 500);
	});

	return app;
}
