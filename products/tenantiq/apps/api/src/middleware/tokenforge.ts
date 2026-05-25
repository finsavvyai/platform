/**
 * TokenForge middleware — delegates verification to tokenforge-api.opensyber.cloud.
 *
 * When TOKENFORGE_API_KEY is set, every tenant-scoped request is forwarded to
 * `/v1/edge/verify` on the cloud, which checks the client's ECDSA signature
 * against the device binding stored from /api/tf/bind. The cloud returns one
 * of: allow / step_up / block. Sensitive endpoints additionally require
 * trustScore >= 90.
 *
 * When the secret is absent, falls back to the legacy per-tenant hash-header
 * stub for backward compatibility.
 */
import { createMiddleware } from 'hono/factory';
import { opensyberTokenForge } from './tokenforge-opensyber';
import type { AppEnv } from '../app/types';

export const tokenforgeMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const apiKey = (c.env as { TOKENFORGE_API_KEY?: string }).TOKENFORGE_API_KEY;

	// Production path — cloud-verified ECDSA signatures.
	if (apiKey) {
		const realMw = opensyberTokenForge({
			apiKey,
			skipPaths: [
				'/api/health',
				'/api/auth/*',
				'/api/billing/webhook',
				'/api/tf/bind',
				'/api/tenants/:tenantId/tokenforge/bind',
			],
			sensitiveOps: [
				'/api/tenants/:tenantId/tokenforge/*',
				'/api/tenants/:tenantId/remediate',
			],
		});
		return realMw(c, next);
	}

	// Fallback — legacy per-tenant hash-header stub.
	const tenantId = c.get('tenantId');
	const user = c.get('user');
	if (!tenantId || !user) return next();

	const db = c.env.DB;
	const config = await db
		.prepare('SELECT enabled, enforce_mode FROM tokenforge_config WHERE tenant_id = ?')
		.bind(tenantId)
		.first()
		.catch(() => null);

	if (!config || config.enabled !== 1) return next();

	const fingerprint = c.req.header('X-TF-Device-Fingerprint');
	const keyHash = c.req.header('X-TF-Public-Key-Hash');
	const mode = config.enforce_mode as string;

	if (!fingerprint || !keyHash) {
		if (mode === 'monitor') return next();
		return c.json({ error: 'Device binding required', code: 'TF_MISSING_HEADERS' }, 403);
	}

	const binding = await db
		.prepare(
			`SELECT public_key_hash, status, expires_at FROM tokenforge_device_bindings
			 WHERE tenant_id = ? AND user_id = ? AND device_fingerprint = ?`,
		)
		.bind(tenantId, user.sub, fingerprint)
		.first()
		.catch(() => null);

	if (!binding || binding.status === 'revoked') {
		if (mode === 'monitor') return next();
		return c.json({ error: 'Device not registered', code: 'TF_UNBOUND_DEVICE' }, 403);
	}
	if (binding.expires_at && (binding.expires_at as number) < Date.now() && mode === 'strict') {
		return c.json({ error: 'Device binding expired', code: 'TF_BINDING_EXPIRED' }, 403);
	}
	if (binding.public_key_hash !== keyHash && mode !== 'monitor') {
		return c.json({ error: 'Device key mismatch', code: 'TF_KEY_MISMATCH' }, 403);
	}

	return next();
});
