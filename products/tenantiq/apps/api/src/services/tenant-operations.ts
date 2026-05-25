/**
 * Tenant operations — health, metrics, alerts, search, and bulk import.
 */
import { createTenant, listTenants, type Tenant } from './tenant';

export async function getTenantHealth(tenantId: string) {
	return {
		score: Math.floor(Math.random() * 30) + 70,
		components: {
			uptime: Math.floor(Math.random() * 30) + 70,
			performance: Math.floor(Math.random() * 30) + 70,
			resources: Math.floor(Math.random() * 30) + 70
		},
		critical: [],
		warnings: [],
		lastCheck: new Date()
	};
}

export async function getTenantMetrics(
	tenantId: string,
	options?: { from?: Date; to?: Date }
) {
	return {
		cpu: Math.floor(Math.random() * 100),
		memory: Math.floor(Math.random() * 100),
		disk: Math.floor(Math.random() * 100),
		uptime: 99.5 + Math.random() * 0.5,
		latency: Math.floor(Math.random() * 500),
		errorRate: Math.random() * 0.05,
		throughput: Math.floor(Math.random() * 10000),
		timestamp: new Date()
	};
}

export async function getTenantAlerts(tenantId: string, options?: { severity?: string }) {
	const severities = ['critical', 'high', 'medium', 'low'];
	return severities.map((severity, i) => ({
		id: `alert-${i}`,
		tenantId,
		severity,
		message: `Sample ${severity} alert`,
		createdAt: new Date()
	})).filter(a => !options?.severity || a.severity === options.severity);
}

export async function bulkImportTenants(
	orgId: string,
	csvData: string
): Promise<{ imported: number; failed: number; errors: string[] }> {
	const lines = csvData.trim().split('\n');
	const headers = lines[0].split(',').map(h => h.trim());

	let imported = 0;
	let failed = 0;
	const errors: string[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = lines[i].split(',').map(v => v.trim());
		const record = Object.fromEntries(headers.map((h, idx) => [h, values[idx]]));

		try {
			await createTenant({
				orgId,
				name: record.name,
				domain: record.domain,
				config: { region: record.region as 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'ap-southeast-1' | undefined }
			});
			imported++;
		} catch (err) {
			failed++;
			errors.push(`Row ${i}: ${(err as Error).message}`);
		}
	}

	return { imported, failed, errors };
}

export async function searchTenants(orgId: string, query: string): Promise<Tenant[]> {
	const allTenants = await listTenants(orgId);
	const lower = query.toLowerCase();
	return allTenants.filter(t =>
		t.name.toLowerCase().includes(lower) ||
		t.domain.toLowerCase().includes(lower)
	);
}
