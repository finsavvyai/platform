/**
 * Backup Encryption
 *
 * AES-256-GCM encryption/decryption for tenant backup data.
 * Keys are stored in KV with per-tenant isolation.
 */

import type { TenantBackupData } from './tenant-types';

/**
 * Generate a cryptographically secure backup encryption key.
 * In production, this should be stored in KV with proper ACLs.
 */
async function generateBackupKey(): Promise<CryptoKey> {
	const generatedKey = await crypto.subtle.generateKey(
		{ name: 'AES-GCM', length: 256 },
		true, // extractable
		['encrypt', 'decrypt']
	);

	// AES-GCM with encrypt/decrypt returns a single CryptoKey (not a key pair).
	if ('privateKey' in generatedKey || 'publicKey' in generatedKey) {
		throw new Error('Unexpected key pair returned for AES-GCM key generation');
	}

	return generatedKey;
}

/**
 * Get or create encryption key for a tenant.
 * Keys are stored in KV for persistence across backups.
 */
export async function getTenantBackupKey(kv: KVNamespace, tenantId: string): Promise<CryptoKey> {
	const storedKey = await kv.get(`backup-key:${tenantId}`, 'arrayBuffer');

	if (storedKey) {
		return await crypto.subtle.importKey(
			'raw',
			storedKey,
			{ name: 'AES-GCM', length: 256 },
			true,
			['encrypt', 'decrypt']
		);
	}

	// Generate new key
	const newKey = await generateBackupKey();
	const exported = await crypto.subtle.exportKey('raw', newKey);
	if (!(exported instanceof ArrayBuffer)) {
		throw new Error('Expected raw backup key export to be an ArrayBuffer');
	}
	await kv.put(`backup-key:${tenantId}`, exported);

	return newKey;
}

/**
 * Encrypt backup data using AES-256-GCM
 */
export async function encryptBackup(
	data: TenantBackupData,
	key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array; checksum: string }> {
	const encoder = new TextEncoder();
	const plaintext = encoder.encode(JSON.stringify(data));

	// Generate random IV (12 bytes for GCM)
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Encrypt
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		plaintext
	);

	// Compute checksum for integrity verification
	const checksum = await crypto.subtle.digest('SHA-256', encrypted);
	const checksumHex = Array.from(new Uint8Array(checksum))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');

	return { encrypted, iv, checksum: checksumHex };
}

/**
 * Decrypt backup data
 */
export async function decryptBackup(
	encrypted: ArrayBuffer,
	iv: Uint8Array,
	key: CryptoKey
): Promise<TenantBackupData> {
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		key,
		encrypted
	);

	const decoder = new TextDecoder();
	const json = decoder.decode(decrypted);
	return JSON.parse(json);
}
