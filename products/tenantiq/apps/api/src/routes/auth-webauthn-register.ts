/**
 * WebAuthn registration — creates a new passkey for an authenticated user.
 *
 * Flow:
 *   POST /options  → server issues challenge, frontend calls navigator.credentials.create()
 *   POST /verify   → frontend submits attestation, server verifies and stores credential
 */
import { Hono } from 'hono';
import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	type GenerateRegistrationOptionsOpts,
} from '@simplewebauthn/server';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { WEBAUTHN_RP_NAME, getRpId, getOrigin, CHALLENGE_TTL_SECONDS } from '../lib/webauthn-config';

export const webauthnRegisterRoutes = new Hono<AppEnv>();
webauthnRegisterRoutes.use('*', authMiddleware);

webauthnRegisterRoutes.post('/options', async (c) => {
	const user = c.get('user');
	if (!user?.sub) return c.json({ error: 'unauthorized' }, 401);

	const existing = await c.env.DB.prepare(
		`SELECT credential_id FROM webauthn_credentials WHERE user_id = ?`,
	).bind(user.sub).all<{ credential_id: string }>();

	const userIdBytes = new Uint8Array(new TextEncoder().encode(user.sub));
	const opts: GenerateRegistrationOptionsOpts = {
		rpName: WEBAUTHN_RP_NAME,
		rpID: getRpId(c.env),
		userName: user.email || user.sub,
		userID: userIdBytes,
		attestationType: 'none',
		excludeCredentials: (existing.results ?? []).map((e) => ({ id: e.credential_id })),
		authenticatorSelection: {
			residentKey: 'preferred',
			userVerification: 'preferred',
			authenticatorAttachment: 'platform',
		},
	};
	const options = await generateRegistrationOptions(opts);

	// Cache challenge in KV for verify step.
	await c.env.KV.put(
		`wa-chal:${options.challenge}`,
		JSON.stringify({ userId: user.sub, purpose: 'register' }),
		{ expirationTtl: CHALLENGE_TTL_SECONDS },
	);

	return c.json(options);
});

webauthnRegisterRoutes.post('/verify', async (c) => {
	const user = c.get('user');
	if (!user?.sub) return c.json({ error: 'unauthorized' }, 401);

	const body = await c.req.json<{ response: unknown; deviceName?: string }>().catch(() => null);
	if (!body?.response) return c.json({ error: 'validation_error' }, 400);

	// Extract challenge from clientDataJSON to look up cached challenge.
	const resp = body.response as { response: { clientDataJSON: string } };
	const clientData = JSON.parse(atob(resp.response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/')));
	const expectedChallenge = clientData.challenge;

	const cached = await c.env.KV.get(`wa-chal:${expectedChallenge}`, 'json') as { userId: string; purpose: string } | null;
	if (!cached || cached.userId !== user.sub || cached.purpose !== 'register') {
		return c.json({ error: 'invalid_challenge' }, 400);
	}

	const verification = await verifyRegistrationResponse({
		response: body.response as never,
		expectedChallenge,
		expectedOrigin: getOrigin(c.env),
		expectedRPID: getRpId(c.env),
	});

	if (!verification.verified || !verification.registrationInfo) {
		return c.json({ error: 'verification_failed' }, 400);
	}

	const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
	await c.env.DB.prepare(
		`INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports, device_name, created_at, backed_up, device_type)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).bind(
		credential.id, user.sub, credential.publicKey, credential.counter,
		(credential.transports ?? []).join(','), body.deviceName ?? null,
		Date.now(), credentialBackedUp ? 1 : 0, credentialDeviceType,
	).run();
	await c.env.KV.delete(`wa-chal:${expectedChallenge}`);

	return c.json({ verified: true, credentialId: credential.id });
});
