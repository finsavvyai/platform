import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { exportPublicKeyAsJWKS, isRS256Configured } from '../lib/jwt-keys';

export const jwksRoutes = new Hono<AppEnv>();

/** GET /.well-known/jwks.json — public key set for token verification. */
jwksRoutes.get('/', async (c) => {
	if (!isRS256Configured(c.env)) {
		return c.json({ error: 'JWKS not available — RS256 not configured' }, 404);
	}

	const jwks = await exportPublicKeyAsJWKS(c.env.RS256_PUBLIC_KEY!);

	c.header('Cache-Control', 'public, max-age=3600');
	c.header('Content-Type', 'application/json');
	return c.json(jwks);
});
