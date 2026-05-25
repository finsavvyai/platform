import { describe, it, expect, vi } from 'vitest';
import { signToken, verifyTokenWithFallback, revokeJti, JWT_ISSUER, JWT_AUDIENCE } from './auth-session';

const env = {
	JWT_SECRET: 'a'.repeat(64), // long enough for HS256 sanity
};

function mockKv() {
	const store = new Map<string, string>();
	return {
		get: vi.fn(async (k: string) => store.get(k) ?? null),
		put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
		delete: vi.fn(async (k: string) => { store.delete(k); }),
		_store: store,
	};
}

describe('signToken / verifyTokenWithFallback', () => {
	it('signs JWT with iss/aud/jti and verifies them by default', async () => {
		const jwt = await signToken(env, { sub: 'user-1' }, '60s');
		const payload = await verifyTokenWithFallback(jwt, env);
		expect(payload.sub).toBe('user-1');
		expect(payload.iss).toBe(JWT_ISSUER);
		expect(payload.aud).toBe(JWT_AUDIENCE);
		expect(typeof payload.jti).toBe('string');
		expect((payload.jti as string).length).toBeGreaterThan(8);
	});

	it('rejects token with wrong audience when iss/aud is enforced', async () => {
		// Mint a token without iss/aud, then try to verify under default rules.
		const jwt = await signToken(env, { sub: 'user-1' }, '60s', { skipIssAud: true });
		await expect(verifyTokenWithFallback(jwt, env)).rejects.toThrow();
	});

	it('honors skipIssAud=true for legacy tokens during rollout', async () => {
		const jwt = await signToken(env, { sub: 'user-1' }, '60s', { skipIssAud: true });
		const payload = await verifyTokenWithFallback(jwt, env, { skipIssAud: true });
		expect(payload.sub).toBe('user-1');
	});

	it('rejects revoked JTI when checkRevocation=true', async () => {
		const kv = mockKv();
		const jwt = await signToken(env, { sub: 'user-1' }, '60s');
		const decoded = await verifyTokenWithFallback(jwt, env);
		expect(decoded.jti).toBeTruthy();

		await revokeJti(kv as unknown as KVNamespace, decoded.jti as string, decoded.exp as number);

		await expect(
			verifyTokenWithFallback(jwt, { ...env, KV: kv as unknown as KVNamespace }, { checkRevocation: true }),
		).rejects.toThrow(/revoked/i);
	});

	it('passes verification when JTI is not in the deny-list', async () => {
		const kv = mockKv();
		const jwt = await signToken(env, { sub: 'user-1' }, '60s');
		const payload = await verifyTokenWithFallback(jwt, { ...env, KV: kv as unknown as KVNamespace }, { checkRevocation: true });
		expect(payload.sub).toBe('user-1');
		expect(kv.get).toHaveBeenCalledTimes(1);
	});
});
