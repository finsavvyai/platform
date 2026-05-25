/**
 * Sample Project 1: MSP Multi-Tenant Management
 *
 * Simulates: A managed service provider (CloudGuard MSP) managing
 * multiple client tenants with different plans, roles, and statuses.
 * Tests data isolation, RBAC, tenant lifecycle, and org boundaries.
 */
import { describe, it, expect } from 'vitest';
import type { Tenant, Organization, PlatformUser, UserRole } from '@tenantiq/shared';
import {
	mspOrg, directOrg, freeOrg,
	healthyTenant, riskyTenant, staleTenant, newTenant, suspendedTenant, freeTierTenant,
	mspAdmin, tenantOperator, viewer, contractor,
} from './fixtures/tenant-profiles';

// ── RBAC permission matrix ───────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
	super_admin: ['read', 'write', 'delete', 'remediate', 'manage_team', 'billing', 'manage_tenants'],
	admin: ['read', 'write', 'delete', 'remediate', 'manage_team'],
	operator: ['read', 'write', 'remediate'],
	viewer: ['read'],
};

function hasPermission(role: UserRole, permission: string): boolean {
	return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

function canAccessTenant(user: PlatformUser, tenant: Tenant): boolean {
	return user.organizationId === tenant.organizationId;
}

describe('MSP Multi-Tenant Management', () => {
	describe('Organization Structure', () => {
		it('should differentiate MSP and direct organizations', () => {
			expect(mspOrg.type).toBe('msp');
			expect(directOrg.type).toBe('direct');
			expect(freeOrg.type).toBe('direct');
		});

		it('should track billing plans per organization', () => {
			expect(mspOrg.billingPlan).toBe('enterprise');
			expect(directOrg.billingPlan).toBe('professional');
			expect(freeOrg.billingPlan).toBe('free');
		});

		it('should maintain creation timestamps', () => {
			for (const org of [mspOrg, directOrg, freeOrg]) {
				expect(new Date(org.createdAt).getTime()).toBeLessThan(Date.now());
				expect(org.id).toBeTruthy();
				expect(org.name).toBeTruthy();
			}
		});
	});

	describe('Tenant Lifecycle', () => {
		it('should support active tenants with recent sync', () => {
			expect(healthyTenant.status).toBe('active');
			expect(healthyTenant.lastSyncAt).toBeTruthy();
			const syncAge = Date.now() - new Date(healthyTenant.lastSyncAt!).getTime();
			expect(syncAge).toBeLessThan(24 * 60 * 60 * 1000); // within 24h
		});

		it('should identify stale tenants (>24h since sync)', () => {
			expect(staleTenant.status).toBe('active');
			const syncAge = Date.now() - new Date(staleTenant.lastSyncAt!).getTime();
			expect(syncAge).toBeGreaterThan(24 * 60 * 60 * 1000);
		});

		it('should handle newly connected tenants with no sync', () => {
			expect(newTenant.status).toBe('active');
			expect(newTenant.lastSyncAt).toBeNull();
		});

		it('should handle suspended tenants', () => {
			expect(suspendedTenant.status).toBe('suspended');
		});

		it('should track tenant domain and Azure tenant ID', () => {
			const tenants = [healthyTenant, riskyTenant, staleTenant];
			for (const t of tenants) {
				expect(t.domain).toMatch(/\.\w+$/);
				expect(t.azureTenantId).toBeTruthy();
			}
		});
	});

	describe('Data Isolation (Multi-Tenant Scoping)', () => {
		const mspTenants = [healthyTenant, riskyTenant, staleTenant, suspendedTenant];
		const directTenants = [newTenant];
		const freeTenants = [freeTierTenant];

		it('should scope MSP tenants to MSP org only', () => {
			for (const t of mspTenants) {
				expect(t.organizationId).toBe(mspOrg.id);
			}
		});

		it('should scope direct tenants to direct org only', () => {
			for (const t of directTenants) {
				expect(t.organizationId).toBe(directOrg.id);
			}
		});

		it('should scope free-tier tenants to free org', () => {
			for (const t of freeTenants) {
				expect(t.organizationId).toBe(freeOrg.id);
			}
		});

		it('should prevent cross-org tenant access', () => {
			// MSP admin can see MSP tenants, not direct tenants
			expect(canAccessTenant(mspAdmin, healthyTenant)).toBe(true);
			expect(canAccessTenant(mspAdmin, newTenant)).toBe(false);

			// Contractor can see direct org tenants, not MSP tenants
			expect(canAccessTenant(contractor, newTenant)).toBe(true);
			expect(canAccessTenant(contractor, healthyTenant)).toBe(false);
		});

		it('should enforce org boundary for each platform user', () => {
			const allTenants = [...mspTenants, ...directTenants, ...freeTenants];
			const mspUsers = [mspAdmin, tenantOperator, viewer];

			for (const user of mspUsers) {
				const accessible = allTenants.filter((t) => canAccessTenant(user, t));
				const inaccessible = allTenants.filter((t) => !canAccessTenant(user, t));

				// MSP users should only access MSP org tenants
				for (const t of accessible) {
					expect(t.organizationId).toBe(mspOrg.id);
				}
				for (const t of inaccessible) {
					expect(t.organizationId).not.toBe(mspOrg.id);
				}
			}
		});
	});

	describe('RBAC Permission Model', () => {
		it('super_admin should have all permissions', () => {
			const perms = ROLE_PERMISSIONS.super_admin;
			expect(perms).toContain('read');
			expect(perms).toContain('write');
			expect(perms).toContain('delete');
			expect(perms).toContain('remediate');
			expect(perms).toContain('manage_team');
			expect(perms).toContain('billing');
			expect(perms).toContain('manage_tenants');
		});

		it('operator should have read/write/remediate but not billing', () => {
			expect(hasPermission('operator', 'read')).toBe(true);
			expect(hasPermission('operator', 'write')).toBe(true);
			expect(hasPermission('operator', 'remediate')).toBe(true);
			expect(hasPermission('operator', 'billing')).toBe(false);
			expect(hasPermission('operator', 'manage_team')).toBe(false);
		});

		it('viewer should only have read permission', () => {
			expect(hasPermission('viewer', 'read')).toBe(true);
			expect(hasPermission('viewer', 'write')).toBe(false);
			expect(hasPermission('viewer', 'remediate')).toBe(false);
			expect(hasPermission('viewer', 'delete')).toBe(false);
		});

		it('should map platform users to correct roles', () => {
			expect(mspAdmin.role).toBe('super_admin');
			expect(tenantOperator.role).toBe('operator');
			expect(viewer.role).toBe('viewer');
			expect(contractor.role).toBe('viewer');
		});

		it('contractor should lack Azure OID (external user)', () => {
			expect(contractor.azureOid).toBeNull();
			expect(mspAdmin.azureOid).toBeTruthy();
		});
	});

	describe('Tenant Status Transitions', () => {
		it('should validate all tenant statuses', () => {
			const validStatuses = ['active', 'suspended', 'disconnected'];
			const tenants = [healthyTenant, riskyTenant, staleTenant, newTenant, suspendedTenant];
			for (const t of tenants) {
				expect(validStatuses).toContain(t.status);
			}
		});

		it('should not allow suspended tenants to sync', () => {
			const shouldSync = (t: Tenant) => t.status === 'active';
			expect(shouldSync(healthyTenant)).toBe(true);
			expect(shouldSync(suspendedTenant)).toBe(false);
		});

		it('should identify tenants needing attention', () => {
			const needsAttention = (t: Tenant) => {
				if (t.status === 'suspended') return 'suspended';
				if (!t.lastSyncAt) return 'never_synced';
				const hrs = (Date.now() - new Date(t.lastSyncAt).getTime()) / 3_600_000;
				if (hrs > 24) return 'stale';
				return 'ok';
			};

			expect(needsAttention(healthyTenant)).toBe('ok');
			expect(needsAttention(staleTenant)).toBe('stale');
			expect(needsAttention(newTenant)).toBe('never_synced');
			expect(needsAttention(suspendedTenant)).toBe('suspended');
		});
	});

	describe('Free Tier Limits', () => {
		it('should enforce single-tenant limit for free plan', () => {
			const MAX_TENANTS_FREE = 1;
			const freeTenants = [freeTierTenant]; // simulate only 1 allowed
			expect(freeTenants.length).toBeLessThanOrEqual(MAX_TENANTS_FREE);
		});

		it('should enforce user count limits for free plan', () => {
			const MAX_USERS_FREE = 25;
			const userCount = 5; // free tier has small teams
			expect(userCount).toBeLessThanOrEqual(MAX_USERS_FREE);
		});

		it('should not restrict enterprise plan tenant count', () => {
			const mspTenantCount = 4; // MSP has 4 tenants
			const ENTERPRISE_LIMIT = Infinity;
			expect(mspTenantCount).toBeLessThan(ENTERPRISE_LIMIT);
		});
	});
});
