/**
 * ConnectWise sync cron — runs every 15 min for tickets, hourly for companies.
 * Reads active integrations from DB, syncs alerts → tickets, tenants ↔ companies.
 */
import type { Env } from '../app/types';
import { ConnectWiseClient } from '../../../../packages/integrations/src/connectwise/client';
import type { ConnectWiseCredentials } from '../../../../packages/integrations/src/base/types';

interface IntegrationRow {
	id: string;
	org_id: string;
	config_encrypted: string;
	last_sync_at: string | null;
}

export async function runConnectWiseSync(env: Env, isHourly: boolean): Promise<void> {
	const integrations = await env.DB.prepare(
		`SELECT id, org_id, config_encrypted, last_sync_at
		 FROM integrations WHERE provider = 'connectwise' AND status = 'active'`,
	).all();

	const rows = (integrations.results ?? []) as unknown as IntegrationRow[];

	for (const row of rows) {
		try {
			const creds = JSON.parse(row.config_encrypted) as ConnectWiseCredentials;
			const client = new ConnectWiseClient(creds);

			// Always sync tickets (every 15 min)
			await syncNewAlerts(env, client, row);

			// Only sync companies hourly
			if (isHourly) {
				await syncCompanyMappings(env, client, row);
			}

			await env.DB.prepare(
				`UPDATE integrations SET last_sync_at = ?, updated_at = ? WHERE id = ?`,
			).bind(new Date().toISOString(), new Date().toISOString(), row.id).run();
		} catch (e) {
			await env.DB.prepare(
				`UPDATE integrations SET status = 'error', updated_at = ? WHERE id = ?`,
			).bind(new Date().toISOString(), row.id).run();
		}
	}
}

async function syncNewAlerts(
	env: Env,
	client: ConnectWiseClient,
	integration: IntegrationRow,
): Promise<void> {
	// Get alerts created since last sync that don't have ticket mappings
	const since = integration.last_sync_at || new Date(0).toISOString();
	const alerts = await env.DB.prepare(
		`SELECT a.id, a.title, a.description, a.severity, a.status, a.tenant_id, a.created_at
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
	client: ConnectWiseClient,
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
		).bind(
			crypto.randomUUID(), integration.id,
			tenant.id, match.id, match.name, new Date().toISOString(),
		).run();
	}
}
