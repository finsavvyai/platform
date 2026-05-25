/** Shared types for CIS scanner + evaluator. */

import type { CisOverrideDecision } from '@tenantiq/shared';

export interface ControlResult {
	controlId: string;
	section: string;
	title: string;
	status: 'pass' | 'fail' | 'partial' | 'error';
	severity: string;
	currentValue: string;
	expectedValue: string;
	remediationHint: string;
	portalUrl?: string;
	remediationGuide?: string;
	autoRemediable: boolean;
	overrideApplied?: {
		decision: CisOverrideDecision;
		justification: string;
		originalStatus: ControlResult['status'];
	};
}

export interface ScanResult {
	overallScore: number;
	passCount: number;
	failCount: number;
	partialCount: number;
	errorCount: number;
	totalControls: number;
	sectionScores: Record<string, { pass: number; fail: number; total: number; score: number }>;
	controls: ControlResult[];
	omittedControls?: ControlResult[];
	scanDurationMs: number;
}

export interface DomainDnsAuth {
	domain: string;
	spf: 'pass' | 'none';
	dmarc: 'pass' | 'none';
	dkim: 'pass' | 'none';
	dmarcPolicy: string;
	dkimPassingCount: number;
}

export interface GraphData {
	conditionalAccessPolicies: any[];
	directoryRoles: any[];
	globalAdminCount: number;
	authorizationPolicy: any;
	securityDefaults: any;
	mfaRegistrationDetails: any[];
	sensitivityLabels: any[];
	sharepointSettings: any;
	/** Latest M365 Secure Score document (controlScores[] for per-control evaluation). */
	secureScore?: any;
	/** /policies/authenticationMethodsPolicy + nested Microsoft Authenticator config. */
	authMethodsPolicy?: any;
	microsoftAuthenticatorConfig?: any;
	/** /admin/sharepoint/settings (Graph beta). */
	sharepointAdminSettings?: any;
	/** /security/dataLossPreventionPolicies (Graph beta). */
	dlpPolicies?: any[];
	/** Result of DoH-based mail auth check across verifiedDomains. */
	dnsAuthByDomain?: DomainDnsAuth[];
	/** /domains for password validity policy. */
	domains?: any[];
	/** /beta/informationProtection/policy/labels — used for default-label + auto-label checks. */
	labelPolicies?: any;
	/** /beta/informationBarrierPolicies. */
	informationBarrierPolicies?: any[];
	/** /beta/security/cases/ediscoveryCases. */
	ediscoveryCases?: any[];
	/** /beta/security/labels/retentionLabels — covers retention_exchange/sharepoint/teams. */
	retentionLabels?: any[];
	/** Result of running federated-identity-auditor — populated when /applications is fetched. */
	federatedIdentityScore?: number; // 0-100
	federatedIdentityFindingCount?: number;
}
