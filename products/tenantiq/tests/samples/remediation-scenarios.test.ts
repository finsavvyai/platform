/**
 * Sample Project 6: Remediation Engine Scenarios
 *
 * Simulates: Testing all 9 remediation action types (REM-001 through
 * REM-009) with realistic parameters representing actual MSP customer
 * scenarios like user offboarding, MFA enforcement, IP blocking, etc.
 */
import { describe, it, expect } from 'vitest';
import { getDryRunResult } from '../../packages/remediation/src/dry-run';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

describe('Remediation Engine — Full Scenario Coverage', () => {
	describe('REM-001: Decommission User (Offboarding)', () => {
		it('should preview full decommission for departing employee', async () => {
			const result = await getDryRunResult('REM-001', {
				name: 'John Smith',
				email: 'john.smith@contoso.com',
				licenseCount: 3,
			});
			expect(result.changes).toHaveLength(3);
			expect(result.changes.map((c) => c.field)).toContain('accountEnabled');
			expect(result.changes.map((c) => c.field)).toContain('activeSessions');
			expect(result.changes.map((c) => c.field)).toContain('assignedLicenses');
			expect(result.estimatedDuration).toBeTruthy();
			expect(result.reversible).toBe(true);
		});

		it('should show license count in preview', async () => {
			const result = await getDryRunResult('REM-001', { licenseCount: 7 });
			const licChange = result.changes.find((c) => c.field === 'assignedLicenses');
			expect(licChange?.currentValue).toContain('7');
			expect(licChange?.proposedValue).toContain('0');
		});
	});

	describe('REM-002: Enable MFA Policy', () => {
		it('should preview MFA enforcement for entire org', async () => {
			const result = await getDryRunResult('REM-002', {
				policyName: 'Require MFA for All Users',
			});
			expect(result.changes).toHaveLength(2);
			expect(result.changes.map((c) => c.field)).toContain('state');
			expect(result.changes.map((c) => c.field)).toContain('grantControls');
			expect(result.reversible).toBe(true);
		});

		it('should show policy state transition', async () => {
			const result = await getDryRunResult('REM-002', {});
			const stateChange = result.changes.find((c) => c.field === 'state');
			expect(stateChange?.currentValue).toBe('disabled');
			expect(stateChange?.proposedValue).toBe('enabled');
		});
	});

	describe('REM-003: Block IP Range', () => {
		it('should preview blocking a suspicious IP range', async () => {
			const result = await getDryRunResult('REM-003', {
				ip: '203.0.113.0/24',
				reason: 'Brute force attack source',
			});
			expect(result.changes).toHaveLength(2);
			expect(result.changes.map((c) => c.field)).toContain('ipRanges');
			expect(result.changes.map((c) => c.field)).toContain('grantControls');
			expect(result.reversible).toBe(true);
		});

		it('should include the IP in the preview', async () => {
			const result = await getDryRunResult('REM-003', { ip: '10.0.0.1' });
			const ipChange = result.changes.find((c) => c.field === 'ipRanges');
			expect(ipChange?.proposedValue).toContain('10.0.0.1');
		});
	});

	describe('REM-004: Downgrade License', () => {
		it('should preview E5 to E3 downgrade', async () => {
			const result = await getDryRunResult('REM-004', {
				name: 'Sarah Johnson',
				currentSkuId: 'Microsoft 365 E5',
				targetSkuId: 'Microsoft 365 E3',
			});
			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].resource).toContain('Sarah Johnson');
			expect(result.changes[0].currentValue).toContain('E5');
			expect(result.changes[0].proposedValue).toContain('E3');
			expect(result.reversible).toBe(true);
		});

		it('should preview E3 to E1 downgrade', async () => {
			const result = await getDryRunResult('REM-004', {
				name: 'Mike Davis',
				currentSkuId: 'E3',
				targetSkuId: 'E1',
			});
			expect(result.changes[0].currentValue).toContain('E3');
			expect(result.changes[0].proposedValue).toContain('E1');
		});
	});

	describe('REM-005: Revoke Sessions (Emergency)', () => {
		it('should preview session revocation for compromised user', async () => {
			const result = await getDryRunResult('REM-005', {
				name: 'compromised.user@contoso.com',
			});
			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].field).toBe('activeSessions');
			expect(result.changes[0].proposedValue).toBe('revoked');
			// Session revocation is NOT reversible
			expect(result.reversible).toBe(false);
		});

		it('should execute quickly (emergency action)', async () => {
			const result = await getDryRunResult('REM-005', { name: 'test@test.com' });
			expect(result.estimatedDuration).toMatch(/5-10 seconds/);
		});
	});

	describe('REM-006: Force Password Reset', () => {
		it('should preview password reset for potentially breached user', async () => {
			const result = await getDryRunResult('REM-006', {
				name: 'breach.victim@contoso.com',
			});
			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].field).toBe('forceChangePasswordNextSignIn');
			expect(result.changes[0].proposedValue).toBe('true');
			expect(result.reversible).toBe(false);
		});
	});

	describe('REM-007: Remove Guest User', () => {
		it('should preview guest user removal', async () => {
			const result = await getDryRunResult('REM-007', {
				name: 'external.contractor@partner.com',
			});
			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].resource).toContain('Guest');
			expect(result.changes[0].proposedValue).toBe('deleted');
			expect(result.reversible).toBe(false);
		});
	});

	describe('REM-008: Restrict External Sharing', () => {
		it('should preview tightening external sharing policies', async () => {
			const result = await getDryRunResult('REM-008', {});
			expect(result.changes).toHaveLength(2);
			expect(result.changes.map((c) => c.field)).toContain('allowInvitesFrom');
			expect(result.changes.map((c) => c.field)).toContain('guestUserRoleId');
			expect(result.reversible).toBe(true);
		});

		it('should restrict invite permissions', async () => {
			const result = await getDryRunResult('REM-008', {});
			const invite = result.changes.find((c) => c.field === 'allowInvitesFrom');
			expect(invite?.currentValue).toBe('everyone');
			expect(invite?.proposedValue).toBe('adminsAndGuestInviters');
		});
	});

	describe('REM-009: Enable Conditional Access', () => {
		it('should preview enabling a disabled CA policy', async () => {
			const result = await getDryRunResult('REM-009', {
				displayName: 'Block High-Risk Sign-Ins',
				targetId: 'policy-123',
			});
			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].resource).toContain('Block High-Risk');
			expect(result.changes[0].field).toBe('state');
			expect(result.changes[0].proposedValue).toBe('enabled');
			expect(result.reversible).toBe(true);
		});
	});

	describe('Unknown Action Type', () => {
		it('should gracefully handle unknown action IDs', async () => {
			const result = await getDryRunResult('REM-999', {});
			expect(result.changes).toHaveLength(0);
			expect(result.estimatedDuration).toBe('unknown');
			expect(result.reversible).toBe(false);
			expect(result.affectedResources).toBe(0);
		});

		it('should handle empty string action ID', async () => {
			const result = await getDryRunResult('', {});
			expect(result.changes).toHaveLength(0);
		});
	});

	describe('Remediation Action Inventory', () => {
		it('should define all 9 remediation action IDs', () => {
			const ids = Object.values(REMEDIATION_ACTION_IDS);
			expect(ids).toHaveLength(9);
			expect(ids).toContain('REM-001');
			expect(ids).toContain('REM-009');
		});

		it('all known actions should return non-empty dry-run', async () => {
			const ids = Object.values(REMEDIATION_ACTION_IDS) as string[];
			for (const id of ids) {
				const result = await getDryRunResult(id, { name: 'Test', licenseCount: 1 });
				expect(result.changes.length).toBeGreaterThan(0);
				expect(result.estimatedDuration).not.toBe('unknown');
			}
		});

		it('affectedResources should match changes length', async () => {
			const ids = Object.values(REMEDIATION_ACTION_IDS) as string[];
			for (const id of ids) {
				const result = await getDryRunResult(id, {});
				expect(result.affectedResources).toBe(result.changes.length);
			}
		});

		it('reversible actions: REM-001,002,003,004,008,009', async () => {
			const reversibleIds = ['REM-001', 'REM-002', 'REM-003', 'REM-004', 'REM-008', 'REM-009'];
			for (const id of reversibleIds) {
				const result = await getDryRunResult(id, {});
				expect(result.reversible).toBe(true);
			}
		});

		it('irreversible actions: REM-005,006,007', async () => {
			const irreversibleIds = ['REM-005', 'REM-006', 'REM-007'];
			for (const id of irreversibleIds) {
				const result = await getDryRunResult(id, { name: 'test' });
				expect(result.reversible).toBe(false);
			}
		});
	});
});
