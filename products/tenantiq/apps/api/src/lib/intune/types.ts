/** Shared types for Intune scanner. */
import type { IntuneOs, IntuneManagedDevice } from '@tenantiq/graph';

export type IntuneFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface IntuneFinding {
	id: string;
	severity: IntuneFindingSeverity;
	category: 'device' | 'compliance-policy' | 'app-protection';
	title: string;
	detail: string;
	remediation: string;
	affectedCount: number;
	deviceIds?: string[];
}

export interface IntuneSummary {
	totalDevices: number;
	compliantDevices: number;
	noncompliantDevices: number;
	gracePeriodDevices: number;
	encryptionRate: number;
	jailbrokenCount: number;
	staleEnrollmentCount: number;
	osBreakdown: Record<IntuneOs, number>;
	compliancePolicyCount: number;
	unassignedCompliancePolicyCount: number;
	appProtectionPolicyCount: number;
	platformsWithoutMam: ('iOS' | 'Android')[];
	postureScore: number;
}

export interface IntuneScanResult {
	scannedAt: string;
	summary: IntuneSummary;
	findings: IntuneFinding[];
	devices: IntuneManagedDevice[];
}
