import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { auth } from './auth';

describe('Auth Store', () => {
	const mockUser = {
		id: 'user-1',
		email: 'admin@test.com',
		name: 'Test Admin',
		organizationId: 'org-1',
		tenantIds: ['t-1', 't-2'],
		role: 'admin' as const,
	};

	beforeEach(() => {
		auth.clear();
		// Avoid real network during logout() in tests.
		vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
	});

	it('should initialize with null user and loading=false after clear', () => {
		const state = get(auth);
		expect(state.user).toBeNull();
		expect(state.loading).toBe(false);
	});

	it('setUser should set user and clear loading', () => {
		auth.setLoading(true);
		auth.setUser(mockUser);
		const state = get(auth);
		expect(state.user).toEqual(mockUser);
		expect(state.loading).toBe(false);
	});

	it('clear should reset user', () => {
		auth.setUser(mockUser);
		auth.clear();
		const state = get(auth);
		expect(state.user).toBeNull();
		expect(state.loading).toBe(false);
	});

	it('logout should POST to /auth/logout and clear state', async () => {
		auth.setUser(mockUser);
		await auth.logout();
		expect(fetch).toHaveBeenCalled();
		const state = get(auth);
		expect(state.user).toBeNull();
	});

	it('setLoading should toggle loading state', () => {
		auth.setLoading(true);
		expect(get(auth).loading).toBe(true);
		auth.setLoading(false);
		expect(get(auth).loading).toBe(false);
	});

	it('should support user with optional fields', () => {
		const userWithOptionals = {
			...mockUser,
			status: 'active' as const,
			plan: 'pro',
			trialEndsAt: '2026-04-30T00:00:00Z',
		};
		auth.setUser(userWithOptionals);
		const state = get(auth);
		expect(state.user?.status).toBe('active');
		expect(state.user?.plan).toBe('pro');
		expect(state.user?.trialEndsAt).toBe('2026-04-30T00:00:00Z');
	});
});
