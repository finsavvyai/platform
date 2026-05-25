/**
 * Helper to broadcast events to a tenant's connected clients
 * via the TenantEvents Durable Object.
 */
import type { Env } from '../app/types';
import type { TenantEventMessage } from '../durable-objects/tenant-events';

export async function broadcastToTenant(
	env: Env,
	tenantId: string,
	event: TenantEventMessage
): Promise<void> {
	const durableId = env.TENANT_EVENTS.idFromName(tenantId);
	const stub = env.TENANT_EVENTS.get(durableId);
	await stub.fetch(new Request('https://internal/broadcast', {
		method: 'POST',
		body: JSON.stringify(event)
	}));
}
