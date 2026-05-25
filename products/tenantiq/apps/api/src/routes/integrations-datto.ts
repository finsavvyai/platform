/**
 * Datto Autotask integration routes — thin wrapper around shared PSA factory.
 */
import { z } from 'zod';
import { createPSARoutes } from './integrations-shared';

const dattoSchema = z.object({
	apiUser: z.string().min(1),
	apiSecret: z.string().min(1),
	trackingId: z.string().min(1),
	zoneUrl: z.string().url(),
});

async function testDattoConnection(config: Record<string, string>) {
	const token = btoa(`${config.apiUser}:${config.apiSecret}`);
	try {
		const res = await fetch(
			`${config.zoneUrl}/ATServicesRest/V1.0/Companies/query?search={"filter":[{"field":"isActive","op":"eq","value":true}]}&MaxRecords=1`,
			{
				headers: {
					Authorization: `Basic ${token}`,
					ApiIntegrationCode: config.trackingId,
					'Content-Type': 'application/json',
				},
			},
		);
		if (!res.ok) return { ok: false, message: `API returned ${res.status}` };
		return { ok: true, message: 'Connected to Datto Autotask' };
	} catch (e) {
		return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
	}
}

export const dattoRoutes = createPSARoutes('datto', dattoSchema, testDattoConnection);
