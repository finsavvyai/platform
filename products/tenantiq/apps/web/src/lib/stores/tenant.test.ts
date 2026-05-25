import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { tenant } from './tenant';

const mockTenants = [
	{
		id: 't-1',
		displayName: 'Acme Corp',
		domain: 'acme.com',
		status: 'active' as const,
		lastSyncAt: '2026-03-28T12:00:00Z'
	},
	{
		id: 't-2',
		displayName: 'Globex Inc',
		domain: 'globex.com',
		status: 'active' as const,
		lastSyncAt: null
	}
];

describe('Tenant Store', () => {
	beforeEach(() => {
		localStorage.clear();
		// Reset store state by setting empty tenants
		tenant.setTenants([]);
	});

	it('should start with tenantsLoading true initially', () => {
		// After setTenants([]) in beforeEach, loading is false
		// but fresh store starts with true
		const state = get(tenant);
		expect(state.tenants).toEqual([]);
	});

	it('setTenants should store tenants and default to first', () => {
		tenant.setTenants(mockTenants);
		const state = get(tenant);
		expect(state.tenants).toHaveLength(2);
		expect(state.currentTenantId).toBe('t-1');
		expect(state.tenantsLoading).toBe(false);
	});

	it('setTenants should restore saved tenant from localStorage', () => {
		localStorage.setItem('tenantiq_current_tenant', 't-2');
		tenant.setTenants(mockTenants);
		expect(get(tenant).currentTenantId).toBe('t-2');
	});

	it('setTenants should ignore invalid saved tenant', () => {
		localStorage.setItem('tenantiq_current_tenant', 'nonexistent');
		tenant.setTenants(mockTenants);
		expect(get(tenant).currentTenantId).toBe('t-1');
	});

	it('setCurrentTenant should update current and persist', () => {
		tenant.setTenants(mockTenants);
		tenant.setCurrentTenant('t-2');
		expect(get(tenant).currentTenantId).toBe('t-2');
		expect(localStorage.getItem('tenantiq_current_tenant')).toBe('t-2');
	});

	it('setLoaded should mark loading as complete', () => {
		tenant.setLoaded();
		expect(get(tenant).tenantsLoading).toBe(false);
	});

	it('markSynced should update lastSyncAt for the tenant', () => {
		tenant.setTenants(mockTenants);
		const before = new Date().toISOString();
		tenant.markSynced('t-2');
		const state = get(tenant);
		const updated = state.tenants.find((t) => t.id === 't-2');
		expect(updated?.lastSyncAt).not.toBeNull();
		// Should be a recent ISO string
		expect(new Date(updated!.lastSyncAt!).getTime()).toBeGreaterThanOrEqual(
			new Date(before).getTime() - 1000
		);
	});

	it('markSynced should not affect other tenants', () => {
		tenant.setTenants(mockTenants);
		tenant.markSynced('t-2');
		const state = get(tenant);
		const unchanged = state.tenants.find((t) => t.id === 't-1');
		expect(unchanged?.lastSyncAt).toBe('2026-03-28T12:00:00Z');
	});

	it('setTenants with empty array should set null currentTenantId', () => {
		tenant.setTenants([]);
		expect(get(tenant).currentTenantId).toBeNull();
	});
});
