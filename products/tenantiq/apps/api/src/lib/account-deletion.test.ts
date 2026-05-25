/**
 * Drift-resistant cascade test. Captures every `DELETE FROM <t>` issued by
 * deleteOrganization and asserts the set of tables touched matches the
 * 33-table contract documented in docs/PARTNER_CENTER_SUBMISSION.md and
 * docs/DATA_DELETION.md. If a future commit adds a new customer-owned
 * table without wiring it into the cascade, this test fails.
 */

import { describe, it, expect } from 'vitest';
import { deleteOrganization } from './account-deletion';

const EXPECTED_TABLES: ReadonlySet<string> = new Set([
	// 21 tenant-scoped
	'users_cache', 'licenses_cache', 'user_licenses', 'security_alerts',
	'webhook_configs', 'copilot_assessments', 'storage_analytics',
	'config_snapshots', 'config_drifts', 'sync_jobs', 'drift_suppression_rules',
	'backup_jobs', 'tokenforge_device_bindings', 'tokenforge_config',
	'tokenforge_events', 'remediation_log', 'tenant_audit_log', 'workflows',
	'workflow_runs', 'alerts', 'ai_conversations',
	// 6 org_id-scoped
	'org_branding', 'sso_connections', 'integrations', 'partners', 'audit_logs',
	'tf_opensyber_integrations',
	// 2 organization_id-scoped
	'platform_users', 'tenants',
	// 3 FK-lookup
	'webhook_deliveries', 'integration_mappings', 'partner_integrations',
	// 1 root
	'organizations',
]);

function mockEnv() {
	const deleteSql: string[] = [];
	const selectSql: string[] = [];
	const db = {
		prepare(sql: string) {
			if (sql.startsWith('DELETE FROM ')) deleteSql.push(sql);
			if (sql.startsWith('SELECT')) selectSql.push(sql);
			return {
				bind: (...args: unknown[]) => ({
					all: async () => {
						if (sql.includes('FROM tenants WHERE organization_id')) {
							return { results: [{ id: 't1', azure_tenant_id: 'azure-tid-1' }] };
						}
						if (sql.includes('FROM platform_users WHERE organization_id')) {
							return { results: [{ azure_oid: 'oid-admin' }] };
						}
						if (sql.includes('FROM webhook_configs')) {
							return { results: [{ id: 'cfg-1' }] };
						}
						if (sql.includes('FROM integrations WHERE org_id')) {
							return { results: [{ id: 'int-1' }] };
						}
						if (sql.includes('FROM partners WHERE org_id')) {
							return { results: [{ id: 'partner-1' }] };
						}
						return { results: [] };
					},
					run: async () => ({ meta: { changes: 1 } }),
				}),
			};
		},
	};
	const kv = {
		list: async () => ({ keys: [], list_complete: true }),
		delete: async () => undefined,
		put: async () => undefined,
		get: async () => null,
	};
	const r2 = {
		list: async () => ({ objects: [], truncated: false }),
		delete: async () => undefined,
		put: async () => undefined,
		get: async () => null,
	};
	return { ctx: { env: { DB: db, KV: kv, R2: r2 } } as any, deleteSql, selectSql };
}

describe('deleteOrganization cascade contract', () => {
	it('hits exactly the 33 documented tables', async () => {
		const { ctx, deleteSql } = mockEnv();
		await deleteOrganization(ctx, 'org-under-test');

		const touched = new Set<string>();
		for (const sql of deleteSql) {
			const m = /^DELETE FROM (\w+)/.exec(sql);
			if (m) touched.add(m[1]);
		}

		expect(touched.size, 'cascade table count').toBe(EXPECTED_TABLES.size);
		const missing = [...EXPECTED_TABLES].filter((t) => !touched.has(t));
		const extra = [...touched].filter((t) => !EXPECTED_TABLES.has(t));
		expect(missing, 'expected tables not cascaded').toEqual([]);
		expect(extra, 'unexpected tables cascaded').toEqual([]);
	});

	it('DELETE order: leaves organizations row last', async () => {
		const { ctx, deleteSql } = mockEnv();
		await deleteOrganization(ctx, 'org-under-test');
		const last = deleteSql[deleteSql.length - 1] ?? '';
		expect(last).toMatch(/^DELETE FROM organizations\b/);
	});

	it('returns a report with the org id and timing', async () => {
		const { ctx } = mockEnv();
		const report = await deleteOrganization(ctx, 'org-under-test');
		expect(report.orgId).toBe('org-under-test');
		expect(report.tenantsDeleted).toEqual(['t1']);
		expect(report.durationMs).toBeGreaterThanOrEqual(0);
		// Every expected table appears in the per-table delete count map.
		for (const t of EXPECTED_TABLES) {
			expect(report.d1RowsDeleted, `report.d1RowsDeleted missing key: ${t}`).toHaveProperty(t);
		}
	});
});
