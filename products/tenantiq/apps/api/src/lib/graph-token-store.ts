/**
 * Encrypted storage for Microsoft Graph refresh tokens.
 *
 * Wraps plaintext refresh tokens with AES-256-GCM keyed by
 * `env.GRAPH_TOKEN_KEK` (32-byte hex). Falls back to plaintext
 * read/write if the KEK is unset — log a warning so it can be
 * rotated in.
 */

const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function hexToBytes(hex: string): Uint8Array {
	const clean = hex.trim();
	if (clean.length % 2 !== 0) throw new Error('GRAPH_TOKEN_KEK must be hex-encoded');
	const out = new Uint8Array(clean.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

function toB64(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}

function fromB64(b64: string): Uint8Array {
	const s = atob(b64);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}

async function loadKek(kek: string | undefined): Promise<CryptoKey | null> {
	if (!kek) return null;
	const raw = hexToBytes(kek);
	if (raw.byteLength !== 32) {
		throw new Error('GRAPH_TOKEN_KEK must be 32 bytes (64 hex chars)');
	}
	return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
		'encrypt',
		'decrypt',
	]);
}

export async function putRefreshToken(
	env: { KV: KVNamespace; GRAPH_TOKEN_KEK?: string },
	azureTenantId: string,
	refreshToken: string,
): Promise<void> {
	const key = await loadKek(env.GRAPH_TOKEN_KEK);
	const kvKey = `graph:${azureTenantId}:refresh_token`;
	if (!key) {
		console.warn('[graph-token-store] GRAPH_TOKEN_KEK unset — writing refresh token unencrypted');
		await env.KV.put(kvKey, refreshToken, { expirationTtl: REFRESH_TTL_SECONDS });
		return;
	}
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: encoder.encode(azureTenantId) },
		key,
		encoder.encode(refreshToken),
	);
	const envelope = JSON.stringify({
		v: 1,
		iv: toB64(iv),
		ct: toB64(new Uint8Array(ciphertext)),
	});
	await env.KV.put(kvKey, envelope, { expirationTtl: REFRESH_TTL_SECONDS });
}

export async function getRefreshToken(
	env: { KV: KVNamespace; GRAPH_TOKEN_KEK?: string },
	azureTenantId: string,
): Promise<string | null> {
	const kvKey = `graph:${azureTenantId}:refresh_token`;
	const raw = await env.KV.get(kvKey);
	if (!raw) return null;

	// Legacy plaintext values stay readable for a grace period during rotation.
	if (!raw.startsWith('{')) return raw;

	const key = await loadKek(env.GRAPH_TOKEN_KEK);
	if (!key) {
		console.warn('[graph-token-store] GRAPH_TOKEN_KEK unset — cannot decrypt refresh token');
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as { v: number; iv: string; ct: string };
		if (parsed.v !== 1) return null;
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: fromB64(parsed.iv), additionalData: encoder.encode(azureTenantId) },
			key,
			fromB64(parsed.ct),
		);
		return decoder.decode(plaintext);
	} catch (err) {
		console.error('[graph-token-store] decrypt failed:', err);
		return null;
	}
}
