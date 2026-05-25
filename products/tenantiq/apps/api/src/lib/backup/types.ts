/**
 * Backup Data Types
 *
 * Types for Exchange, SharePoint, and Teams data backup jobs.
 */

export type BackupType = 'exchange' | 'sharepoint' | 'teams';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackupJob {
	id: string;
	orgId: string;
	tenantId: string;
	type: BackupType;
	status: BackupStatus;
	itemsCount: number;
	sizeBytes: number;
	startedAt: string | null;
	completedAt: string | null;
	error: string | null;
	createdAt: string;
}

export interface BackupItem {
	id: string;
	jobId: string;
	path: string;
	type: string;
	sizeBytes: number;
	backedUpAt: string;
}

export interface RestoreRequest {
	jobId: string;
	items: string[];
	destination: 'original' | 'alternate';
}

export interface BackupResult {
	itemsCount: number;
	sizeBytes: number;
}

export interface BackupListOptions {
	type?: BackupType;
	status?: BackupStatus;
	limit?: number;
	offset?: number;
}
