/**
 * Sync TenantIQ billing data → ConnectWise Agreements.
 * Enables MSP billing reconciliation between TenantIQ subscriptions and CW.
 */
import type { ConnectWiseClient } from './client';
import type { SyncResult } from '../base/types';
import { measureSync } from '../base/provider';

export interface BillingData {
	tenantId: string;
	tenantName: string;
	plan: string;
	monthlyAmount: number;
	startDate: string;
	endDate?: string;
}

export interface AgreementSyncDeps {
	client: ConnectWiseClient;
	integrationId: string;
	billingData: BillingData[];
	tenantToCompany: Map<string, string>;
	/** Existing agreement mappings: tenantId → CW agreementId */
	existingMappings: Map<string, string>;
	saveMapping: (tenantId: string, agreementId: string, name: string) => Promise<void>;
}

export async function syncAgreements(deps: AgreementSyncDeps): Promise<SyncResult> {
	return measureSync('connectwise', 'agreement', async () => {
		const { client, billingData, tenantToCompany, existingMappings, saveMapping } = deps;
		let created = 0;
		let updated = 0;
		let failed = 0;
		const errors: string[] = [];

		for (const billing of billingData) {
			try {
				const companyId = tenantToCompany.get(billing.tenantId);
				if (!companyId) continue;

				const existingId = existingMappings.get(billing.tenantId);
				if (existingId) {
					updated++;
					continue;
				}

				const name = `TenantIQ ${billing.plan} — ${billing.tenantName}`;
				const agreement = await client.syncAgreement({
					name,
					companyId,
					type: 'Managed Services',
					amount: billing.monthlyAmount,
					startDate: billing.startDate,
					endDate: billing.endDate,
				});

				await saveMapping(billing.tenantId, agreement.id, name);
				created++;
			} catch (e) {
				failed++;
				errors.push(`Tenant ${billing.tenantName}: ${e instanceof Error ? e.message : 'Failed'}`);
			}
		}

		return { created, updated, failed, errors };
	});
}
