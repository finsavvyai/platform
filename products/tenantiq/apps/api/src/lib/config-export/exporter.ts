/**
 * Configuration-as-Code exporter.
 * Reads Microsoft Graph API policies and serializes to JSON.
 */

import type { ConfigCategory, ConfigDiffResult, ConfigExport } from './types';
import { ALL_CATEGORIES } from './types';

type GraphFetch = (endpoint: string) => Promise<unknown>;

async function fetchCategory(graphFetch: GraphFetch, cat: ConfigCategory): Promise<unknown> {
	const endpoints: Record<ConfigCategory, string> = {
		conditionalAccess: '/identity/conditionalAccess/policies',
		authMethods: '/policies/authenticationMethodsPolicy',
		securityDefaults: '/policies/identitySecurityDefaultsEnforcementPolicy',
		dlpPolicies: '/informationProtection/policy/labels',
		sharingSettings: '/admin/sharepoint/settings',
	};
	try {
		return await graphFetch(endpoints[cat]);
	} catch {
		return { error: 'Failed to fetch', category: cat };
	}
}

export async function exportConfig(
	graphFetch: GraphFetch,
	categories: ConfigCategory[],
	tenant: { id: string; displayName: string },
): Promise<ConfigExport> {
	const selected = categories.length > 0 ? categories : ALL_CATEGORIES;
	const results: Record<string, unknown> = {};

	const entries = await Promise.allSettled(
		selected.map(async (cat) => {
			const data = await fetchCategory(graphFetch, cat);
			return { cat, data };
		}),
	);

	for (const entry of entries) {
		if (entry.status === 'fulfilled') {
			results[entry.value.cat] = entry.value.data;
		}
	}

	return {
		version: '1.0.0',
		exportedAt: new Date().toISOString(),
		tenant,
		categories: results,
	};
}

function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	if (obj === null || typeof obj !== 'object') {
		result[prefix] = obj;
		return result;
	}
	for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (val && typeof val === 'object' && !Array.isArray(val)) {
			Object.assign(result, flattenObject(val, path));
		} else {
			result[path] = val;
		}
	}
	return result;
}

export function diffConfigs(
	oldExport: ConfigExport,
	newExport: ConfigExport,
): ConfigDiffResult[] {
	const diffs: ConfigDiffResult[] = [];

	const allCats = new Set([
		...Object.keys(oldExport.categories),
		...Object.keys(newExport.categories),
	]);

	for (const category of allCats) {
		const oldFlat = flattenObject(oldExport.categories[category] ?? {});
		const newFlat = flattenObject(newExport.categories[category] ?? {});
		const allKeys = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]);

		for (const path of allKeys) {
			const oldVal = oldFlat[path];
			const newVal = newFlat[path];
			if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
				diffs.push({ category, path, oldValue: oldVal ?? null, newValue: newVal ?? null });
			}
		}
	}

	return diffs;
}
