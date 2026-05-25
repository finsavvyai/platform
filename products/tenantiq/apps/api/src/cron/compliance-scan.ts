import type { Env } from '../index';
import { getDb } from '../lib/db';
import { getAllActiveTenants, getUsersByTenant, getLicensesByTenant } from '@tenantiq/db';
import { RuleEngine } from '@tenantiq/intel';
import type { TenantData } from '@tenantiq/shared';
import { mapUsers, mapLicenses, mapTenant } from './security-scan';
import { assertOrgId } from '../lib/org-scope-assert';

export async function runComplianceScan(env: Env) {
	console.log('[ComplianceScan] Starting daily compliance scan');

	const db = getDb(env);
	const tenants = await getAllActiveTenants(db);
	const engine = new RuleEngine();

	for (const tenant of tenants) {
		assertOrgId(tenant.organizationId, 'ComplianceScan');
		try {
			const [users, licenses] = await Promise.all([
				getUsersByTenant(db, tenant.id, { limit: 50000 }),
				getLicensesByTenant(db, tenant.id)
			]);

			const data: TenantData = { users: mapUsers(users), licenses: mapLicenses(licenses) };
			const info = mapTenant(tenant);

			const [complianceCandidates, optimizationCandidates] = await Promise.all([
				engine.evaluateCategory('compliance', info, data),
				engine.evaluateCategory('optimization', info, data)
			]);

			const allCandidates = [...complianceCandidates, ...optimizationCandidates];

			if (allCandidates.length > 0) {
				await env.SCAN_QUEUE.send({
					type: 'alert_candidates',
					tenantId: tenant.id,
					candidates: allCandidates
				});
			}

			console.log(`[ComplianceScan] ${tenant.displayName}: ${allCandidates.length} findings`);
		} catch (err) {
			console.error(`[ComplianceScan] Failed for ${tenant.displayName}:`, err);
		}
	}

	console.log('[ComplianceScan] Complete');
}
