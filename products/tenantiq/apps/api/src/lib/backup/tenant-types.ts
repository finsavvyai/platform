/**
 * Tenant Backup Types
 *
 * Interfaces for M365 tenant backup metadata and data structures.
 */

export interface BackupMetadata {
	backupId: string;
	tenantId: string;
	timestamp: string;
	type: 'full' | 'incremental';
	encryptionAlgorithm: 'AES-256-GCM';
	size: number;
	checksumSHA256: string;
	items: {
		users?: number;
		groups?: number;
		licenses?: number;
		conditionalAccessPolicies?: number;
		alerts?: number;
		auditLogs?: number;
	};
}

export interface TenantBackupData {
	metadata: {
		tenantId: string;
		azureTenantId: string;
		displayName: string;
		domain: string;
		backupDate: string;
	};
	users: Array<{
		id: string;
		userPrincipalName: string;
		displayName: string;
		mail?: string;
		jobTitle?: string;
		department?: string;
		accountEnabled: boolean;
		createdDateTime?: string;
		signInActivity?: {
			lastSignInDateTime?: string;
			lastNonInteractiveSignInDateTime?: string;
		};
		assignedLicenses: Array<{ skuId: string }>;
	}>;
	groups?: Array<{
		id: string;
		displayName: string;
		mail?: string;
		groupTypes: string[];
	}>;
	licenses: Array<{
		skuId: string;
		skuPartNumber: string;
		consumedUnits: number;
		prepaidUnits: {
			enabled: number;
			suspended: number;
			warning: number;
		};
	}>;
	securityConfig?: {
		conditionalAccessPolicies?: unknown[];
		secureScore?: number;
		secureScoreControls?: unknown[];
	};
	alerts?: Array<{
		id: string;
		severity: string;
		title: string;
		status: string;
		createdDateTime: string;
	}>;
}
