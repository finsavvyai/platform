/**
 * Tests for CIS scanner evaluators wired to Graph data.
 * Covers the 10 new evaluators added in Sprint 2 (T2.1).
 */
import { describe, it, expect } from 'vitest';
import { evaluateControl } from './scanner-evaluator';
import type { CisControl } from './control-types';
import type { GraphData } from './scanner-types';

const baseData: GraphData = {
	conditionalAccessPolicies: [],
	directoryRoles: [],
	globalAdminCount: 0,
	authorizationPolicy: {},
	securityDefaults: {},
	mfaRegistrationDetails: [],
	sensitivityLabels: [],
	sharepointSettings: null,
};

const baseControl = (graphCheck: string): CisControl => ({
	id: 'test', section: 'Identity', title: 'test', description: 'test',
	severity: 'high', level: 'L1', graphCheck, expectedValue: 'x',
	remediationHint: 'x', autoRemediable: false,
});

describe('mfa_number_matching', () => {
	it('passes when state is enabled', () => {
		const r = evaluateControl(baseControl('mfa_number_matching'), {
			...baseData,
			microsoftAuthenticatorConfig: { featureSettings: { numberMatchingRequiredState: { state: 'enabled' } } },
		});
		expect(r.status).toBe('pass');
	});
	it('fails when state is disabled', () => {
		const r = evaluateControl(baseControl('mfa_number_matching'), {
			...baseData,
			microsoftAuthenticatorConfig: { featureSettings: { numberMatchingRequiredState: { state: 'disabled' } } },
		});
		expect(r.status).toBe('fail');
	});
	it('partial when policy unavailable', () => {
		const r = evaluateControl(baseControl('mfa_number_matching'), baseData);
		expect(r.status).toBe('partial');
	});
});

describe('sspr_enabled', () => {
	it('passes when 2+ non-password methods enabled', () => {
		const r = evaluateControl(baseControl('sspr_enabled'), {
			...baseData,
			authMethodsPolicy: { authenticationMethodConfigurations: [
				{ id: 'password', state: 'enabled' },
				{ id: 'microsoftAuthenticator', state: 'enabled' },
				{ id: 'fido2', state: 'enabled' },
			] },
		});
		expect(r.status).toBe('pass');
	});
	it('partial when only 1 non-password method', () => {
		const r = evaluateControl(baseControl('sspr_enabled'), {
			...baseData,
			authMethodsPolicy: { authenticationMethodConfigurations: [
				{ id: 'password', state: 'enabled' },
				{ id: 'microsoftAuthenticator', state: 'enabled' },
			] },
		});
		expect(r.status).toBe('partial');
	});
	it('fails when no non-password methods', () => {
		const r = evaluateControl(baseControl('sspr_enabled'), {
			...baseData,
			authMethodsPolicy: { authenticationMethodConfigurations: [{ id: 'password', state: 'enabled' }] },
		});
		expect(r.status).toBe('fail');
	});
});

describe('sharepoint_sharing', () => {
	it('passes for existingExternalUserSharingOnly', () => {
		const r = evaluateControl(baseControl('sharepoint_sharing'), {
			...baseData,
			sharepointAdminSettings: { sharingCapability: 'existingExternalUserSharingOnly' },
		});
		expect(r.status).toBe('pass');
	});
	it('passes for disabled', () => {
		const r = evaluateControl(baseControl('sharepoint_sharing'), {
			...baseData,
			sharepointAdminSettings: { sharingCapability: 'disabled' },
		});
		expect(r.status).toBe('pass');
	});
	it('fails for externalUserAndGuestSharing', () => {
		const r = evaluateControl(baseControl('sharepoint_sharing'), {
			...baseData,
			sharepointAdminSettings: { sharingCapability: 'externalUserAndGuestSharing' },
		});
		expect(r.status).toBe('fail');
	});
	it('partial when settings unavailable', () => {
		const r = evaluateControl(baseControl('sharepoint_sharing'), baseData);
		expect(r.status).toBe('partial');
	});
});

describe('onedrive_sharing_org_only', () => {
	it('passes when oneDriveSharingCapability is existingExternalUserSharingOnly', () => {
		const r = evaluateControl(baseControl('onedrive_sharing_org_only'), {
			...baseData,
			sharepointAdminSettings: { oneDriveSharingCapability: 'existingExternalUserSharingOnly' },
		});
		expect(r.status).toBe('pass');
	});
	it('fails when oneDriveSharingCapability allows external', () => {
		const r = evaluateControl(baseControl('onedrive_sharing_org_only'), {
			...baseData,
			sharepointAdminSettings: { oneDriveSharingCapability: 'externalUserAndGuestSharing' },
		});
		expect(r.status).toBe('fail');
	});
});

describe('anonymous_links_disabled', () => {
	it('fails when default link is anonymousAccess', () => {
		const r = evaluateControl(baseControl('anonymous_links_disabled'), {
			...baseData,
			sharepointAdminSettings: { defaultSharingLinkType: 'anonymousAccess' },
		});
		expect(r.status).toBe('fail');
	});
	it('passes when default link is internal', () => {
		const r = evaluateControl(baseControl('anonymous_links_disabled'), {
			...baseData,
			sharepointAdminSettings: { defaultSharingLinkType: 'internal' },
		});
		expect(r.status).toBe('pass');
	});
});

describe('sharing_link_default_org', () => {
	it('passes for internal', () => {
		const r = evaluateControl(baseControl('sharing_link_default_org'), {
			...baseData,
			sharepointAdminSettings: { defaultSharingLinkType: 'internal' },
		});
		expect(r.status).toBe('pass');
	});
	it('fails for organization-anonymous', () => {
		const r = evaluateControl(baseControl('sharing_link_default_org'), {
			...baseData,
			sharepointAdminSettings: { defaultSharingLinkType: 'anonymousAccess' },
		});
		expect(r.status).toBe('fail');
	});
});

describe('dlp_policies_exist', () => {
	it('passes when DLP policies exist', () => {
		const r = evaluateControl(baseControl('dlp_policies_exist'), {
			...baseData,
			dlpPolicies: [{ id: 'p1', state: 'active' }, { id: 'p2', state: 'active' }],
		});
		expect(r.status).toBe('pass');
	});
	it('fails when no DLP policies', () => {
		const r = evaluateControl(baseControl('dlp_policies_exist'), {
			...baseData,
			dlpPolicies: [],
		});
		expect(r.status).toBe('fail');
	});
});

describe('anti_phishing', () => {
	it('passes when secure-score control is at full credit', () => {
		const r = evaluateControl(baseControl('anti_phishing'), {
			...baseData,
			secureScore: { controlScores: [{ controlName: 'AntiPhishingPolicy', score: 5, maxScore: 5 }] },
		});
		expect(r.status).toBe('pass');
	});
	it('partial when score is positive but below max', () => {
		const r = evaluateControl(baseControl('anti_phishing'), {
			...baseData,
			secureScore: { controlScores: [{ controlName: 'AntiPhishing', score: 2, maxScore: 5 }] },
		});
		expect(r.status).toBe('partial');
	});
	it('fails when score is zero', () => {
		const r = evaluateControl(baseControl('anti_phishing'), {
			...baseData,
			secureScore: { controlScores: [{ controlName: 'mip_search_apphishpolicy', score: 0, maxScore: 5 }] },
		});
		expect(r.status).toBe('fail');
	});
	it('partial when no anti-phishing control found', () => {
		const r = evaluateControl(baseControl('anti_phishing'), {
			...baseData,
			secureScore: { controlScores: [{ controlName: 'OtherControl', score: 5, maxScore: 5 }] },
		});
		expect(r.status).toBe('partial');
	});
});

describe('dmarc_configured', () => {
	it('passes when all domains have DMARC at quarantine or reject', () => {
		const r = evaluateControl(baseControl('dmarc_configured'), {
			...baseData,
			dnsAuthByDomain: [
				{ domain: 'a.com', spf: 'pass', dmarc: 'pass', dkim: 'pass', dmarcPolicy: 'reject', dkimPassingCount: 2 },
				{ domain: 'b.com', spf: 'pass', dmarc: 'pass', dkim: 'pass', dmarcPolicy: 'quarantine', dkimPassingCount: 1 },
			],
		});
		expect(r.status).toBe('pass');
	});
	it('partial when some domains pass and others have p=none', () => {
		const r = evaluateControl(baseControl('dmarc_configured'), {
			...baseData,
			dnsAuthByDomain: [
				{ domain: 'a.com', spf: 'pass', dmarc: 'pass', dkim: 'pass', dmarcPolicy: 'reject', dkimPassingCount: 1 },
				{ domain: 'b.com', spf: 'pass', dmarc: 'pass', dkim: 'none', dmarcPolicy: 'none', dkimPassingCount: 0 },
			],
		});
		expect(r.status).toBe('partial');
	});
	it('fails when no domains have DMARC at quarantine/reject', () => {
		const r = evaluateControl(baseControl('dmarc_configured'), {
			...baseData,
			dnsAuthByDomain: [
				{ domain: 'a.com', spf: 'pass', dmarc: 'none', dkim: 'none', dmarcPolicy: 'none', dkimPassingCount: 0 },
			],
		});
		expect(r.status).toBe('fail');
	});
});

describe('spf_configured', () => {
	it('passes when all domains publish SPF', () => {
		const r = evaluateControl(baseControl('spf_configured'), {
			...baseData,
			dnsAuthByDomain: [
				{ domain: 'a.com', spf: 'pass', dmarc: 'pass', dkim: 'pass', dmarcPolicy: 'reject', dkimPassingCount: 1 },
			],
		});
		expect(r.status).toBe('pass');
	});
	it('fails when SPF missing', () => {
		const r = evaluateControl(baseControl('spf_configured'), {
			...baseData,
			dnsAuthByDomain: [
				{ domain: 'a.com', spf: 'none', dmarc: 'none', dkim: 'none', dmarcPolicy: 'none', dkimPassingCount: 0 },
			],
		});
		expect(r.status).toBe('fail');
	});
});

describe('password_expiration', () => {
	it('passes when all domains have validity = Int32.Max', () => {
		const r = evaluateControl(baseControl('password_expiration'), {
			...baseData,
			domains: [
				{ id: 'a.com', passwordValidityPeriodInDays: 2147483647 },
				{ id: 'b.com', passwordValidityPeriodInDays: 2147483647 },
			],
		});
		expect(r.status).toBe('pass');
	});
	it('fails when any domain enforces expiration', () => {
		const r = evaluateControl(baseControl('password_expiration'), {
			...baseData,
			domains: [
				{ id: 'a.com', passwordValidityPeriodInDays: 90 },
				{ id: 'b.com', passwordValidityPeriodInDays: 2147483647 },
			],
		});
		expect(r.status).toBe('fail');
	});
});

describe('dlp_teams_enabled', () => {
	it('passes when a DLP policy mentions Teams location', () => {
		const r = evaluateControl(baseControl('dlp_teams_enabled'), {
			...baseData,
			dlpPolicies: [{ id: 'p1', locations: ['Exchange', 'Teams'] }],
		});
		expect(r.status).toBe('pass');
	});
	it('fails when no DLP policy targets Teams', () => {
		const r = evaluateControl(baseControl('dlp_teams_enabled'), {
			...baseData,
			dlpPolicies: [{ id: 'p1', locations: ['Exchange'] }],
		});
		expect(r.status).toBe('fail');
	});
});

describe('dlp_notifications_on', () => {
	it('passes when all DLP policies have userNotifications', () => {
		const r = evaluateControl(baseControl('dlp_notifications_on'), {
			...baseData,
			dlpPolicies: [{ id: 'p1', userNotifications: { notifyUser: true } }],
		});
		expect(r.status).toBe('pass');
	});
	it('partial when some have notifications', () => {
		const r = evaluateControl(baseControl('dlp_notifications_on'), {
			...baseData,
			dlpPolicies: [
				{ id: 'p1', userNotifications: { notifyUser: true } },
				{ id: 'p2' },
			],
		});
		expect(r.status).toBe('partial');
	});
});

describe('dlp_endpoint_enforcement', () => {
	it('passes when a DLP policy targets endpoint', () => {
		const r = evaluateControl(baseControl('dlp_endpoint_enforcement'), {
			...baseData,
			dlpPolicies: [{ id: 'p1', locations: ['Endpoint'] }],
		});
		expect(r.status).toBe('pass');
	});
	it('fails when no policy targets endpoint', () => {
		const r = evaluateControl(baseControl('dlp_endpoint_enforcement'), {
			...baseData,
			dlpPolicies: [{ id: 'p1', locations: ['Exchange'] }],
		});
		expect(r.status).toBe('fail');
	});
});

describe('auto_labeling_policies', () => {
	it('passes when at least one label has auto-labeling', () => {
		const r = evaluateControl(baseControl('auto_labeling_policies'), {
			...baseData,
			labelPolicies: { value: [{ id: 'l1', autoLabelByDefault: true }] },
		});
		expect(r.status).toBe('pass');
	});
	it('fails when no labels have auto-labeling', () => {
		const r = evaluateControl(baseControl('auto_labeling_policies'), {
			...baseData,
			labelPolicies: { value: [{ id: 'l1' }, { id: 'l2' }] },
		});
		expect(r.status).toBe('fail');
	});
});

describe('default_sensitivity_label', () => {
	it('passes when a label is marked default', () => {
		const r = evaluateControl(baseControl('default_sensitivity_label'), {
			...baseData,
			labelPolicies: { value: [{ id: 'l1', isDefault: true }] },
		});
		expect(r.status).toBe('pass');
	});
	it('fails when no default', () => {
		const r = evaluateControl(baseControl('default_sensitivity_label'), {
			...baseData,
			labelPolicies: { value: [{ id: 'l1' }] },
		});
		expect(r.status).toBe('fail');
	});
});

describe('information_barriers', () => {
	it('passes when an active barrier exists', () => {
		const r = evaluateControl(baseControl('information_barriers'), {
			...baseData,
			informationBarrierPolicies: [{ id: 'b1', state: 'active' }],
		});
		expect(r.status).toBe('pass');
	});
	it('fails when none configured', () => {
		const r = evaluateControl(baseControl('information_barriers'), {
			...baseData,
			informationBarrierPolicies: [],
		});
		expect(r.status).toBe('fail');
	});
});

describe('ediscovery_available', () => {
	it('passes when cases are accessible', () => {
		const r = evaluateControl(baseControl('ediscovery_available'), {
			...baseData,
			ediscoveryCases: [{ id: 'c1' }],
		});
		expect(r.status).toBe('pass');
	});
	it('partial when no cases yet', () => {
		const r = evaluateControl(baseControl('ediscovery_available'), {
			...baseData,
			ediscoveryCases: [],
		});
		expect(r.status).toBe('partial');
	});
});

describe('legal_hold_capable', () => {
	it('passes when an eDiscovery case has a hold', () => {
		const r = evaluateControl(baseControl('legal_hold_capable'), {
			...baseData,
			ediscoveryCases: [{ id: 'c1', holdsCount: 1, customAttributes: 'preservation-hold-applied' }],
		});
		expect(r.status).toBe('pass');
	});
	it('fails when no cases at all', () => {
		const r = evaluateControl(baseControl('legal_hold_capable'), {
			...baseData,
			ediscoveryCases: [],
		});
		expect(r.status).toBe('fail');
	});
});

describe('federated_identity_scoped (Round 5)', () => {
	it('passes when score is 100', () => {
		const r = evaluateControl(baseControl('federated_identity_scoped'), {
			...baseData, federatedIdentityScore: 100, federatedIdentityFindingCount: 0,
		});
		expect(r.status).toBe('pass');
	});
	it('partial at 60-99', () => {
		const r = evaluateControl(baseControl('federated_identity_scoped'), {
			...baseData, federatedIdentityScore: 80, federatedIdentityFindingCount: 2,
		});
		expect(r.status).toBe('partial');
	});
	it('fails below 60', () => {
		const r = evaluateControl(baseControl('federated_identity_scoped'), {
			...baseData, federatedIdentityScore: 40, federatedIdentityFindingCount: 5,
		});
		expect(r.status).toBe('fail');
	});
	it('partial when audit unavailable', () => {
		const r = evaluateControl(baseControl('federated_identity_scoped'), baseData);
		expect(r.status).toBe('partial');
	});
});

describe('retention_* (Round 5)', () => {
	it('passes when retention label covers Exchange', () => {
		const r = evaluateControl(baseControl('retention_exchange'), {
			...baseData, retentionLabels: [{ id: 'l1', descriptiveText: 'Email retention', applicableTo: 'exchange' }],
		});
		expect(r.status).toBe('pass');
	});
	it('partial when labels exist but workload not matched', () => {
		const r = evaluateControl(baseControl('retention_teams'), {
			...baseData, retentionLabels: [{ id: 'l1', descriptiveText: 'general' }],
		});
		expect(r.status).toBe('partial');
	});
	it('fails when no retention labels', () => {
		const r = evaluateControl(baseControl('retention_sharepoint'), {
			...baseData, retentionLabels: [],
		});
		expect(r.status).toBe('fail');
	});
});

describe('external_tagging (Round 5 — Secure Score proxy)', () => {
	it('passes when control is at full score', () => {
		const r = evaluateControl(baseControl('external_tagging'), {
			...baseData, secureScore: { controlScores: [{ controlName: 'ExternalSenderIdentification', score: 5, maxScore: 5 }] },
		});
		expect(r.status).toBe('pass');
	});
	it('partial when no matching control', () => {
		const r = evaluateControl(baseControl('external_tagging'), {
			...baseData, secureScore: { controlScores: [] },
		});
		expect(r.status).toBe('partial');
	});
});

describe('admin_alert_policies (Round 5 — Secure Score aggregate)', () => {
	it('passes when admin-alert controls are at full score', () => {
		const r = evaluateControl(baseControl('admin_alert_policies'), {
			...baseData,
			secureScore: { controlScores: [
				{ controlName: 'AdminRoleAssignmentAlert', score: 3, maxScore: 3 },
				{ controlName: 'PrivilegedRoleAlert', score: 2, maxScore: 2 },
			] },
		});
		expect(r.status).toBe('pass');
	});
	it('partial when partial credit', () => {
		const r = evaluateControl(baseControl('admin_alert_policies'), {
			...baseData,
			secureScore: { controlScores: [{ controlName: 'AdminRoleAssignmentAlert', score: 1, maxScore: 3 }] },
		});
		expect(r.status).toBe('partial');
	});
});

describe('dkim_enabled', () => {
	it('passes when all domains have at least one DKIM selector', () => {
		const r = evaluateControl(baseControl('dkim_enabled'), {
			...baseData,
			dnsAuthByDomain: [
				{ domain: 'a.com', spf: 'pass', dmarc: 'pass', dkim: 'pass', dmarcPolicy: 'reject', dkimPassingCount: 2 },
			],
		});
		expect(r.status).toBe('pass');
	});
	it('partial when some domains pass', () => {
		const r = evaluateControl(baseControl('dkim_enabled'), {
			...baseData,
			dnsAuthByDomain: [
				{ domain: 'a.com', spf: 'pass', dmarc: 'pass', dkim: 'pass', dmarcPolicy: 'reject', dkimPassingCount: 1 },
				{ domain: 'b.com', spf: 'pass', dmarc: 'pass', dkim: 'none', dmarcPolicy: 'reject', dkimPassingCount: 0 },
			],
		});
		expect(r.status).toBe('partial');
	});
});
