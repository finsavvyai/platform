/**
 * Tenant Backup Operations
 *
 * CRUD operations for M365 tenant backups stored in Cloudflare R2
 * with AES-256-GCM encryption.
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import type { BackupMetadata, TenantBackupData } from './tenant-types';
import { getTenantBackupKey, encryptBackup, decryptBackup } from './encryption';

/**
 * Create a full backup of M365 tenant data
 */
export async function createTenantBackup(
	r2: R2Bucket,
	kv: KVNamespace,
	data: TenantBackupData
): Promise<BackupMetadata> {
	const backupId = crypto.randomUUID();
	const tenantId = data.metadata.tenantId;

	// Get or generate encryption key
	const key = await getTenantBackupKey(kv, tenantId);

	// Encrypt backup
	const { encrypted, iv, checksum } = await encryptBackup(data, key);

	// Store encrypted backup in R2
	const objectKey = `backups/${tenantId}/${backupId}.encrypted`;
	await r2.put(objectKey, encrypted, {
		customMetadata: {
			iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
			checksum,
			tenantId,
			timestamp: new Date().toISOString(),
		},
	});

	// Create metadata
	const metadata: BackupMetadata = {
		backupId,
		tenantId,
		timestamp: new Date().toISOString(),
		type: 'full',
		encryptionAlgorithm: 'AES-256-GCM',
		size: encrypted.byteLength,
		checksumSHA256: checksum,
		items: {
			users: data.users.length,
			groups: data.groups?.length || 0,
			licenses: data.licenses.length,
			conditionalAccessPolicies: data.securityConfig?.conditionalAccessPolicies?.length || 0,
			alerts: data.alerts?.length || 0,
		},
	};

	// Store metadata in KV for fast querying
	await kv.put(`backup-metadata:${backupId}`, JSON.stringify(metadata), {
		expirationTtl: 365 * 24 * 60 * 60, // 1 year retention
	});

	// Update latest backup pointer
	await kv.put(`backup-latest:${tenantId}`, backupId);

	return metadata;
}

/**
 * Restore tenant data from backup
 */
export async function restoreTenantBackup(
	r2: R2Bucket,
	kv: KVNamespace,
	backupId: string,
	tenantId: string
): Promise<TenantBackupData> {
	// Get encryption key
	const key = await getTenantBackupKey(kv, tenantId);

	// Fetch encrypted backup from R2
	const objectKey = `backups/${tenantId}/${backupId}.encrypted`;
	const object = await r2.get(objectKey);

	if (!object) {
		throw new Error(`Backup ${backupId} not found`);
	}

	const encrypted = await object.arrayBuffer();
	const ivHex = object.customMetadata?.iv;
	const storedChecksum = object.customMetadata?.checksum;

	if (!ivHex || !storedChecksum) {
		throw new Error('Backup metadata incomplete');
	}

	// Verify checksum
	const actualChecksum = await crypto.subtle.digest('SHA-256', encrypted);
	const actualChecksumHex = Array.from(new Uint8Array(actualChecksum))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');

	if (actualChecksumHex !== storedChecksum) {
		throw new Error('Backup integrity check failed - checksum mismatch');
	}

	// Convert IV from hex string back to Uint8Array
	const iv = new Uint8Array(
		(ivHex.match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
	);

	// Decrypt
	return await decryptBackup(encrypted, iv, key);
}

/**
 * List all backups for a tenant
 */
export async function listTenantBackups(
	r2: R2Bucket,
	tenantId: string
): Promise<BackupMetadata[]> {
	const prefix = `backups/${tenantId}/`;
	const listed = await r2.list({ prefix });

	return listed.objects.map(obj => ({
		backupId: obj.key.split('/').pop()?.replace('.encrypted', '') || '',
		tenantId,
		timestamp: obj.uploaded.toISOString(),
		type: 'full' as const,
		encryptionAlgorithm: 'AES-256-GCM' as const,
		size: obj.size,
		checksumSHA256: obj.customMetadata?.checksum || '',
		items: {},
	}));
}

/**
 * Delete old backups (retention policy)
 */
export async function cleanupOldBackups(
	r2: R2Bucket,
	kv: KVNamespace,
	tenantId: string,
	retentionDays = 90
): Promise<number> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

	const backups = await listTenantBackups(r2, tenantId);
	let deleted = 0;

	for (const backup of backups) {
		const backupDate = new Date(backup.timestamp);
		if (backupDate < cutoffDate) {
			await r2.delete(`backups/${tenantId}/${backup.backupId}.encrypted`);
			await kv.delete(`backup-metadata:${backup.backupId}`);
			deleted++;
		}
	}

	return deleted;
}
