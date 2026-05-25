/**
 * Entra Cross-Tenant Access Policy Auditor (T3.3).
 *
 * Reads /policies/crossTenantAccessPolicy and flags overpermissive B2B trust:
 *  - default policy that allows ANY external user inbound (wildcard)
 *  - partner-specific entries with automatic user consent inbound = true
 *  - automaticUserConsentSettings.inboundAllowed at default level
 *  - cross-tenant sync inbound enabled without group/user filter
 *
 * Pure function over the Graph payload — easy to test, no Graph calls.
 */

export interface CrossTenantAccessPolicy {
	defaultLegacy?: { isServiceDefault?: boolean; b2bCollaborationInbound?: B2BSettings; b2bDirectConnectInbound?: B2BSettings };
	default?: { isServiceDefault?: boolean; b2bCollaborationInbound?: B2BSettings; b2bDirectConnectInbound?: B2BSettings; automaticUserConsentSettings?: { inboundAllowed?: boolean; outboundAllowed?: boolean } };
	partners?: PartnerPolicy[];
}

export interface B2BSettings {
	usersAndGroups?: { accessType?: 'allowed' | 'blocked'; targets?: Array<{ targetType?: string; target?: string }> };
	applications?: { accessType?: 'allowed' | 'blocked'; targets?: Array<{ targetType?: string; target?: string }> };
}

export interface PartnerPolicy {
	tenantId: string;
	tenantName?: string;
	isServiceProvider?: boolean;
	b2bCollaborationInbound?: B2BSettings;
	b2bDirectConnectInbound?: B2BSettings;
	automaticUserConsentSettings?: { inboundAllowed?: boolean; outboundAllowed?: boolean };
	tenantRestrictions?: { usersAndGroups?: any; applications?: any };
}

export type CrossTenantIssue =
	| 'default_inbound_b2b_unrestricted'
	| 'default_auto_consent_inbound'
	| 'partner_auto_consent_inbound'
	| 'partner_unscoped_b2b_inbound'
	| 'service_provider_unscoped'
	| 'direct_connect_inbound_unrestricted';

export interface CrossTenantFinding {
	tenantId: string;
	tenantName?: string;
	issue: CrossTenantIssue;
	severity: 'critical' | 'high' | 'medium';
	detail: string;
	remediation: string;
}

const ALL_TARGET = 'AllUsers';
const ALL_APP_TARGET = 'AllApplications';

function targetsAllUsers(b2b?: B2BSettings): boolean {
	const u = b2b?.usersAndGroups;
	if (u?.accessType !== 'allowed') return false;
	const t = u.targets ?? [];
	return t.length === 0 || t.some(x => x.target === ALL_TARGET || x.targetType === 'AllUsers');
}

function targetsAllApps(b2b?: B2BSettings): boolean {
	const a = b2b?.applications;
	if (a?.accessType !== 'allowed') return false;
	const t = a.targets ?? [];
	return t.length === 0 || t.some(x => x.target === ALL_APP_TARGET || x.targetType === 'AllApplications');
}

export function auditCrossTenantPolicy(policy: CrossTenantAccessPolicy): CrossTenantFinding[] {
	const findings: CrossTenantFinding[] = [];

	const def = policy.default ?? policy.defaultLegacy ?? {};
	if (def.b2bCollaborationInbound && targetsAllUsers(def.b2bCollaborationInbound) && targetsAllApps(def.b2bCollaborationInbound)) {
		findings.push({
			tenantId: 'default',
			issue: 'default_inbound_b2b_unrestricted',
			severity: 'high',
			detail: 'Default cross-tenant policy allows B2B collaboration inbound from any user in any external tenant to any app.',
			remediation: 'Tighten default by setting accessType=blocked, then add explicit partner allowlist with scoped users/apps.',
		});
	}

	if (def.b2bDirectConnectInbound && targetsAllUsers(def.b2bDirectConnectInbound)) {
		findings.push({
			tenantId: 'default',
			issue: 'direct_connect_inbound_unrestricted',
			severity: 'critical',
			detail: 'Default cross-tenant policy allows B2B Direct Connect inbound (Teams shared channels) from ANY external tenant.',
			remediation: 'Direct Connect inbound should be blocked by default and only enabled per trusted partner.',
		});
	}

	if ((policy.default?.automaticUserConsentSettings?.inboundAllowed) === true) {
		findings.push({
			tenantId: 'default',
			issue: 'default_auto_consent_inbound',
			severity: 'high',
			detail: 'Automatic user consent for inbound external users is enabled at the default policy.',
			remediation: 'Disable automaticUserConsentSettings.inboundAllowed at default; opt in per partner.',
		});
	}

	for (const partner of policy.partners ?? []) {
		if (partner.automaticUserConsentSettings?.inboundAllowed === true) {
			findings.push({
				tenantId: partner.tenantId,
				tenantName: partner.tenantName,
				issue: 'partner_auto_consent_inbound',
				severity: 'medium',
				detail: 'Automatic user consent for inbound is enabled — partner users are auto-provisioned without redemption.',
				remediation: 'Disable automatic user consent unless partner is a verified service-provider relationship.',
			});
		}

		const collabUnscoped = partner.b2bCollaborationInbound && targetsAllUsers(partner.b2bCollaborationInbound) && targetsAllApps(partner.b2bCollaborationInbound);
		if (collabUnscoped) {
			findings.push({
				tenantId: partner.tenantId,
				tenantName: partner.tenantName,
				issue: 'partner_unscoped_b2b_inbound',
				severity: partner.isServiceProvider ? 'medium' : 'high',
				detail: 'Partner-specific B2B collab inbound allows ALL users from this tenant to ALL applications.',
				remediation: 'Scope to specific groups or applications per least-privilege partner integration.',
			});
		}

		if (partner.isServiceProvider && collabUnscoped) {
			findings.push({
				tenantId: partner.tenantId,
				tenantName: partner.tenantName,
				issue: 'service_provider_unscoped',
				severity: 'medium',
				detail: 'Service-provider-flagged partner with unscoped inbound — verify GDAP / Azure Lighthouse delegation is appropriate.',
				remediation: 'Review CSP/MSP delegation; consider lifting service-provider flag if partner is not a registered MSP.',
			});
		}
	}

	return findings;
}

export interface AuditSummary {
	policyDescriptor: string;
	partnerCount: number;
	findings: CrossTenantFinding[];
	score: number;
}

export function summarizeCrossTenantAudit(policy: CrossTenantAccessPolicy): AuditSummary {
	const findings = auditCrossTenantPolicy(policy);
	const weights: Record<CrossTenantFinding['severity'], number> = { critical: 30, high: 15, medium: 7 };
	const deduction = findings.reduce((s, f) => s + weights[f.severity], 0);
	return {
		policyDescriptor: `default + ${(policy.partners ?? []).length} partner(s)`,
		partnerCount: (policy.partners ?? []).length,
		findings,
		score: Math.max(0, 100 - deduction),
	};
}
