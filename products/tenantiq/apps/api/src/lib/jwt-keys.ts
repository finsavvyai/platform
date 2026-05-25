import * as jose from 'jose';

// Cache keyed by PEM / secret content so a rotated key never returns a
// stale handle. Isolate-level identity — cleared when the worker recycles.
const privateKeys = new Map<string, jose.KeyLike>();
const publicKeys = new Map<string, jose.KeyLike>();
const hs256Secrets = new Map<string, Uint8Array>();

export async function getRS256PrivateKey(pem: string): Promise<jose.KeyLike> {
	const hit = privateKeys.get(pem);
	if (hit) return hit;
	const key = await jose.importPKCS8(pem, 'RS256');
	privateKeys.set(pem, key);
	return key;
}

export async function getRS256PublicKey(pem: string): Promise<jose.KeyLike> {
	const hit = publicKeys.get(pem);
	if (hit) return hit;
	// `extractable: true` so `exportJWK` works for the JWKS endpoint.
	const key = await jose.importSPKI(pem, 'RS256', { extractable: true });
	publicKeys.set(pem, key);
	return key;
}

export function getHS256Secret(secret: string): Uint8Array {
	const hit = hs256Secrets.get(secret);
	if (hit) return hit;
	const encoded = new TextEncoder().encode(secret);
	hs256Secrets.set(secret, encoded);
	return encoded;
}

export function isRS256Configured(env: { RS256_PRIVATE_KEY?: string; RS256_PUBLIC_KEY?: string }): boolean {
	return Boolean(env.RS256_PRIVATE_KEY && env.RS256_PUBLIC_KEY);
}

export async function exportPublicKeyAsJWKS(pem: string): Promise<jose.JSONWebKeySet> {
	const key = await getRS256PublicKey(pem) as CryptoKey;
	const jwk = await jose.exportJWK(key);
	jwk.kid = 'tenantiq-rs256-1';
	jwk.alg = 'RS256';
	jwk.use = 'sig';
	return { keys: [jwk] };
}

export function clearKeyCache(): void {
	privateKeys.clear();
	publicKeys.clear();
	hs256Secrets.clear();
}
