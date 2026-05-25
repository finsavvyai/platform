/**
 * Bi-directional sync: TenantIQ tenants ↔ ConnectWise Companies.
 * Creates mappings in integration_mappings table.
 */
import type { ConnectWiseClient } from './client';
import type { SyncResult } from '../base/types';
import { measureSync } from '../base/provider';

export interface CompanySyncDeps {
	client: ConnectWiseClient;
	integrationId: string;
	/** All tenants for this org: { id, displayName } */
	tenants: { id: string; displayName: string }[];
	/** Existing mappings: localId → remoteId */
	existingMappings: Map<string, string>;
	/** Save a new mapping */
	saveMapping: (localId: string, remoteId: string, remoteName: string) => Promise<void>;
}

export async function syncCompanies(deps: CompanySyncDeps): Promise<SyncResult> {
	return measureSync('connectwise', 'tenant', async () => {
		const { client, tenants, existingMappings, saveMapping } = deps;
		let created = 0;
		let updated = 0;
		let failed = 0;
		const errors: string[] = [];

		const cwCompanies = await client.getCompanies();
		const cwByName = new Map(cwCompanies.map((c) => [c.name.toLowerCase(), c]));

		for (const tenant of tenants) {
			try {
				if (existingMappings.has(tenant.id)) {
					updated++;
					continue;
				}

				// Try to match by name (case-insensitive)
				const match = cwByName.get(tenant.displayName.toLowerCase());
				if (match) {
					await saveMapping(tenant.id, match.id, match.name);
					created++;
				}
			} catch (e) {
				failed++;
				errors.push(`Tenant ${tenant.displayName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
			}
		}

		return { created, updated, failed, errors };
	});
}

/** Auto-map tenants to CW companies by name similarity */
export function findBestMatch(
	tenantName: string,
	companies: { id: string; name: string }[],
): { id: string; name: string; confidence: number } | null {
	const normalized = tenantName.toLowerCase().trim();
	let best: { id: string; name: string; confidence: number } | null = null;

	for (const company of companies) {
		const cwName = company.name.toLowerCase().trim();
		if (cwName === normalized) {
			return { ...company, confidence: 1.0 };
		}
		if (cwName.includes(normalized) || normalized.includes(cwName)) {
			const confidence = Math.min(cwName.length, normalized.length) / Math.max(cwName.length, normalized.length);
			if (!best || confidence > best.confidence) {
				best = { ...company, confidence };
			}
		}
	}

	return best && best.confidence >= 0.6 ? best : null;
}
