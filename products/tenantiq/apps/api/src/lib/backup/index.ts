/**
 * M365 Tenant Backup Service — barrel re-exports
 *
 * Public API for tenant backup operations including encrypted R2 storage,
 * point-in-time restore, and retention policy cleanup.
 */

export type { BackupMetadata, TenantBackupData } from './tenant-types';
export {
	createTenantBackup,
	restoreTenantBackup,
	listTenantBackups,
	cleanupOldBackups,
} from './tenant-operations';
