import { writable } from 'svelte/store';

interface Tenant {
	id: string;
	displayName: string;
	domain: string;
	status: 'active' | 'suspended' | 'disconnected';
	lastSyncAt: string | null;
}

interface TenantState {
	currentTenantId: string | null;
	tenants: Tenant[];
	tenantsLoading: boolean;
}

function createTenantStore() {
	const { subscribe, set, update } = writable<TenantState>({
		currentTenantId: null,
		tenants: [],
		tenantsLoading: true
	});

	// Track last emitted currentTenantId to avoid spurious notifications.
	// Svelte writable stores notify on EVERY set/update call even if the
	// value is identical, which re-fires every $effect on every page.
	let _lastTenantId: string | null = null;
	let _currentState: TenantState = {
		currentTenantId: null,
		tenants: [],
		tenantsLoading: true
	};

	/** Only push to subscribers when something actually changed. */
	function emit(next: TenantState) {
		_currentState = next;
		set(next);
		_lastTenantId = next.currentTenantId;
	}

	/** Push when only metadata changed (loading flag, sync timestamp) —
	 *  skip if the fields that $effects care about didn't change.
	 *  This prevents re-triggering data-fetching effects on every page. */
	function emitIfChanged(next: TenantState) {
		const tenantIdChanged = next.currentTenantId !== _lastTenantId;
		const tenantsChanged = next.tenants !== _currentState.tenants;
		const loadingChanged = next.tenantsLoading !== _currentState.tenantsLoading;

		_currentState = next;
		if (tenantIdChanged || tenantsChanged || loadingChanged) {
			set(next);
			_lastTenantId = next.currentTenantId;
		}
	}

	return {
		subscribe,
		setCurrentTenant: (tenantId: string) => {
			const next = { ..._currentState, currentTenantId: tenantId };
			emit(next);
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('tenantiq_current_tenant', tenantId);
			}
		},
		setTenants: (tenants: TenantState['tenants']) => {
			const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('tenantiq_current_tenant') : null;
			const validSaved = saved && tenants.some((t) => t.id === saved);
			const currentTenantId = validSaved ? saved : (tenants[0]?.id ?? null);
			emit({ tenants, tenantsLoading: false, currentTenantId });
		},
		setLoaded: () => {
			emitIfChanged({ ..._currentState, tenantsLoading: false });
		},
		markSynced: (tenantId: string) => {
			const tenants = _currentState.tenants.map((t) =>
				t.id === tenantId ? { ...t, lastSyncAt: new Date().toISOString() } : t
			);
			emitIfChanged({ ..._currentState, tenants });
		}
	};
}

export const tenant = createTenantStore();
