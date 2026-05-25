/**
 * Compliance Posture — Control Definitions
 *
 * CIS Microsoft 365 Benchmark control templates
 * and tenant metrics interface for evaluation.
 */

import type { ComplianceControl } from './compliance-posture.types';

// ── Control Template ──────────────────────────────────────────────

export interface ControlTemplate {
	controlNumber: string;
	title: string;
	category: string;
	severity: ComplianceControl['severity'];
	automatable: boolean;
	checkFn: (m: ComplianceTenantMetrics) => {
		status: ComplianceControl['status'];
		evidence: string[];
	};
}

export interface ComplianceTenantMetrics {
	mfaEnabled: boolean;
	mfaAdoptionRate: number;
	conditionalAccessPolicies: number;
	dlpPoliciesEnabled: boolean;
	retentionPoliciesEnabled: boolean;
	sensitivityLabelsEnabled: boolean;
	auditLogRetentionDays: number;
	secureScore: number;
	adminCount: number;
	totalUsers: number;
	guestAccessRestricted: boolean;
	passwordPolicyStrength: 'weak' | 'moderate' | 'strong';
	encryptionAtRest: boolean;
	encryptionInTransit: boolean;
	breakGlassAccountExists: boolean;
	privilegedAccessReviewEnabled: boolean;
	deviceComplianceEnabled: boolean;
	appProtectionEnabled: boolean;
}

// ── CIS Microsoft 365 Benchmark v3.0 Controls ────────────────────

export const CIS_CONTROLS: ControlTemplate[] = [
	{
		controlNumber: 'CIS-1.1',
		title: 'Ensure MFA is enabled for all users',
		category: 'Identity & Access',
		severity: 'critical',
		automatable: true,
		checkFn: (m) => ({
			status: m.mfaAdoptionRate >= 95 ? 'passed' : m.mfaAdoptionRate >= 80 ? 'partial' : 'failed',
			evidence: [`MFA adoption: ${m.mfaAdoptionRate}%`],
		}),
	},
	{
		controlNumber: 'CIS-1.2',
		title: 'Ensure Conditional Access policies are configured',
		category: 'Identity & Access',
		severity: 'high',
		automatable: false,
		checkFn: (m) => ({
			status: m.conditionalAccessPolicies >= 3 ? 'passed' : m.conditionalAccessPolicies >= 1 ? 'partial' : 'failed',
			evidence: [`${m.conditionalAccessPolicies} CA policies configured`],
		}),
	},
	{
		controlNumber: 'CIS-1.3',
		title: 'Limit the number of global administrators',
		category: 'Identity & Access',
		severity: 'high',
		automatable: false,
		checkFn: (m) => ({
			status: m.adminCount <= 4 ? 'passed' : m.adminCount <= 8 ? 'partial' : 'failed',
			evidence: [`${m.adminCount} admin accounts (recommended ≤4)`],
		}),
	},
	{
		controlNumber: 'CIS-2.1',
		title: 'Ensure DLP policies are enabled',
		category: 'Data Protection',
		severity: 'high',
		automatable: false,
		checkFn: (m) => ({
			status: m.dlpPoliciesEnabled ? 'passed' : 'failed',
			evidence: [m.dlpPoliciesEnabled ? 'DLP policies active' : 'No DLP policies configured'],
		}),
	},
	{
		controlNumber: 'CIS-2.2',
		title: 'Ensure sensitivity labels are configured',
		category: 'Data Protection',
		severity: 'medium',
		automatable: false,
		checkFn: (m) => ({
			status: m.sensitivityLabelsEnabled ? 'passed' : 'failed',
			evidence: [m.sensitivityLabelsEnabled ? 'Sensitivity labels active' : 'Sensitivity labels not configured'],
		}),
	},
	{
		controlNumber: 'CIS-3.1',
		title: 'Ensure audit log retention meets requirements',
		category: 'Audit & Logging',
		severity: 'medium',
		automatable: false,
		checkFn: (m) => ({
			status: m.auditLogRetentionDays >= 365 ? 'passed' : m.auditLogRetentionDays >= 90 ? 'partial' : 'failed',
			evidence: [`Audit log retention: ${m.auditLogRetentionDays} days`],
		}),
	},
	{
		controlNumber: 'CIS-4.1',
		title: 'Ensure device compliance policies are enabled',
		category: 'Device Management',
		severity: 'medium',
		automatable: false,
		checkFn: (m) => ({
			status: m.deviceComplianceEnabled ? 'passed' : 'failed',
			evidence: [m.deviceComplianceEnabled ? 'Device compliance active' : 'Device compliance not configured'],
		}),
	},
	{
		controlNumber: 'CIS-5.1',
		title: 'Ensure break-glass emergency access account exists',
		category: 'Identity & Access',
		severity: 'critical',
		automatable: false,
		checkFn: (m) => ({
			status: m.breakGlassAccountExists ? 'passed' : 'failed',
			evidence: [m.breakGlassAccountExists ? 'Break-glass account configured' : 'No break-glass account found'],
		}),
	},
];
