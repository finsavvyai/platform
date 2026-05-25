import { writable } from 'svelte/store';
import type { Alert } from '$lib/types/shared';

function createAlertsStore() {
	const { subscribe, set, update } = writable<Alert[]>([]);

	return {
		subscribe,
		set,
		addAlert: (alert: Alert) => {
			update((alerts) => [alert, ...alerts]);
		},
		updateAlert: (id: string, updates: Partial<Alert>) => {
			update((alerts) =>
				alerts.map((a) => (a.id === id ? { ...a, ...updates } : a))
			);
		},
		removeAlert: (id: string) => {
			update((alerts) => alerts.filter((a) => a.id !== id));
		}
	};
}

export const alerts = createAlertsStore();
