import { describe, expect, it, vi } from 'vitest';
import {
	checkLicensing, checkIdentityAccess, checkDataProtection,
	checkCompliance, checkSecurity, checkCollaboration, checkDataQuality,
} from './readiness-checks';

function makeGf(responses: Record<string, any>) {
	return vi.fn(async (path: string) => {
		for (const [key, val] of Object.entries(responses)) {
			if (path.includes(key)) return val;
		}
		throw new Error('Unexpected path: ' + path);
	});
}

describe('Copilot Readiness Checks', () => {
	describe('checkLicensing', () => {
		it('passes with E3/E5 and Copilot licenses', async () => {
			const gf = makeGf({
				subscribedSkus: {
					value: [
						{ skuPartNumber: 'ENTERPRISEPACK', prepaidUnits: { enabled: 50 }, consumedUnits: 40 },
						{ skuPartNumber: 'M365_COPILOT', prepaidUnits: { enabled: 10 }, consumedUnits: 5 },
					],
				},
			});
			const { checks, recs } = await checkLicensing(gf);
			expect(checks.find(c => c.name === 'M365 E3/E5')?.status).toBe('pass');
			expect(checks.find(c => c.name === 'Copilot add-on')?.status).toBe('pass');
			expect(recs).toHaveLength(0);
		});

		it('fails without E3/E5 licenses', async () => {
			const gf = makeGf({
				subscribedSkus: { value: [{ skuPartNumber: 'BASIC', prepaidUnits: { enabled: 10 }, consumedUnits: 5 }] },
			});
			const { checks, recs } = await checkLicensing(gf);
			expect(checks.find(c => c.name === 'M365 E3/E5')?.status).toBe('fail');
			expect(recs.find(r => r.priority === 'critical')).toBeDefined();
		});

		it('warns without Copilot add-on', async () => {
			const gf = makeGf({
				subscribedSkus: { value: [{ skuPartNumber: 'SPE_E5', prepaidUnits: { enabled: 50 }, consumedUnits: 40 }] },
			});
			const { checks, recs } = await checkLicensing(gf);
			expect(checks.find(c => c.name === 'Copilot add-on')?.status).toBe('warning');
			expect(recs.find(r => r.priority === 'high')).toBeDefined();
		});

		it('handles Graph API error', async () => {
			const gf = vi.fn().mockRejectedValue(new Error('API error'));
			const { checks } = await checkLicensing(gf);
			expect(checks[0].status).toBe('error');
		});
	});

	describe('checkIdentityAccess', () => {
		it('passes with 90%+ MFA and 2+ CA policies', async () => {
			const gf = makeGf({
				authenticationMethods: { value: Array.from({ length: 10 }, () => ({ isMfaRegistered: true })) },
				conditionalAccessPolicies: { value: [{ state: 'enabled' }, { state: 'enabled' }] },
			});
			const { checks } = await checkIdentityAccess(gf);
			expect(checks.find(c => c.name === 'MFA enrollment')?.status).toBe('pass');
			expect(checks.find(c => c.name === 'Conditional Access')?.status).toBe('pass');
		});

		it('warns with low MFA', async () => {
			const gf = makeGf({
				authenticationMethods: {
					value: [
						...Array.from({ length: 6 }, () => ({ isMfaRegistered: true })),
						...Array.from({ length: 4 }, () => ({ isMfaRegistered: false })),
					],
				},
				conditionalAccessPolicies: { value: [{ state: 'enabled' }, { state: 'enabled' }] },
			});
			const { checks } = await checkIdentityAccess(gf);
			expect(checks.find(c => c.name === 'MFA enrollment')?.status).toBe('warning');
		});

		it('fails with very low MFA', async () => {
			const gf = makeGf({
				authenticationMethods: {
					value: [
						...Array.from({ length: 3 }, () => ({ isMfaRegistered: true })),
						...Array.from({ length: 7 }, () => ({ isMfaRegistered: false })),
					],
				},
				conditionalAccessPolicies: { value: [] },
			});
			const { checks, recs } = await checkIdentityAccess(gf);
			expect(checks.find(c => c.name === 'MFA enrollment')?.status).toBe('fail');
			expect(recs.find(r => r.priority === 'critical')).toBeDefined();
		});
	});

	describe('checkDataProtection', () => {
		it('passes with 3+ sensitivity labels', async () => {
			const gf = makeGf({
				'informationProtection/policy/labels': { value: ['Public', 'Internal', 'Confidential'] },
			});
			const { checks } = await checkDataProtection(gf);
			expect(checks.find(c => c.name === 'Sensitivity labels')?.status).toBe('pass');
		});

		it('fails with fewer than 3 labels', async () => {
			const gf = makeGf({
				'informationProtection/policy/labels': { value: ['Public'] },
			});
			const { checks, recs } = await checkDataProtection(gf);
			expect(checks.find(c => c.name === 'Sensitivity labels')?.status).toBe('fail');
			expect(recs.find(r => r.priority === 'critical')).toBeDefined();
		});
	});

	describe('checkCompliance', () => {
		it('passes with accessible org and restricted guest access', async () => {
			const gf = makeGf({
				'/organization': { value: [{ id: 'org1' }] },
				authorizationPolicy: { guestUserRoleId: '2af84b1e-32c8-42b7-82bc-daa82404023b' },
			});
			const { checks } = await checkCompliance(gf);
			expect(checks.find(c => c.name === 'Audit logging')?.status).toBe('pass');
			expect(checks.find(c => c.name === 'Guest access controls')?.status).toBe('pass');
		});

		it('warns with permissive guest access', async () => {
			const gf = makeGf({
				'/organization': { value: [{ id: 'org1' }] },
				authorizationPolicy: { guestUserRoleId: 'some-other-id' },
			});
			const { checks } = await checkCompliance(gf);
			expect(checks.find(c => c.name === 'Guest access controls')?.status).toBe('warning');
		});
	});

	describe('checkSecurity', () => {
		it('passes with high secure score and no alerts', async () => {
			const gf = makeGf({
				secureScores: { value: [{ currentScore: 80, maxScore: 100 }] },
				alerts_v2: { value: [] },
			});
			const { checks } = await checkSecurity(gf);
			expect(checks.find(c => c.name === 'Secure Score')?.status).toBe('pass');
			expect(checks.find(c => c.name === 'Active alerts')?.status).toBe('pass');
		});

		it('fails with low secure score and many alerts', async () => {
			const gf = makeGf({
				secureScores: { value: [{ currentScore: 10, maxScore: 100 }] },
				alerts_v2: { value: Array.from({ length: 5 }, () => ({})) },
			});
			const { checks, recs } = await checkSecurity(gf);
			expect(checks.find(c => c.name === 'Secure Score')?.status).toBe('fail');
			expect(checks.find(c => c.name === 'Active alerts')?.status).toBe('fail');
			expect(recs.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('checkCollaboration', () => {
		it('passes with few public groups and restricted invites', async () => {
			const gf = makeGf({
				groups: { value: [] },
				authorizationPolicy: { allowInvitesFrom: 'adminsAndGuestInviters' },
			});
			const { checks } = await checkCollaboration(gf);
			expect(checks.find(c => c.name === 'Public groups')?.status).toBe('pass');
			expect(checks.find(c => c.name === 'Guest invitations')?.status).toBe('pass');
		});

		it('fails with many public groups', async () => {
			const gf = makeGf({
				groups: { value: Array.from({ length: 10 }, () => ({})) },
				authorizationPolicy: { allowInvitesFrom: 'everyone' },
			});
			const { checks, recs } = await checkCollaboration(gf);
			expect(checks.find(c => c.name === 'Public groups')?.status).toBe('fail');
			expect(recs.find(r => r.priority === 'critical')).toBeDefined();
		});
	});

	describe('checkDataQuality', () => {
		it('passes with few stale accounts and recent groups', async () => {
			const gf = makeGf({
				'/users': { value: [{ id: 'u1', signInActivity: { lastSignInDateTime: new Date().toISOString() } }] },
				'/groups': { value: [{ id: 'g1', createdDateTime: new Date().toISOString() }] },
			});
			const { checks } = await checkDataQuality(gf);
			expect(checks.find(c => c.name === 'Stale accounts')?.status).toBe('pass');
			expect(checks.find(c => c.name === 'Orphaned groups')?.status).toBe('pass');
		});

		it('warns with many old groups', async () => {
			const oldDate = new Date(Date.now() - 400 * 86400000).toISOString();
			const gf = makeGf({
				'/users': { value: [] },
				'/groups': { value: Array.from({ length: 10 }, () => ({ createdDateTime: oldDate })) },
			});
			const { checks, recs } = await checkDataQuality(gf);
			expect(checks.find(c => c.name === 'Orphaned groups')?.status).toBe('warning');
			expect(recs.find(r => r.title.includes('Review old groups'))).toBeDefined();
		});

		it('handles Graph errors gracefully', async () => {
			const gf = vi.fn().mockRejectedValue(new Error('fail'));
			const { checks } = await checkDataQuality(gf);
			expect(checks.every(c => c.status === 'error')).toBe(true);
		});
	});
});
