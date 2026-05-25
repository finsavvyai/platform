/**
 * Alert check functions — pure logic for detecting security conditions.
 * No DB or side effects; consumed by alert-generator.ts.
 */

export type AlertType = 'inactive_user' | 'disabled_account' | 'license_waste'
	| 'no_mfa_admin' | 'guest_access' | 'stale_account';

export interface UserRow {
	id: string; display_name: string; user_principal_name: string;
	account_enabled: number; last_sign_in_at: string | number | null;
}

export interface LicenseRow {
	sku_id: string; sku_part_number: string;
	consumed_units: number; enabled_units: number;
}

export interface WasteResult {
	sku: string; unassigned: number; monthlyCost: number;
}

const DAY_MS = 86_400_000;

export function parseSignInDate(val: string | number | null): Date | null {
	if (val == null) return null;
	if (typeof val === 'number') return new Date(val > 1e12 ? val : val * 1000);
	const d = new Date(val);
	return isNaN(d.getTime()) ? null : d;
}

export function checkInactiveUsers(users: UserRow[], now: number) {
	const inactive: Array<UserRow & { daysSince: number }> = [];
	for (const u of users) {
		if (!u.account_enabled) continue;
		const d = parseSignInDate(u.last_sign_in_at);
		if (!d) continue;
		const days = Math.floor((now - d.getTime()) / DAY_MS);
		if (days >= 90) inactive.push({ ...u, daysSince: days });
	}
	return inactive;
}

export function checkStaleAccounts(users: UserRow[]) {
	return users.filter((u) => u.account_enabled && u.last_sign_in_at == null);
}

export function checkDisabledAccounts(users: UserRow[]) {
	return users.filter((u) => !u.account_enabled);
}

export function checkGuestAccess(users: UserRow[], now: number) {
	return users.filter((u) => {
		if (!u.user_principal_name?.includes('#EXT#')) return false;
		const d = parseSignInDate(u.last_sign_in_at);
		if (!d) return true; // never signed in guest
		return (now - d.getTime()) / DAY_MS >= 30;
	});
}

export function checkLicenseWaste(licenses: LicenseRow[], getSkuCost: (sku: string) => number): WasteResult[] {
	const results: WasteResult[] = [];
	for (const l of licenses) {
		const total = Number(l.enabled_units ?? 0);
		const consumed = Number(l.consumed_units ?? 0);
		if (total <= 0) continue;
		const unassigned = total - consumed;
		const wasteRatio = unassigned / total;
		const cost = getSkuCost(l.sku_part_number);
		const monthlyCost = unassigned * cost;
		if (wasteRatio > 0.2 && monthlyCost > 10) {
			results.push({ sku: l.sku_part_number, unassigned, monthlyCost });
		}
	}
	return results;
}
