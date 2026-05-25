import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import { RULE_IDS } from '@tenantiq/shared';

interface BackupRecord {
	id: string;
	status: 'completed' | 'failed' | 'in_progress';
	completedAt?: string;
	sizeBytes?: number;
	encryptionKeyRotatedAt?: string;
}

function getBackupData(data: TenantData): BackupRecord[] {
	return ((data as unknown as Record<string, unknown>).backups ?? []) as BackupRecord[];
}

const STALE_THRESHOLD_HOURS = 48;
const SIZE_DROP_THRESHOLD = 0.5;
const KEY_ROTATION_DAYS = 90;

const backupStale: Rule = {
	id: RULE_IDS.BKP_001,
	name: 'Backup stale — no backup in 48+ hours',
	severity: 'high',
	category: 'operational',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const backups = getBackupData(data);
		if (backups.length === 0) return [];

		const completed = backups
			.filter((b) => b.status === 'completed' && b.completedAt)
			.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

		if (completed.length === 0) return [];

		const lastBackupTime = new Date(completed[0].completedAt!).getTime();
		const hoursAgo = (Date.now() - lastBackupTime) / (60 * 60 * 1000);

		if (hoursAgo > STALE_THRESHOLD_HOURS) {
			return [{
				ruleId: RULE_IDS.BKP_001,
				title: `No successful backup in ${Math.round(hoursAgo)} hours`,
				description: `Last backup completed ${Math.round(hoursAgo)} hours ago, exceeding the ${STALE_THRESHOLD_HOURS}-hour threshold.`,
				businessImpact: 'Data recovery capability degraded — potential data loss window',
				affectedResources: [{ lastBackupId: completed[0].id, lastBackupAt: completed[0].completedAt }],
				recommendedAction: 'Investigate backup job status and trigger a manual backup immediately.'
			}];
		}
		return [];
	}
};

const backupSizeAnomaly: Rule = {
	id: RULE_IDS.BKP_002,
	name: 'Backup size anomaly — >50% drop detected',
	severity: 'medium',
	category: 'operational',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const backups = getBackupData(data);

		const completed = backups
			.filter((b) => b.status === 'completed' && b.sizeBytes != null)
			.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

		if (completed.length < 2) return [];

		const latest = completed[0].sizeBytes!;
		const previous = completed[1].sizeBytes!;

		if (previous > 0 && latest / previous < SIZE_DROP_THRESHOLD) {
			const dropPercent = Math.round((1 - latest / previous) * 100);
			return [{
				ruleId: RULE_IDS.BKP_002,
				title: `Backup size dropped ${dropPercent}% from previous`,
				description: `Latest backup is ${formatBytes(latest)} vs ${formatBytes(previous)} previously.`,
				businessImpact: 'Possible incomplete backup or data deletion event',
				affectedResources: [{
					latestBackupId: completed[0].id,
					latestSize: latest,
					previousSize: previous,
					dropPercent
				}],
				recommendedAction: 'Verify data integrity and check for accidental deletions or scope changes.'
			}];
		}
		return [];
	}
};

const backupKeyRotation: Rule = {
	id: RULE_IDS.BKP_003,
	name: 'Backup encryption key not rotated in 90+ days',
	severity: 'medium',
	category: 'operational',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const backups = getBackupData(data);
		if (backups.length === 0) return [];

		const withKey = backups.filter((b) => b.encryptionKeyRotatedAt);
		if (withKey.length === 0) return [];

		const latest = withKey
			.sort((a, b) => new Date(b.encryptionKeyRotatedAt!).getTime() - new Date(a.encryptionKeyRotatedAt!).getTime())[0];

		const daysSinceRotation = (Date.now() - new Date(latest.encryptionKeyRotatedAt!).getTime()) / (24 * 60 * 60 * 1000);

		if (daysSinceRotation > KEY_ROTATION_DAYS) {
			return [{
				ruleId: RULE_IDS.BKP_003,
				title: `Encryption key not rotated in ${Math.round(daysSinceRotation)} days`,
				description: `Backup encryption key has not been rotated for over ${KEY_ROTATION_DAYS} days.`,
				businessImpact: 'Stale encryption keys increase risk of key compromise',
				affectedResources: [{ lastRotatedAt: latest.encryptionKeyRotatedAt, daysSinceRotation: Math.round(daysSinceRotation) }],
				recommendedAction: 'Rotate the backup encryption key and update all dependent services.'
			}];
		}
		return [];
	}
};

const backupFailure: Rule = {
	id: RULE_IDS.BKP_004,
	name: 'Last backup failed',
	severity: 'critical',
	category: 'operational',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const backups = getBackupData(data);
		if (backups.length === 0) return [];

		const sorted = backups
			.filter((b) => b.completedAt)
			.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

		if (sorted.length > 0 && sorted[0].status === 'failed') {
			return [{
				ruleId: RULE_IDS.BKP_004,
				title: 'Most recent backup failed',
				description: 'The last backup job completed with a failure status.',
				businessImpact: 'Critical: no current backup available for disaster recovery',
				affectedResources: [{ backupId: sorted[0].id, completedAt: sorted[0].completedAt }],
				recommendedAction: 'Investigate the failure cause and re-trigger the backup immediately.'
			}];
		}
		return [];
	}
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
	return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export const backupHealthRules: Rule[] = [
	backupStale,
	backupSizeAnomaly,
	backupKeyRotation,
	backupFailure
];
