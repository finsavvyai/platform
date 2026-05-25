import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { getEvents, getEventById, getEventStats } from '../lib/event-store';
import { processEvent, type WebhookEvent } from '../lib/event-bridge';
import type { AppEnv } from '../app/types';

const eventLog = new Hono<AppEnv>();

eventLog.use('*', authMiddleware);
eventLog.use('*', standardRateLimit);

/** GET /log — list webhook events with processing results */
eventLog.get('/log', async (c) => {
	const tenantId = c.get('tenantId');
	const limit = parseInt(c.req.query('limit') ?? '50', 10);
	const eventType = c.req.query('eventType');
	const status = c.req.query('status');

	try {
		const events = await getEvents(c.env, tenantId, {
			limit: Math.min(limit, 100),
			eventType: eventType || undefined,
			status: status || undefined,
		});

		return c.json({
			events: events.map(({ payload: _payload, ...rest }) => rest),
			total: events.length,
		});
	} catch (error) {
		console.error('[EventLog] List failed:', error);
		return c.json({ error: 'Failed to retrieve events' }, 500);
	}
});

/** GET /log/:id — event detail with full payload */
eventLog.get('/log/:id', async (c) => {
	const tenantId = c.get('tenantId');
	const eventId = c.req.param('id');
	if (!eventId) return c.json({ error: 'Missing id' }, 400);

	try {
		const event = await getEventById(c.env, tenantId, eventId);
		if (!event) return c.json({ error: 'Event not found' }, 404);
		return c.json({ event });
	} catch (error) {
		console.error('[EventLog] Detail failed:', error);
		return c.json({ error: 'Failed to retrieve event' }, 500);
	}
});

/** GET /stats — event volume statistics */
eventLog.get('/stats', async (c) => {
	const tenantId = c.get('tenantId');

	try {
		const stats = await getEventStats(c.env, tenantId);
		return c.json({ stats });
	} catch (error) {
		console.error('[EventLog] Stats failed:', error);
		return c.json({ error: 'Failed to compute stats' }, 500);
	}
});

/** POST /replay/:id — replay a specific event through the event bridge (admin+ only) */
eventLog.post('/replay/:id', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const eventId = c.req.param('id');
	if (!eventId) return c.json({ error: 'Missing id' }, 400);

	try {
		const storedEvent = await getEventById(c.env, tenantId, eventId);
		if (!storedEvent) return c.json({ error: 'Event not found' }, 404);

		const webhookEvent: WebhookEvent = {
			id: crypto.randomUUID(),
			type: storedEvent.eventType,
			resource: '',
			resourceType: storedEvent.resourceType,
			data: storedEvent.payload ?? {},
			tenantId,
			receivedAt: new Date().toISOString(),
		};

		// Clear dedup so replay can proceed
		const dedupKey = `event-dedup:replay-${eventId}`;
		await c.env.KV.delete(dedupKey);

		const result = await processEvent(c.env, webhookEvent);

		return c.json({
			replayed: true,
			originalEventId: eventId,
			replayEventId: webhookEvent.id,
			triggeredWorkflows: result.triggeredWorkflows,
		});
	} catch (error) {
		console.error('[EventLog] Replay failed:', error);
		return c.json({ error: 'Failed to replay event' }, 500);
	}
});

export { eventLog };
