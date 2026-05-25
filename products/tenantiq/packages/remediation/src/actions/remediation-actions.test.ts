import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decommissionUser } from './decommission-user';
import { enableMfa } from './enable-mfa';
import { blockIp } from './block-ip';
import { downgradeLicense } from './downgrade-license';
import { revokeSessions } from './revoke-sessions';
import { removeGuest } from './remove-guest';
import { forcePasswordReset } from './force-password-reset';
import { restrictSharing } from './restrict-sharing';
import { enableConditionalAccess } from './enable-conditional-access';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

// Mock GraphClient
const createMockGraphClient = (): GraphClient => ({
	request: vi.fn(),
	get: vi.fn(),
	post: vi.fn(),
	patch: vi.fn(),
	delete: vi.fn()
});

describe('Remediation Actions', () => {
	let mockGraphClient: GraphClient;
	const testTenantId = 'test-tenant-123';

	beforeEach(() => {
		mockGraphClient = createMockGraphClient();
		vi.clearAllMocks();
	});

	describe('REM-001: Decommission User', () => {
		it('should have correct metadata', () => {
			expect(decommissionUser.id).toBe(REMEDIATION_ACTION_IDS.REM_001);
			expect(decommissionUser.name).toBe('Decommission User');
			expect(decommissionUser.reversible).toBe(true);
		});

		it('should block sign-in and revoke licenses for inactive users', async () => {
			const users = [
				{ id: 'user1', email: 'user1@test.com', licenses: ['lic1', 'lic2'] }
			];

			// Mock the GET request for current state
			vi.mocked(mockGraphClient.request)
				.mockResolvedValueOnce({ accountEnabled: true, assignedLicenses: [{ skuId: 'lic1' }, { skuId: 'lic2' }] })
				.mockResolvedValue({});

			const result = await decommissionUser.execute(testTenantId, users, mockGraphClient);

			expect(result.success).toBe(true);
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/users/user1',
				expect.objectContaining({ method: 'PATCH' })
			);
		});

		it('should handle errors gracefully', async () => {
			const users = [{ id: 'user1', email: 'user1@test.com' }];

			vi.mocked(mockGraphClient.request).mockRejectedValue(new Error('API Error'));

			const result = await decommissionUser.execute(testTenantId, users, mockGraphClient);

			expect(result.success).toBe(false);
			expect(result.error).toContain('API Error');
		});

		it('should provide dry run preview', async () => {
			const users = [
				{ id: 'user1', name: 'User One', licenses: ['lic1'] },
				{ id: 'user2', name: 'User Two', licenses: [] }
			];

			const dryRun = await decommissionUser.dryRun(testTenantId, users, mockGraphClient);

			expect(dryRun.changes).toHaveLength(2);
			expect(dryRun.changes[0].resource).toContain('User One');
			expect(dryRun.changes[0].action).toContain('Decommission');
		});
	});

	describe('REM-002: Enable MFA', () => {
		it('should have correct metadata', () => {
			expect(enableMfa.id).toBe(REMEDIATION_ACTION_IDS.REM_002);
			expect(enableMfa.name).toBe('Enable MFA Policy');
			expect(enableMfa.reversible).toBe(true);
		});

		it('should enable existing MFA policies', async () => {
			const policies = [
				{ id: 'policy1', displayName: 'MFA Policy' },
				{ id: 'policy2', displayName: 'Another MFA Policy' }
			];

			vi.mocked(mockGraphClient.request)
				.mockResolvedValueOnce({ id: 'policy1', state: 'disabled' })
				.mockResolvedValueOnce({})
				.mockResolvedValueOnce({ id: 'policy2', state: 'disabled' })
				.mockResolvedValueOnce({});

			const result = await enableMfa.execute(testTenantId, policies, mockGraphClient);

			expect(result.success).toBe(true);
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/identity/conditionalAccessPolicies/policy1',
				expect.objectContaining({
					method: 'PATCH',
					body: JSON.stringify({ state: 'enabled' })
				})
			);
		});

		it('should create new MFA policy when no policies provided', async () => {
			vi.mocked(mockGraphClient.request).mockResolvedValue({ id: 'new-policy' });

			const result = await enableMfa.execute(testTenantId, [], mockGraphClient);

			expect(result.success).toBe(true);
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/identity/conditionalAccessPolicies',
				expect.objectContaining({ method: 'POST' })
			);
		});
	});

	describe('REM-003: Block IP', () => {
		it('should have correct metadata', () => {
			expect(blockIp.id).toBe(REMEDIATION_ACTION_IDS.REM_003);
			expect(blockIp.name).toBe('Block IP Range');
			expect(blockIp.reversible).toBe(true);
		});

		it('should create named location and block policy for suspicious IPs', async () => {
			const ips = [{ ip: '192.168.1.100' }];

			vi.mocked(mockGraphClient.request)
				.mockResolvedValueOnce({ id: 'location1' })
				.mockResolvedValueOnce({ id: 'policy1' });

			const result = await blockIp.execute(testTenantId, ips, mockGraphClient);

			expect(result.success).toBe(true);
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/identity/conditionalAccess/namedLocations',
				expect.objectContaining({ method: 'POST' })
			);
		});
	});

	describe('REM-004: Downgrade License', () => {
		it('should have correct metadata', () => {
			expect(downgradeLicense.id).toBe(REMEDIATION_ACTION_IDS.REM_004);
			expect(downgradeLicense.name).toBe('Downgrade License');
			expect(downgradeLicense.reversible).toBe(true);
		});

		it('should downgrade user licenses from E5 to E3', async () => {
			const users = [
				{
					id: 'user1',
					email: 'user1@test.com',
					currentSku: 'e5-sku-id',
					targetSku: 'e3-sku-id'
				}
			];

			vi.mocked(mockGraphClient.request).mockResolvedValue({});

			const result = await downgradeLicense.execute(testTenantId, users, mockGraphClient);

			expect(result.success).toBe(true);
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/users/user1/assignLicense',
				expect.objectContaining({ method: 'POST' })
			);
		});

		it('should provide cost savings in dry run', async () => {
			const users = [
				{ id: 'user1', name: 'User One', currentSku: 'E5', targetSku: 'E3' }
			];

			const dryRun = await downgradeLicense.dryRun(testTenantId, users, mockGraphClient);

			expect(dryRun.changes).toHaveLength(1);
			expect(dryRun.changes[0].action).toContain('Downgrade');
		});
	});

	describe('REM-005: Revoke Sessions', () => {
		it('should have correct metadata', () => {
			expect(revokeSessions.id).toBe(REMEDIATION_ACTION_IDS.REM_005);
			expect(revokeSessions.name).toBe('Revoke Sessions');
			expect(revokeSessions.reversible).toBe(false);
		});

		it('should revoke refresh tokens for risky users', async () => {
			const users = [
				{ id: 'user1', email: 'user1@test.com' },
				{ id: 'user2', email: 'user2@test.com' }
			];

			vi.mocked(mockGraphClient.request).mockResolvedValue({});

			const result = await revokeSessions.execute(testTenantId, users, mockGraphClient);

			expect(result.success).toBe(true);
			expect(mockGraphClient.request).toHaveBeenCalledTimes(2);
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/users/user1/revokeSignInSessions',
				expect.objectContaining({ method: 'POST' })
			);
		});
	});

	describe('REM-006: Force Password Reset', () => {
		it('should have correct metadata', () => {
			expect(forcePasswordReset.id).toBe(REMEDIATION_ACTION_IDS.REM_006);
			expect(forcePasswordReset.name).toBe('Force Password Reset');
			expect(forcePasswordReset.reversible).toBe(false);
		});

		it('should force password change at next sign-in', async () => {
			const users = [
				{ id: 'user1', email: 'user1@test.com', name: 'User One' }
			];

			vi.mocked(mockGraphClient.request).mockResolvedValue({});

			const result = await forcePasswordReset.execute(testTenantId, users, mockGraphClient);

			expect(result.success).toBe(true);
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/users/user1',
				expect.objectContaining({
					method: 'PATCH',
					body: expect.stringContaining('forceChangePasswordNextSignIn')
				})
			);
		});

		it('should handle partial failures', async () => {
			const users = [
				{ id: 'user1', email: 'user1@test.com' },
				{ id: 'user2', email: 'user2@test.com' }
			];

			vi.mocked(mockGraphClient.request)
				.mockResolvedValueOnce({})
				.mockRejectedValueOnce(new Error('User not found'));

			const result = await forcePasswordReset.execute(testTenantId, users, mockGraphClient);

			expect(result.success).toBe(false);
			expect(result.error).toContain('user2');
		});

		it('should indicate irreversibility in dry run', async () => {
			const users = [{ id: 'user1', name: 'User One' }];

			const dryRun = await forcePasswordReset.dryRun(testTenantId, users, mockGraphClient);

			expect(dryRun.changes[0].action).toContain('irreversible');
		});
	});

	describe('REM-007: Remove Guest', () => {
		it('should have correct metadata', () => {
			expect(removeGuest.id).toBe(REMEDIATION_ACTION_IDS.REM_007);
			expect(removeGuest.name).toBe('Remove Guest User');
			expect(removeGuest.reversible).toBe(false);
		});

		it('should delete stale guest users', async () => {
			const guests = [
				{ id: 'guest1', email: 'guest1@external.com' },
				{ id: 'guest2', email: 'guest2@external.com' }
			];

			vi.mocked(mockGraphClient.request).mockResolvedValue({});

			const result = await removeGuest.execute(testTenantId, guests, mockGraphClient);

			expect(result.success).toBe(true);
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/users/guest1',
				expect.objectContaining({ method: 'DELETE' })
			);
		});
	});

	describe('REM-008: Restrict External Sharing', () => {
		it('should have correct metadata', () => {
			expect(restrictSharing.id).toBe(REMEDIATION_ACTION_IDS.REM_008);
			expect(restrictSharing.name).toBe('Restrict External Sharing');
			expect(restrictSharing.reversible).toBe(true);
		});

		it('should update authorization policy to restrict guest invitations', async () => {
			const currentPolicy = {
				id: 'policy1',
				allowInvitesFrom: 'everyone',
				guestUserRoleId: 'a0b1b346-4d3e-4e8b-98f8-753987be4970', // Default guest role
				allowedToSignUpEmailBasedSubscriptions: false
			};

			vi.mocked(mockGraphClient.request)
				.mockResolvedValueOnce(currentPolicy)
				.mockResolvedValueOnce({});

			const result = await restrictSharing.execute(testTenantId, [], mockGraphClient);

			expect(result.success).toBe(true);
			expect(result.beforeState).toEqual({
				allowInvitesFrom: 'everyone',
				guestUserRoleId: 'a0b1b346-4d3e-4e8b-98f8-753987be4970'
			});
			expect(mockGraphClient.request).toHaveBeenCalledWith(
				testTenantId,
				'/policies/authorizationPolicy',
				expect.objectContaining({
					method: 'PATCH',
					body: expect.stringContaining('adminsAndGuestInviters')
				})
			);
		});

		it('should capture current state in dry run', async () => {
			const currentPolicy = {
				allowInvitesFrom: 'everyone',
				guestUserRoleId: 'default-role-id'
			};

			vi.mocked(mockGraphClient.request).mockResolvedValueOnce(currentPolicy);

			const dryRun = await restrictSharing.dryRun(testTenantId, [], mockGraphClient);

			expect(dryRun.changes[0].currentState).toEqual({
				allowInvitesFrom: 'everyone',
				guestUserRoleId: 'default-role-id'
			});
			expect(dryRun.changes[0].newState).toHaveProperty('allowInvitesFrom', 'adminsAndGuestInviters');
		});
	});

	describe('REM-009: Enable Conditional Access Policy', () => {
		it('should have correct metadata', () => {
			expect(enableConditionalAccess.id).toBe(REMEDIATION_ACTION_IDS.REM_009);
			expect(enableConditionalAccess.name).toBe('Enable Conditional Access Policy');
			expect(enableConditionalAccess.reversible).toBe(true);
		});

		it('should enable multiple disabled policies', async () => {
			const policies = [
				{ id: 'policy1', displayName: 'Require MFA' },
				{ id: 'policy2', displayName: 'Block Legacy Auth' }
			];

			vi.mocked(mockGraphClient.request)
				.mockResolvedValueOnce({ id: 'policy1', state: 'disabled' })
				.mockResolvedValueOnce({})
				.mockResolvedValueOnce({ id: 'policy2', state: 'disabled' })
				.mockResolvedValueOnce({});

			const result = await enableConditionalAccess.execute(testTenantId, policies, mockGraphClient);

			expect(result.success).toBe(true);
			expect(result.beforeState).toHaveLength(2);
			expect(result.afterState).toHaveLength(2);
			expect(result.beforeState[0]).toEqual({ id: 'policy1', state: 'disabled' });
			expect(result.afterState[0]).toEqual({ id: 'policy1', state: 'enabled' });
		});

		it('should fail on first error and return partial state', async () => {
			const policies = [
				{ id: 'policy1', displayName: 'Policy 1' },
				{ id: 'policy2', displayName: 'Policy 2' }
			];

			vi.mocked(mockGraphClient.request)
				.mockResolvedValueOnce({ id: 'policy1', state: 'disabled' })
				.mockRejectedValueOnce(new Error('Permission denied'));

			const result = await enableConditionalAccess.execute(testTenantId, policies, mockGraphClient);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Permission denied');
			expect(result.beforeState).toHaveLength(1);
		});

		it('should show state changes in dry run', async () => {
			const policies = [{ id: 'policy1', displayName: 'MFA Policy' }];

			vi.mocked(mockGraphClient.request).mockResolvedValueOnce({ state: 'disabled' });

			const dryRun = await enableConditionalAccess.dryRun(testTenantId, policies, mockGraphClient);

			expect(dryRun.changes[0].currentState).toEqual({ state: 'disabled' });
			expect(dryRun.changes[0].newState).toEqual({ state: 'enabled' });
		});

		it('should handle API errors in dry run gracefully', async () => {
			const policies = [{ id: 'policy1', displayName: 'MFA Policy' }];

			vi.mocked(mockGraphClient.request).mockRejectedValueOnce(new Error('API Error'));

			const dryRun = await enableConditionalAccess.dryRun(testTenantId, policies, mockGraphClient);

			expect(dryRun.changes[0].currentState).toEqual({ state: 'unknown' });
		});
	});

	describe('Cross-action validation', () => {
		it('should have unique action IDs', () => {
			const actions = [
				decommissionUser,
				enableMfa,
				blockIp,
				downgradeLicense,
				revokeSessions,
				removeGuest,
				forcePasswordReset,
				restrictSharing,
				enableConditionalAccess
			];

			const ids = actions.map((a) => a.id);
			const uniqueIds = new Set(ids);

			expect(uniqueIds.size).toBe(actions.length);
		});

		it('should all have execute and dryRun methods', () => {
			const actions = [
				decommissionUser,
				enableMfa,
				blockIp,
				downgradeLicense,
				revokeSessions,
				removeGuest,
				forcePasswordReset,
				restrictSharing,
				enableConditionalAccess
			];

			for (const action of actions) {
				expect(typeof action.execute).toBe('function');
				expect(typeof action.dryRun).toBe('function');
				expect(typeof action.name).toBe('string');
				expect(typeof action.description).toBe('string');
				expect(typeof action.reversible).toBe('boolean');
			}
		});

		it('should mark irreversible actions correctly', () => {
			expect(revokeSessions.reversible).toBe(false);
			expect(removeGuest.reversible).toBe(false);
			expect(forcePasswordReset.reversible).toBe(false);

			expect(decommissionUser.reversible).toBe(true);
			expect(enableMfa.reversible).toBe(true);
			expect(blockIp.reversible).toBe(true);
			expect(downgradeLicense.reversible).toBe(true);
			expect(restrictSharing.reversible).toBe(true);
			expect(enableConditionalAccess.reversible).toBe(true);
		});
	});
});
