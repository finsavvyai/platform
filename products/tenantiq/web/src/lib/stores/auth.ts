import { writable } from 'svelte/store';
import { API_BASE } from '$lib/config';

interface AuthUser {
	id: string;
	email: string;
	name: string;
	organizationId: string;
	tenantIds: string[];
	role: 'viewer' | 'operator' | 'admin' | 'platform_admin' | 'super_admin';
	status?: 'active' | 'suspended';
	plan?: string;
	trialEndsAt?: string | null;
	// 'admin' = full Graph scopes granted via tenant admin consent.
	// 'personal' = user-only delegated scopes; tenant-wide features blocked.
	scopeLevel?: 'admin' | 'personal';
}

interface AuthState {
	user: AuthUser | null;
	loading: boolean;
}

function createAuthStore() {
	// Session is carried entirely by the HttpOnly cookie — no user state
	// is persisted to localStorage. `loading` starts true; the layout's
	// /api/auth/me probe on mount resolves it (200 → setUser, 401 → clear).
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		loading: true,
	});

	return {
		subscribe,
		setUser: (user: AuthUser) => set({ user, loading: false }),
		clear: () => set({ user: null, loading: false }),
		setLoading: (loading: boolean) => update((s) => ({ ...s, loading })),
		/** Fire-and-forget POST /auth/logout (clears server cookie), then reset state. */
		logout: async () => {
			try {
				await fetch(`${API_BASE}/auth/logout`, {
					method: 'POST',
					credentials: 'include',
				});
			} catch { /* best-effort */ }
			set({ user: null, loading: false });
		},
	};
}

export const auth = createAuthStore();
