/**
 * Account deletion cascade — GDPR Art. 17 / M365 Cert C7.
 * Hard-deletes one organization and every row tied to it across D1, KV, R2.
 *
 * Order matters: child rows first to avoid orphans even without FKs.
 * See docs/DATA_DELETION.md for the auditor-readable description.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { purgeKvByPrefixes } from './kv-purge';

export interface DeletionReport {
	orgId: string;
	tenantsDeleted: string[];
	d1RowsDeleted: Record<string, number>;
	kvKeysDeleted: number;
	r2ObjectsDeleted: number;
	durationMs: number;
}

const TENANT_SCOPED_TABLES = [
	'users_cache',
	'licenses_cache',
	'user_licenses',
	'security_alerts',
	'webhook_configs',
	'copilot_assessments',
	'storage_analytics',
	'config_snapshots',
	'config_drifts',
	'sync_jobs',
	'drift_suppression_rules',
	'backup_jobs',
	'tokenforge_device_bindings',
	'tokenforge_config',
	'tokenforge_events',
	'remediation_log',
	'tenant_audit_log',
	'workflows',
	'workflow_runs',
	'alerts',
	'ai_conversations',
] as const;

const ORG_SCOPED_TABLES_ORG_ID = [
	'org_branding',
	'sso_connections',
	'integrations',
	'partners',
	'audit_logs',
	'tf_opensyber_integrations',
] as const;

const ORG_SCOPED_TABLES_ORGANIZATION_ID = [
	'platform_users',
	'tenants',
] as const;

async function deleteFromTable(
	db: D1Database,
	table: string,
	column: string,
	values: string[],
): Promise<number> {
	if (values.length === 0) return 0;
	const placeholders = values.map(() => '?').join(',');
	const stmt = db.prepare(`DELETE FROM ${table} WHERE ${column} IN (${placeholders})`);
	const res = await stmt.bind(...values).run();
	return res.meta?.changes ?? 0;
}

async function listR2Prefix(r2: R2Bucket, prefix: string): Promise<string[]> {
	const keys: string[] = [];
	let cursor: string | undefined;
	do {
		const list = await r2.list({ prefix, cursor, limit: 1000 });
		keys.push(...list.objects.map((o) => o.key));
		cursor = list.truncated ? list.cursor : undefined;
	} while (cursor);
	return keys;
}

async function purgeR2(r2: R2Bucket, prefixes: string[]): Promise<number> {
	let total = 0;
	for (const p of prefixes) {
		const keys = await listR2Prefix(r2, p);
		for (let i = 0; i < keys.length; i += 1000) {
			const slice = keys.slice(i, i + 1000);
			await r2.delete(slice);
			total += slice.length;
		}
	}
	return total;
}

export async function deleteOrganization(
	c: Context<AppEnv>,
	orgId: string,
): Promise<DeletionReport> {
	const start = Date.now();
	const db = c.env.DB;
	const rowsDeleted: Record<string, number> = {};

	const tenantRows = await db
		.prepare('SELECT id, azure_tenant_id FROM tenants WHERE organization_id = ?')
		.bind(orgId)
		.all<{ id: string; azure_tenant_id: string }>();
	const tenantIds = tenantRows.results.map((r) => r.id);
	const azureTenantIds = tenantRows.results.map((r) => r.azure_tenant_id);

	const memberRows = await db
		.prepare('SELECT azure_oid FROM platform_users WHERE organization_id = ?')
		.bind(orgId)
		.all<{ azure_oid: string }>();
	const memberOids = memberRows.results
		.map((r) => r.azure_oid)
		.filter((v): v is string => Boolean(v));

	for (const t of TENANT_SCOPED_TABLES) {
		rowsDeleted[t] = await deleteFromTable(db, t, 'tenant_id', tenantIds);
	}

	const cfgRows = await db
		.prepare(
			`SELECT id FROM webhook_configs WHERE tenant_id IN (${tenantIds.map(() => '?').join(',') || "''"})`,
		)
		.bind(...(tenantIds.length ? tenantIds : ['']))
		.all<{ id: string }>();
	const cfgIds = cfgRows.results.map((r) => r.id);
	rowsDeleted['webhook_deliveries'] = await deleteFromTable(db, 'webhook_deliveries', 'config_id', cfgIds);

	// integration_mappings is keyed by integration_id; lookup integrations under
	// this org so the mappings get cascaded too. Same shape for partner_integrations.
	const intRows = await db
		.prepare('SELECT id FROM integrations WHERE org_id = ?')
		.bind(orgId)
		.all<{ id: string }>();
	rowsDeleted['integration_mappings'] = await deleteFromTable(
		db, 'integration_mappings', 'integration_id', intRows.results.map((r) => r.id),
	);

	const partnerRows = await db
		.prepare('SELECT id FROM partners WHERE org_id = ?')
		.bind(orgId)
		.all<{ id: string }>();
	rowsDeleted['partner_integrations'] = await deleteFromTable(
		db, 'partner_integrations', 'partner_id', partnerRows.results.map((r) => r.id),
	);

	for (const t of ORG_SCOPED_TABLES_ORG_ID) {
		rowsDeleted[t] = await deleteFromTable(db, t, 'org_id', [orgId]);
	}
	for (const t of ORG_SCOPED_TABLES_ORGANIZATION_ID) {
		rowsDeleted[t] = await deleteFromTable(db, t, 'organization_id', [orgId]);
	}

	rowsDeleted['organizations'] = await deleteFromTable(db, 'organizations', 'id', [orgId]);

	const kvPrefixes = [
		...azureTenantIds.flatMap((tid) => [`graph:${tid}:`]),
		...tenantIds.flatMap((tid) => [
			`consent:${tid}`,
			`score:${tid}`,
			`snapshot:${tid}`,
			`drift:${tid}`,
		]),
		...memberOids.map((oid) => `session:${oid}`),
	];
	const kvResult = await purgeKvByPrefixes(c.env.KV, kvPrefixes);

	const r2Prefixes = [
		`exports/${orgId}/`,
		`snapshots/${orgId}/`,
		`reports/${orgId}/`,
	];
	const r2Deleted = await purgeR2(c.env.R2, r2Prefixes);

	return {
		orgId,
		tenantsDeleted: tenantIds,
		d1RowsDeleted: rowsDeleted,
		kvKeysDeleted: kvResult.deleted,
		r2ObjectsDeleted: r2Deleted,
		durationMs: Date.now() - start,
	};
}
