import { describe, it, expect } from 'vitest';
import { auditCrossTenantPolicy, summarizeCrossTenantAudit, type CrossTenantAccessPolicy } from './cross-tenant-auditor';

describe('auditCrossTenantPolicy', () => {
	it('returns no findings on a strictly-locked-down default policy', () => {
		const policy: CrossTenantAccessPolicy = {
			default: {
				b2bCollaborationInbound: { usersAndGroups: { accessType: 'blocked', targets: [] } },
				b2bDirectConnectInbound: { usersAndGroups: { accessType: 'blocked', targets: [] } },
				automaticUserConsentSettings: { inboundAllowed: false, outboundAllowed: false },
			},
			partners: [],
		};
		expect(auditCrossTenantPolicy(policy)).toHaveLength(0);
	});

	it('flags default unrestricted B2B collab inbound', () => {
		const policy: CrossTenantAccessPolicy = {
			default: {
				b2bCollaborationInbound: {
					usersAndGroups: { accessType: 'allowed', targets: [{ targetType: 'AllUsers', target: 'AllUsers' }] },
					applications: { accessType: 'allowed', targets: [{ targetType: 'AllApplications', target: 'AllApplications' }] },
				},
			},
		};
		const f = auditCrossTenantPolicy(policy);
		expect(f.some(x => x.issue === 'default_inbound_b2b_unrestricted')).toBe(true);
	});

	it('flags critical-severity Direct Connect inbound from any tenant', () => {
		const policy: CrossTenantAccessPolicy = {
			default: {
				b2bDirectConnectInbound: {
					usersAndGroups: { accessType: 'allowed', targets: [{ targetType: 'AllUsers', target: 'AllUsers' }] },
				},
			},
		};
		const f = auditCrossTenantPolicy(policy);
		const dc = f.find(x => x.issue === 'direct_connect_inbound_unrestricted');
		expect(dc?.severity).toBe('critical');
	});

	it('flags default auto-consent inbound', () => {
		const policy: CrossTenantAccessPolicy = {
			default: {
				automaticUserConsentSettings: { inboundAllowed: true },
			},
		};
		const f = auditCrossTenantPolicy(policy);
		expect(f.some(x => x.issue === 'default_auto_consent_inbound')).toBe(true);
	});

	it('flags partner-level auto-consent inbound', () => {
		const policy: CrossTenantAccessPolicy = {
			partners: [{
				tenantId: 'partner-1',
				tenantName: 'Acme MSP',
				automaticUserConsentSettings: { inboundAllowed: true },
			}],
		};
		const f = auditCrossTenantPolicy(policy);
		expect(f.some(x => x.issue === 'partner_auto_consent_inbound')).toBe(true);
	});

	it('flags partner with unscoped B2B inbound', () => {
		const policy: CrossTenantAccessPolicy = {
			partners: [{
				tenantId: 'partner-1',
				b2bCollaborationInbound: {
					usersAndGroups: { accessType: 'allowed', targets: [{ targetType: 'AllUsers', target: 'AllUsers' }] },
					applications: { accessType: 'allowed', targets: [{ targetType: 'AllApplications', target: 'AllApplications' }] },
				},
			}],
		};
		const f = auditCrossTenantPolicy(policy);
		expect(f.some(x => x.issue === 'partner_unscoped_b2b_inbound')).toBe(true);
	});

	it('downgrades partner-unscoped severity for service providers', () => {
		const policy: CrossTenantAccessPolicy = {
			partners: [{
				tenantId: 'msp-1',
				isServiceProvider: true,
				b2bCollaborationInbound: {
					usersAndGroups: { accessType: 'allowed', targets: [{ targetType: 'AllUsers', target: 'AllUsers' }] },
					applications: { accessType: 'allowed', targets: [{ targetType: 'AllApplications', target: 'AllApplications' }] },
				},
			}],
		};
		const f = auditCrossTenantPolicy(policy);
		const partnerFinding = f.find(x => x.issue === 'partner_unscoped_b2b_inbound');
		expect(partnerFinding?.severity).toBe('medium');
		expect(f.some(x => x.issue === 'service_provider_unscoped')).toBe(true);
	});
});

describe('summarizeCrossTenantAudit', () => {
	it('scores 100 for clean policy', () => {
		const r = summarizeCrossTenantAudit({ default: { automaticUserConsentSettings: { inboundAllowed: false } } });
		expect(r.score).toBe(100);
		expect(r.findings).toHaveLength(0);
	});
	it('deducts based on severity', () => {
		const r = summarizeCrossTenantAudit({
			default: {
				b2bDirectConnectInbound: { usersAndGroups: { accessType: 'allowed', targets: [{ target: 'AllUsers' }] } },
				automaticUserConsentSettings: { inboundAllowed: true },
			},
		});
		// critical (30) + high (15) deduction
		expect(r.score).toBeLessThanOrEqual(55);
	});
});
