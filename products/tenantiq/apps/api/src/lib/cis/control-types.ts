/**
 * CIS Microsoft 365 Foundations Benchmark — shared types.
 */

export interface CisControl {
	id: string;
	section: string;
	title: string;
	description: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	/**
	 * CIS implementation level per CIS Microsoft 365 Foundations Benchmark v3.1.
	 * - L1: baseline hardening, minimal operational impact, applicable to all environments.
	 * - L2: defence-in-depth, requires premium licensing (Entra P2, Defender for Office,
	 *   Defender for Cloud Apps, MDCA, EMS E5) or significant operational maturity.
	 *
	 * Values populated 2026-05-03 from public CIS M365 v3.1 designations. Re-verify
	 * against the official benchmark spreadsheet before publishing audit-grade claims.
	 */
	level: 'L1' | 'L2';
	graphCheck: string;
	expectedValue: string;
	remediationHint: string;
	portalUrl?: string;
	remediationGuide?: string;
	autoRemediable: boolean;
	// Optional compliance-framework mapping. Populated incrementally per
	// .luna/tenantiq/leverage/ScubaGear/integration-plan.md (Phase 6).
	// `nist`: NIST SP 800-53 control IDs (e.g., 'AC-2', 'IA-5').
	// `attack`: MITRE ATT&CK technique IDs (e.g., 'T1078', 'T1110.001').
	frameworks?: {
		nist?: string[];
		attack?: string[];
	};
}

export const CIS_PORTAL_URLS = {
	PORTAL: 'https://portal.azure.com/#view/Microsoft_AAD_ConditionalAccess',
	ENTRA: 'https://portal.azure.com/#view/Microsoft_AAD_IAM',
	COMPLIANCE: 'https://compliance.microsoft.com',
	DEFENDER: 'https://security.microsoft.com',
} as const;
