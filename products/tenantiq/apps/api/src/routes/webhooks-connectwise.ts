/**
 * ConnectWise → TenantIQ webhook receiver.
 * Handles real-time ticket update callbacks from ConnectWise Manage.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';

export const connectwiseWebhookRoutes = new Hono<AppEnv>();

interface CWCallback {
	ID: number;
	Action: 'added' | 'updated' | 'deleted';
	Type: string;
	MemberId?: number;
	Entity?: {
		id: number;
		summary?: string;
		status?: { name: string };
	};
}

// POST /api/webhooks/connectwise — receive CW callbacks
connectwiseWebhookRoutes.post('/', async (c) => {
	const body = await c.req.json<CWCallback>().catch(() => null);
	if (!body?.ID) {
		return c.json({ received: false, reason: 'Invalid payload' }, 400);
	}

	if (body.Type !== 'ticket' || !body.Entity) {
		return c.json({ received: true, processed: false });
	}

	const ticketId = String(body.Entity.id);
	const newStatus = body.Entity.status?.name;

	if (body.Action === 'updated' && newStatus) {
		// Find the linked alert via mapping
		const mapping = (await c.env.DB.prepare(
			`SELECT local_id FROM integration_mappings
			 WHERE remote_id = ? AND entity_type = 'alert' LIMIT 1`,
		).bind(ticketId).first()) as { local_id: string } | null;

		if (mapping) {
			const alertStatus = mapCWStatusToAlert(newStatus);
			if (alertStatus) {
				await c.env.DB.prepare(
					`UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?`,
				).bind(alertStatus, new Date().toISOString(), mapping.local_id).run();
			}
		}
	}

	return c.json({ received: true, processed: true });
});

function mapCWStatusToAlert(cwStatus: string): string | null {
	const lower = cwStatus.toLowerCase();
	if (lower.includes('closed') || lower.includes('resolved')) return 'resolved';
	if (lower.includes('acknowledged') || lower.includes('in progress')) return 'acknowledged';
	return null;
}
