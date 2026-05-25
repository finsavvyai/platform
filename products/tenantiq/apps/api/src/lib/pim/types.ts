/** Shared types for PIM (Privileged Identity Management) audit. */
import type { PimRoleAssignment, PimRoleDefinition } from '@tenantiq/graph';

export type PimFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface PimFinding {
	id: string;
	severity: PimFindingSeverity;
	category: 'standing-access' | 'expiration' | 'mfa' | 'activation' | 'over-privileged';
	title: string;
	detail: string;
	remediation: string;
	affectedCount: number;
	principals?: string[]; // UPN or display name list
	roles?: string[];
}

export interface PimRolePrincipal {
	principalId: string;
	principalUpn: string | null;
	principalDisplayName: string | null;
	principalType: 'user' | 'group' | 'servicePrincipal' | 'unknown';
	roleDisplayName: string;
	roleDefinitionId: string;
	kind: 'standing' | 'eligible' | 'active';
	endDateTime: string | null; // null = perpetual
	mfaRegistered?: boolean | null; // optional, fed in from /reports/credentialUserRegistrationDetails
}

export interface PimSummary {
	totalAssignments: number;
	standingCount: number;
	eligibleCount: number;
	activeCount: number;
	privilegedRolePrincipals: number;
	standingPrivileged: number; // standing ON privileged roles — main risk metric
	perpetualAssignments: number;
	mfaGapCount: number; // privileged principals without MFA
	postureScore: number; // 0..100
}

export interface PimScanResult {
	scannedAt: string;
	summary: PimSummary;
	findings: PimFinding[];
	principals: PimRolePrincipal[];
}

export type PimDefinitionMap = Map<string, PimRoleDefinition>;

export type PimMfaLookup = (principalId: string) => boolean | null;

export type PimInputAssignments = PimRoleAssignment[];
