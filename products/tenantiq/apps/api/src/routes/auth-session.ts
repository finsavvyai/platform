/** Session helpers: JWT verify/sign + cookie value construction. */

import type { Context } from 'hono';
import * as jose from 'jose';
import type { AppEnv } from '../app/types';
import { URLS } from '../lib/constants';
import { getRS256PrivateKey, getRS256PublicKey, getHS256Secret, isRS256Configured } from '../lib/jwt-keys';

/** JWT issuer + audience — defense-in-depth so leaked keys can't mint
 *  cross-service tokens that pass our verifier. Sourced from `lib/constants`
 *  to keep one source of truth. */
export const JWT_ISSUER = 'tenantiq.app';
export const JWT_AUDIENCE = 'tenantiq-api';

const REVOKED_PREFIX = 'jwt:revoked:';

/** Generate a base64url 16-byte JTI (random, unique per token). */
function genJti(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Verify JWT: try RS256 (if configured), fall back to HS256 for migration.
 *  Always asserts iss + aud unless the caller opts out (legacy tokens). */
export async function verifyTokenWithFallback(
	token: string,
	env: { RS256_PUBLIC_KEY?: string; RS256_PRIVATE_KEY?: string; JWT_SECRET: string; KV?: KVNamespace },
	options?: { clockTolerance?: number; skipIssAud?: boolean; checkRevocation?: boolean },
): Promise<jose.JWTPayload> {
	const verifyOpts: Parameters<typeof jose.jwtVerify>[2] = {
		clockTolerance: options?.clockTolerance,
		// Tokens issued before this PR don't carry iss/aud. Hono callers can
		// opt out for backward-compat during the rollout window.
		...(options?.skipIssAud ? {} : { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }),
	};

	let payload: jose.JWTPayload;
	if (isRS256Configured(env)) {
		try {
			const pubKey = await getRS256PublicKey(env.RS256_PUBLIC_KEY!);
			const r = await jose.jwtVerify(token, pubKey, { ...verifyOpts, algorithms: ['RS256'] });
			payload = r.payload;
		} catch {
			const secret = getHS256Secret(env.JWT_SECRET);
			const r = await jose.jwtVerify(token, secret, { ...verifyOpts, algorithms: ['HS256'] });
			payload = r.payload;
		}
	} else {
		const secret = getHS256Secret(env.JWT_SECRET);
		const r = await jose.jwtVerify(token, secret, { ...verifyOpts, algorithms: ['HS256'] });
		payload = r.payload;
	}

	// Optional revocation check — caller passes checkRevocation=true on
	// session-bearing endpoints. WS tickets / xcode envelopes (60s/2m TTL)
	// don't need it.
	if (options?.checkRevocation && env.KV && payload.jti) {
		const revoked = await env.KV.get(`${REVOKED_PREFIX}${payload.jti}`);
		if (revoked) {
			throw new jose.errors.JWTInvalid('Token revoked');
		}
	}

	return payload;
}

/** Sign a new JWT using RS256 (preferred) or HS256 (fallback). */
export async function signToken(
	env: { RS256_PRIVATE_KEY?: string; RS256_PUBLIC_KEY?: string; JWT_SECRET: string },
	claims: Record<string, unknown>,
	expiresIn = '24h',
	options?: { skipIssAud?: boolean; jti?: string },
): Promise<string> {
	const body = new jose.SignJWT(claims as jose.JWTPayload)
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.setJti(options?.jti ?? genJti());

	if (!options?.skipIssAud) {
		body.setIssuer(JWT_ISSUER).setAudience(JWT_AUDIENCE);
	}

	if (isRS256Configured(env)) {
		const privateKey = await getRS256PrivateKey(env.RS256_PRIVATE_KEY!);
		return body.setProtectedHeader({ alg: 'RS256', kid: 'tenantiq-rs256-1' }).sign(privateKey);
	}
	const secret = getHS256Secret(env.JWT_SECRET);
	return body.setProtectedHeader({ alg: 'HS256' }).sign(secret);
}

/** Add a JTI to the deny-list with TTL = remaining JWT lifetime, capped at
 *  the original 24h max so the KV entry self-cleans. */
export async function revokeJti(
	kv: KVNamespace,
	jti: string,
	expEpochSeconds: number,
): Promise<void> {
	const ttl = Math.max(60, Math.min(86400, expEpochSeconds - Math.floor(Date.now() / 1000)));
	await kv.put(`${REVOKED_PREFIX}${jti}`, '1', { expirationTtl: ttl });
}

/** Build the Set-Cookie value for the session cookie. */
export function sessionCookieValue(c: Context<AppEnv>, jwt: string, maxAgeSeconds: number): string {
	const frontendUrl = c.env.FRONTEND_URL || URLS.FRONTEND;
	const cookieHost = new URL(frontendUrl).hostname.replace(/^app\./, '');
	const isLocal = cookieHost === 'localhost' || cookieHost === '127.0.0.1';
	const attrs = [
		`tenantiq_session=${jwt}`,
		'Path=/',
		`Max-Age=${maxAgeSeconds}`,
		'HttpOnly',
		'SameSite=Lax',
		`Domain=${cookieHost}`,
	];
	if (!isLocal) attrs.push('Secure');
	return attrs.join('; ');
}

/** Expired Set-Cookie value for logout. */
export function clearSessionCookieValue(c: Context<AppEnv>): string {
	return sessionCookieValue(c, '', 0);
}

/**
 * Short-lived ticket for WebSocket / SSE endpoints that can't send cookies.
 * Signed with the same key as the session token, scope narrowed to "ws".
 * TTL 60s, single-use enforced by the SSE/WS handler via KV.
 */
export async function signWSTicket(
	env: { RS256_PRIVATE_KEY?: string; RS256_PUBLIC_KEY?: string; JWT_SECRET: string },
	claims: { sub: string; orgId: string; tenantIds: string[]; role: string },
): Promise<string> {
	const body = new jose.SignJWT({ ...claims, scope: 'ws' })
		.setIssuedAt()
		.setExpirationTime('60s');

	if (isRS256Configured(env)) {
		const { getRS256PrivateKey } = await import('../lib/jwt-keys');
		const privateKey = await getRS256PrivateKey(env.RS256_PRIVATE_KEY!);
		return body.setProtectedHeader({ alg: 'RS256', kid: 'tenantiq-rs256-1' }).sign(privateKey);
	}
	const secret = getHS256Secret(env.JWT_SECRET);
	return body.setProtectedHeader({ alg: 'HS256' }).sign(secret);
}
