import { describe, expect, it } from 'vitest';
import { assemblePimScan } from './scanner';
import type { PimRoleAssignment, PimRoleDefinition } from '@tenantiq/graph';

const GLOBAL_ADMIN_ID = 'def-ga';
const USER_ADMIN_ID = 'def-ua';
const READER_ID = 'def-rd';

const defs: PimRoleDefinition[] = [
	{ id: GLOBAL_ADMIN_ID, displayName: 'Global Administrator', templateId: '62e90394-69f5-4237-9190-012177145e10', isBuiltIn: true, isPrivileged: true },
	{ id: USER_ADMIN_ID, displayName: 'User Administrator', templateId: 'fe930be7-5e62-47db-91af-98c3a49a38b1', isBuiltIn: true, isPrivileged: true },
	{ id: READER_ID, displayName: 'Directory Readers', templateId: '88d8e3e3-8f55-4a1e-953a-9b9898b8876b', isBuiltIn: true, isPrivileged: false },
];

function ass(overrides: Partial<PimRoleAssignment> = {}): PimRoleAssignment {
	return {
		id: 'a-' + Math.random().toString(36).slice(2, 8),
		kind: 'standing',
		roleDefinitionId: READER_ID,
		roleDisplayName: 'Directory Readers',
		principalId: 'p-' + Math.random().toString(36).slice(2, 8),
		principalDisplayName: 'Test User',
		principalUpn: 'test@example.com',
		principalType: 'user',
		startDateTime: new Date().toISOString(),
		endDateTime: new Date(Date.now() + 365 * 86400_000).toISOString(),
		createdDateTime: new Date().toISOString(),
		...overrides,
	};
}

describe('PIM scanner', () => {
	it('returns 100 score for empty tenant', () => {
		const r = assemblePimScan({ roleDefs: defs, standing: [], eligible: [], active: [] });
		expect(r.summary.postureScore).toBe(100);
		expect(r.findings).toHaveLength(0);
	});

	it('flags standing privileged role assignment as critical', () => {
		const r = assemblePimScan({
			roleDefs: defs,
			standing: [ass({ roleDefinitionId: GLOBAL_ADMIN_ID })],
			eligible: [],
			active: [],
		});
		const f = r.findings.find((x) => x.id === 'PIM-STD-001');
		expect(f?.severity).toBe('critical');
		expect(r.summary.standingPrivileged).toBe(1);
	});

	it('does NOT flag standing on non-privileged roles', () => {
		const r = assemblePimScan({
			roleDefs: defs,
			standing: [ass({ roleDefinitionId: READER_ID })],
			eligible: [],
			active: [],
		});
		expect(r.findings.find((x) => x.id === 'PIM-STD-001')).toBeUndefined();
	});

	it('flags assignments with no expiration', () => {
		const r = assemblePimScan({
			roleDefs: defs,
			standing: [ass({ roleDefinitionId: READER_ID, endDateTime: null })],
			eligible: [],
			active: [],
		});
		expect(r.findings.find((x) => x.id === 'PIM-EXP-001')).toBeDefined();
		expect(r.summary.perpetualAssignments).toBe(1);
	});

	it('flags privileged users without MFA registered', () => {
		const noMfaUser = ass({ roleDefinitionId: GLOBAL_ADMIN_ID, principalId: 'pid-no-mfa' });
		const r = assemblePimScan({
			roleDefs: defs,
			standing: [noMfaUser],
			eligible: [],
			active: [],
			mfaLookup: (pid) => pid === 'pid-no-mfa' ? false : null,
		});
		expect(r.findings.find((x) => x.id === 'PIM-MFA-001')?.severity).toBe('critical');
		expect(r.summary.mfaGapCount).toBe(1);
	});

	it('does NOT flag MFA when registration unknown (null)', () => {
		const r = assemblePimScan({
			roleDefs: defs,
			standing: [ass({ roleDefinitionId: GLOBAL_ADMIN_ID })],
			eligible: [],
			active: [],
			// no mfaLookup → defaults to null for everyone
		});
		expect(r.findings.find((x) => x.id === 'PIM-MFA-001')).toBeUndefined();
	});

	it('flags users with 4+ directory roles as over-privileged', () => {
		const userId = 'super-admin';
		const standing = ['r1', 'r2', 'r3', 'r4'].map((rid, i) =>
			ass({
				roleDefinitionId: i === 0 ? GLOBAL_ADMIN_ID : rid,
				principalId: userId,
				roleDisplayName: `role-${i}`,
			}),
		);
		// Add 4 different role defs to keep distinct roles
		const extDefs: PimRoleDefinition[] = [
			...defs,
			{ id: 'r1', displayName: 'r1', templateId: 'r1', isBuiltIn: false, isPrivileged: false },
			{ id: 'r2', displayName: 'r2', templateId: 'r2', isBuiltIn: false, isPrivileged: false },
			{ id: 'r3', displayName: 'r3', templateId: 'r3', isBuiltIn: false, isPrivileged: false },
			{ id: 'r4', displayName: 'r4', templateId: 'r4', isBuiltIn: false, isPrivileged: false },
		];
		const r = assemblePimScan({ roleDefs: extDefs, standing, eligible: [], active: [] });
		expect(r.findings.find((x) => x.id === 'PIM-OVR-001')).toBeDefined();
	});

	it('rewards PIM-eligible adoption in score', () => {
		const allStanding = assemblePimScan({
			roleDefs: defs,
			standing: [ass({ roleDefinitionId: READER_ID }), ass({ roleDefinitionId: READER_ID })],
			eligible: [],
			active: [],
		});
		const allEligible = assemblePimScan({
			roleDefs: defs,
			standing: [],
			eligible: [ass({ kind: 'eligible', roleDefinitionId: READER_ID }), ass({ kind: 'eligible', roleDefinitionId: READER_ID })],
			active: [],
		});
		expect(allEligible.summary.postureScore).toBeGreaterThan(allStanding.summary.postureScore);
	});

	it('penalizes posture for standing privileged + perpetual + MFA gap', () => {
		const r = assemblePimScan({
			roleDefs: defs,
			standing: [
				ass({ roleDefinitionId: GLOBAL_ADMIN_ID, endDateTime: null, principalId: 'p1' }),
				ass({ roleDefinitionId: USER_ADMIN_ID, endDateTime: null, principalId: 'p2' }),
			],
			eligible: [],
			active: [],
			mfaLookup: () => false,
		});
		expect(r.summary.postureScore).toBeLessThan(40);
	});

	it('groups by tenant — standing + eligible counts roll up correctly', () => {
		const r = assemblePimScan({
			roleDefs: defs,
			standing: [ass(), ass()],
			eligible: [ass({ kind: 'eligible' })],
			active: [ass({ kind: 'active' })],
		});
		expect(r.summary.totalAssignments).toBe(4);
		expect(r.summary.standingCount).toBe(2);
		expect(r.summary.eligibleCount).toBe(1);
		expect(r.summary.activeCount).toBe(1);
	});
});
