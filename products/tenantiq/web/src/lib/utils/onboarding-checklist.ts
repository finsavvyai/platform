/**
 * Mark an onboarding-checklist task complete from anywhere in the app.
 *
 * The checklist component (OnboardingChecklist.svelte) owns the localStorage
 * key; this helper updates it without importing the component, so other
 * pages (e.g. /licenses, /ai) can flip their own task done on visit.
 *
 * It dispatches a `storage` event so an open dashboard tab updates without
 * a full reload.
 */
const STORAGE_KEY = 'tenantiq_onboarding_checklist';

export type ChecklistKey = 'cisScanDone' | 'licensesReviewed' | 'aiTried';

export function markChecklistDone(key: ChecklistKey): void {
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const state: Record<string, unknown> = raw ? JSON.parse(raw) : {};
		if (state[key] === true) return;
		state[key] = true;
		const next = JSON.stringify(state);
		localStorage.setItem(STORAGE_KEY, next);
		// Notify same-tab listeners — `storage` event only fires cross-tab natively.
		window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: next }));
	} catch {
		// localStorage may be unavailable (private mode); checklist still works manually.
	}
}
