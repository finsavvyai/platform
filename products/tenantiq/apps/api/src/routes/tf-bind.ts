/**
 * TokenForge bind proxy.
 *
 * Route: POST /api/tf/bind — matches @opensyber/tokenforge/client's hardcoded
 * endpoint. Forwards the request to tokenforge-api.opensyber.cloud/v1/bind
 * with our TOKENFORGE_API_KEY attached. Keeps the customer's API key server-side
 * so the browser never sees it.
 *
 * The client SDK sends { publicKey: JWK, sessionId, metadata }.
 * The cloud expects { publicKey: string, userId, sessionId, fingerprint? }.
 * We stringify the JWK, fill in userId from the session, and forward.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';

const DEFAULT_API_BASE = 'https://tokenforge-api.opensyber.cloud';

export const tfBindRoutes = new Hono<AppEnv>();
tfBindRoutes.use('*', authMiddleware);

interface ClientBindRequest {
	publicKey: JsonWebKey | string;
	sessionId: string;
	metadata?: Record<string, string>;
}

tfBindRoutes.post('/bind', async (c) => {
	const user = c.get('user');
	const apiKey = (c.env as { TOKENFORGE_API_KEY?: string }).TOKENFORGE_API_KEY;
	if (!apiKey) {
		return c.json({ error: 'tokenforge_disabled', message: 'TokenForge cloud not configured for this deployment.' }, 503);
	}

	const body = (await c.req.json().catch(() => null)) as ClientBindRequest | null;
	if (!body?.publicKey || !body.sessionId) {
		return c.json({ error: 'validation_error', message: 'publicKey and sessionId required' }, 400);
	}
	const publicKeyStr = typeof body.publicKey === 'string' ? body.publicKey : JSON.stringify(body.publicKey);

	const apiBase = (c.env as { TOKENFORGE_API_BASE?: string }).TOKENFORGE_API_BASE ?? DEFAULT_API_BASE;
	const cloudRes = await fetch(`${apiBase}/v1/bind`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			publicKey: publicKeyStr,
			userId: user.sub,
			sessionId: body.sessionId,
			fingerprint: body.metadata?.fingerprint,
		}),
	});

	const data = (await cloudRes.json().catch(() => ({}))) as Record<string, unknown>;
	if (!cloudRes.ok) {
		console.error('[tf-bind] cloud error:', cloudRes.status, data);
		return c.json(data, cloudRes.status as 400 | 401 | 403 | 409 | 500);
	}
	// Unwrap the cloud's `{ data: { deviceId, ... } }` envelope for the client SDK.
	const payload = (data as { data?: Record<string, unknown> }).data ?? data;
	return c.json(payload, 201);
});
