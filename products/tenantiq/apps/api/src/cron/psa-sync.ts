/**
 * Generic PSA sync cron — handles Datto Autotask and Kaseya BMS.
 * Reuses the same sync pattern as ConnectWise: 15-min tickets, hourly companies.
 */
import type { Env } from '../app/types';
import type { PSAProvider } from '../../../../packages/integrations/src/base/types';
import { DattoClient } from '../../../../packages/integrations/src/datto/client';
import { KaseyaClient } from '../../../../packages/integrations/src/kaseya/client';
import type { IntegrationProvider } from '../../../../packages/integrations/src/base/provider';

interface IntegrationRow {
	id: string;
	org_id: string;
	provider: string;
	config_encrypted: string;
	last_sync_at: string | null;
}

function createClient(provider: string, config: any): IntegrationProvider | null {
	switch (provider) {
		case 'datto': return new DattoClient(config);
		case 'kaseya': return new KaseyaClient(config);
		default: return null;
	}
}

export async function runPSASync(
	env: Env,
	providers: PSAProvider[],
	isHourly: boolean,
): Promise<void> {
	const placeholders = providers.map(() => '?').join(',');
	const integrations = await env.DB.prepare(
		`SELECT id, org_id, provider, config_encrypted, last_sync_at
		 FROM integrations WHERE provider IN (${placeholders}) AND status = 'active'`,
	).bind(...providers).all();

	const rows = (integrations.results ?? []) as unknown as IntegrationRow[];

	for (const row of rows) {
		try {
			const config = JSON.parse(row.config_encrypted);
			const client = createClient(row.provider, config);
			if (!client) continue;

			// Ticket sync (every 15 min)
			await syncAlerts(env, client, row);

			// Company sync (hourly only)
			if (isHourly) {
				await syncCompanyMappings(env, client, row);
			}

			await env.DB.prepare(
				`UPDATE integrations SET last_sync_at = ?, updated_at = ? WHERE id = ?`,
			).bind(new Date().toISOString(), new Date().toISOString(), row.id).run();
		} catch {
			await env.DB.prepare(
				`UPDATE integrations SET status = 'error', updated_at = ? WHERE id = ?`,
			).bind(new Date().toISOString(), row.id).run();
		}
	}
}

async function syncAlerts(
	env: Env,
	client: IntegrationProvider,
	integration: IntegrationRow,
): Promise<void> {
	const since = integration.last_sync_at || new Date(0).toISOString();
	const alerts = await env.DB.prepare(
		`SELECT a.id, a.title, a.description, a.severity, a.tenant_id
		 FROM alerts a
		 WHERE a.org_id = ? AND a.created_at > ? AND a.severity IN ('critical', 'high')
		   AND NOT EXISTS (
		     SELECT 1 FROM integration_mappings im
		     WHERE im.integration_id = ? AND im.entity_type = 'alert' AND im.local_id = a.id
		   )
		 LIMIT 50`,
	).bind(integration.org_id, since, integration.id).all();

	const mappings = await env.DB.prepare(
		`SELECT local_id, remote_id FROM integration_mappings
		 WHERE integration_id = ? AND entity_type = 'tenant'`,
	).bind(integration.id).all();

	const tenantToCompany = new Map<string, string>();
	for (const m of (mappings.results ?? []) as any[]) {
		tenantToCompany.set(m.local_id, m.remote_id);
	}

	for (const row of (alerts.results ?? []) as any[]) {
		const companyId = tenantToCompany.get(row.tenant_id);
		if (!companyId) continue;
		try {
			const ticket = await client.createTicket({
				summary: `[TenantIQ] ${row.title}`,
				description: row.description || row.title,
				priority: row.severity === 'critical' ? 1 : 2,
				status: 'New',
				companyId,
			});
			await env.DB.prepare(
				`INSERT INTO integration_mappings (id, integration_id, entity_type, local_id, remote_id, synced_at)
				 VALUES (?, ?, 'alert', ?, ?, ?)`,
			).bind(crypto.randomUUID(), integration.id, row.id, ticket.id, new Date().toISOString()).run();
		} catch { /* skip individual failures */ }
	}
}

async function syncCompanyMappings(
	env: Env,
	client: IntegrationProvider,
	integration: IntegrationRow,
): Promise<void> {
	const companies = await client.getCompanies();
	const tenants = await env.DB.prepare(
		`SELECT id, display_name FROM tenants WHERE org_id = ?`,
	).bind(integration.org_id).all();

	const existing = await env.DB.prepare(
		`SELECT local_id FROM integration_mappings
		 WHERE integration_id = ? AND entity_type = 'tenant'`,
	).bind(integration.id).all();

	const mapped = new Set((existing.results ?? []).map((r: any) => r.local_id));

	for (const tenant of (tenants.results ?? []) as any[]) {
		if (mapped.has(tenant.id)) continue;
		const match = companies.find(
			(c) => c.name.toLowerCase() === (tenant.display_name || '').toLowerCase(),
		);
		if (!match) continue;
		await env.DB.prepare(
			`INSERT OR IGNORE INTO integration_mappings
			 (id, integration_id, entity_type, local_id, remote_id, remote_name, synced_at)
			 VALUES (?, ?, 'tenant', ?, ?, ?, ?)`,
		).bind(crypto.randomUUID(), integration.id, tenant.id, match.id, match.name, new Date().toISOString()).run();
	}
}
