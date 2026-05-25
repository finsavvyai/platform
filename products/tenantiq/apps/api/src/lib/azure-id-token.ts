/**
 * Verify a Microsoft Entra (Azure AD) id_token against a JWKS.
 *
 * The JWKS resolver is injectable so tests can stub it with a local key.
 * In production it resolves Microsoft's public JWKS per-tenant and caches
 * the resolver in the worker isolate for the process lifetime.
 */

import * as jose from 'jose';

export type JwksResolver = (issuerBase: string) => jose.JWTVerifyGetKey;

const jwksCache = new Map<string, jose.JWTVerifyGetKey>();

export const microsoftJwksResolver: JwksResolver = (issuerBase) => {
	let jwks = jwksCache.get(issuerBase);
	if (!jwks) {
		// JWKS lives at /{tid}/discovery/v2.0/keys — NOT under /v2.0.
		// `issuerBase` is /{tid}/v2.0 (used for the `iss` check); strip the
		// trailing /v2.0 to form the discovery URL Microsoft actually serves.
		const discoveryBase = issuerBase.replace(/\/v2\.0$/, '');
		jwks = jose.createRemoteJWKSet(new URL(`${discoveryBase}/discovery/v2.0/keys`));
		jwksCache.set(issuerBase, jwks);
	}
	return jwks;
};

export interface VerifiedIdToken {
	oid: string;
	email: string;
	name: string;
	tid: string;
}

export interface VerifyOptions {
	/** Override JWKS resolver (for tests). Defaults to Microsoft's public JWKS. */
	jwksResolver?: JwksResolver;
	/** Override allowed signing algorithms (for tests). Defaults to ['RS256']. */
	algorithms?: string[];
	/** Override issuer check (for tests). Defaults to the per-tid Microsoft issuer. */
	expectedIssuer?: string;
}

export async function verifyAzureIdToken(
	idToken: string,
	expectedClientId: string,
	expectedNonce: string | null,
	options: VerifyOptions = {},
): Promise<VerifiedIdToken> {
	const resolve = options.jwksResolver ?? microsoftJwksResolver;

	// Peek at `tid` (tenant id) to pick the correct issuer.
	const preview = jose.decodeJwt(idToken);
	const tid = (preview.tid as string) || 'common';
	const issuerBase = `https://login.microsoftonline.com/${tid}/v2.0`;
	const jwks = resolve(issuerBase);

	const { payload } = await jose.jwtVerify(idToken, jwks, {
		algorithms: options.algorithms ?? ['RS256'],
		issuer: options.expectedIssuer ?? issuerBase,
		audience: expectedClientId,
	});

	if (expectedNonce && payload.nonce !== expectedNonce) {
		throw new Error('id_token nonce mismatch');
	}

	const oid = payload.oid as string | undefined;
	const email = (payload.preferred_username as string | undefined)
		?? (payload.email as string | undefined)
		?? '';
	const name = (payload.name as string | undefined) ?? '';
	if (!oid) throw new Error('id_token missing oid claim');

	return { oid, email, name, tid: (payload.tid as string) ?? tid };
}
