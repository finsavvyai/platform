/**
 * WebAuthn authentication — biometric/passkey sign-in.
 *
 * Flow:
 *   POST /options  → server issues challenge (optionally for a specific user)
 *   POST /verify   → frontend submits assertion, server verifies + issues JWT
 */
import { Hono } from 'hono';
import { SignJWT } from 'jose';
import {
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { AppEnv } from '../app/types';
import { getRpId, getOrigin, CHALLENGE_TTL_SECONDS } from '../lib/webauthn-config';

export const webauthnAuthRoutes = new Hono<AppEnv>();

webauthnAuthRoutes.post('/options', async (c) => {
	const body = (await c.req.json<{ email?: string }>().catch(() => ({}))) as { email?: string };

	let allowCredentials: Array<{ id: string; transports?: string[] }> | undefined;
	let userId: string | undefined;

	if (body.email) {
		const u = await c.env.DB.prepare(`SELECT id FROM platform_users WHERE email = ?`)
			.bind(body.email).first<{ id: string }>();
		if (u) {
			userId = u.id;
			const creds = await c.env.DB.prepare(
				`SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?`,
			).bind(u.id).all<{ credential_id: string; transports: string }>();
			allowCredentials = (creds.results ?? []).map((cr) => ({
				id: cr.credential_id,
				transports: cr.transports ? cr.transports.split(',') : undefined,
			}));
		}
	}

	const options = await generateAuthenticationOptions({
		rpID: getRpId(c.env),
		allowCredentials: allowCredentials as never,
		userVerification: 'preferred',
	});

	await c.env.KV.put(
		`wa-chal:${options.challenge}`,
		JSON.stringify({ userId, purpose: 'authenticate' }),
		{ expirationTtl: CHALLENGE_TTL_SECONDS },
	);

	return c.json(options);
});

webauthnAuthRoutes.post('/verify', async (c) => {
	const body = await c.req.json<{ response: unknown }>().catch(() => null);
	if (!body?.response) return c.json({ error: 'validation_error' }, 400);

	const resp = body.response as { id: string; response: { clientDataJSON: string } };
	const clientData = JSON.parse(atob(resp.response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/')));
	const expectedChallenge = clientData.challenge;

	const cached = await c.env.KV.get(`wa-chal:${expectedChallenge}`, 'json') as { userId?: string; purpose: string } | null;
	if (!cached || cached.purpose !== 'authenticate') return c.json({ error: 'invalid_challenge' }, 400);

	const cred = await c.env.DB.prepare(
		`SELECT credential_id, user_id, public_key, counter, transports FROM webauthn_credentials WHERE credential_id = ?`,
	).bind(resp.id).first<{ credential_id: string; user_id: string; public_key: ArrayBuffer; counter: number; transports: string }>();
	if (!cred) return c.json({ error: 'unknown_credential' }, 401);

	const verification = await verifyAuthenticationResponse({
		response: body.response as never,
		expectedChallenge,
		expectedOrigin: getOrigin(c.env),
		expectedRPID: getRpId(c.env),
		credential: {
			id: cred.credential_id,
			publicKey: new Uint8Array(cred.public_key),
			counter: cred.counter,
			transports: cred.transports ? (cred.transports.split(',') as never) : undefined,
		},
	});

	if (!verification.verified) return c.json({ error: 'verification_failed' }, 401);

	// Bump counter (replay protection) + last_used_at.
	await c.env.DB.prepare(
		`UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?`,
	).bind(verification.authenticationInfo.newCounter, Date.now(), cred.credential_id).run();
	await c.env.KV.delete(`wa-chal:${expectedChallenge}`);

	// Issue JWT (same shape as auth.ts produces).
	const user = await c.env.DB.prepare(
		`SELECT id, email, role, organization_id FROM platform_users WHERE id = ?`,
	).bind(cred.user_id).first<{ id: string; email: string; role: string; organization_id: string }>();
	if (!user) return c.json({ error: 'user_not_found' }, 401);

	const secret = new TextEncoder().encode(c.env.JWT_SECRET);
	const token = await new SignJWT({
		email: user.email,
		role: user.role,
		orgId: user.organization_id,
		webauthn: true,
	})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(user.id)
		.setExpirationTime('7d')
		.setIssuedAt()
		.sign(secret);

	// Set the same HttpOnly session cookie that /api/auth/login produces, so
	// the rest of the app's cookie-auth middleware works seamlessly.
	const frontendUrl = c.env.FRONTEND_URL || 'https://app.tenantiq.app';
	const cookieHost = new URL(frontendUrl).hostname.replace(/^app\./, '');
	c.header(
		'Set-Cookie',
		`tenantiq_session=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax; Domain=${cookieHost}`,
	);

	return c.json({ verified: true, token, user: { id: user.id, email: user.email, role: user.role } });
});
