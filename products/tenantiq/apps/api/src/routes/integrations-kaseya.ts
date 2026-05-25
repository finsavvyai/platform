/**
 * Kaseya BMS integration routes — thin wrapper around shared PSA factory.
 */
import { z } from 'zod';
import { createPSARoutes } from './integrations-shared';

const kaseyaSchema = z.object({
	apiUrl: z.string().url(),
	apiKey: z.string().min(1),
	tenantId: z.string().min(1),
});

async function testKaseyaConnection(config: Record<string, string>) {
	try {
		const res = await fetch(`${config.apiUrl}/api/system/info`, {
			headers: {
				'X-Api-Key': config.apiKey,
				'X-Tenant-Id': config.tenantId,
				'Content-Type': 'application/json',
			},
		});
		if (!res.ok) return { ok: false, message: `API returned ${res.status}` };
		return { ok: true, message: 'Connected to Kaseya BMS' };
	} catch (e) {
		return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
	}
}

export const kaseyaRoutes = createPSARoutes('kaseya', kaseyaSchema, testKaseyaConnection);
