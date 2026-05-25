/**
 * Event Store
 *
 * Persists webhook events and processing results to KV for audit trail.
 * Maintains a rolling index of the last 500 event IDs per tenant.
 */

export interface StoredEvent {
	id: string;
	eventType: string;
	resourceType: string;
	receivedAt: string;
	status: 'processed' | 'failed' | 'skipped';
	triggeredWorkflows: string[];
	processingTime: number;
	payload?: Record<string, unknown>;
	error?: string;
}

export interface EventStats {
	totalEvents: number;
	byType: { type: string; count: number }[];
	avgProcessingTime: number;
	errorRate: number;
}

interface EventIndex {
	ids: string[];
	updatedAt: string;
}

const EVENT_PREFIX = 'events';
const INDEX_SUFFIX = 'index';
const MAX_INDEX_SIZE = 500;
const EVENT_TTL = 30 * 24 * 60 * 60; // 30 days

function eventKey(tenantId: string, eventId: string): string {
	return `${EVENT_PREFIX}:${tenantId}:${eventId}`;
}

function indexKey(tenantId: string): string {
	return `${EVENT_PREFIX}:${tenantId}:${INDEX_SUFFIX}`;
}

/** Store an event in KV and update the tenant index */
export async function storeEvent(
	env: { KV: KVNamespace },
	tenantId: string,
	event: StoredEvent
): Promise<void> {
	await env.KV.put(eventKey(tenantId, event.id), JSON.stringify(event), {
		expirationTtl: EVENT_TTL,
	});

	const raw = await env.KV.get(indexKey(tenantId));
	const index: EventIndex = raw
		? JSON.parse(raw)
		: { ids: [], updatedAt: new Date().toISOString() };

	index.ids.unshift(event.id);
	if (index.ids.length > MAX_INDEX_SIZE) {
		index.ids = index.ids.slice(0, MAX_INDEX_SIZE);
	}
	index.updatedAt = new Date().toISOString();

	await env.KV.put(indexKey(tenantId), JSON.stringify(index), {
		expirationTtl: EVENT_TTL,
	});
}

/** Retrieve events with optional filtering */
export async function getEvents(
	env: { KV: KVNamespace },
	tenantId: string,
	filters: { limit?: number; eventType?: string; status?: string }
): Promise<StoredEvent[]> {
	const raw = await env.KV.get(indexKey(tenantId));
	if (!raw) return [];

	const index: EventIndex = JSON.parse(raw);
	const limit = filters.limit ?? 50;
	const events: StoredEvent[] = [];

	for (const id of index.ids) {
		if (events.length >= limit) break;

		const eventRaw = await env.KV.get(eventKey(tenantId, id));
		if (!eventRaw) continue;

		const event: StoredEvent = JSON.parse(eventRaw);
		if (filters.eventType && event.eventType !== filters.eventType) continue;
		if (filters.status && event.status !== filters.status) continue;

		events.push(event);
	}

	return events;
}

/** Get a single event by ID */
export async function getEventById(
	env: { KV: KVNamespace },
	tenantId: string,
	eventId: string
): Promise<StoredEvent | null> {
	const raw = await env.KV.get(eventKey(tenantId, eventId));
	return raw ? JSON.parse(raw) : null;
}

/** Aggregate event statistics for a tenant */
export async function getEventStats(
	env: { KV: KVNamespace },
	tenantId: string
): Promise<EventStats> {
	const events = await getEvents(env, tenantId, { limit: 500 });
	const byTypeMap = new Map<string, number>();
	let totalTime = 0;
	let failedCount = 0;

	for (const event of events) {
		byTypeMap.set(event.eventType, (byTypeMap.get(event.eventType) ?? 0) + 1);
		totalTime += event.processingTime;
		if (event.status === 'failed') failedCount++;
	}

	const byType = Array.from(byTypeMap.entries()).map(([type, count]) => ({ type, count }));

	return {
		totalEvents: events.length,
		byType,
		avgProcessingTime: events.length > 0 ? Math.round(totalTime / events.length) : 0,
		errorRate: events.length > 0 ? Math.round((failedCount / events.length) * 100) / 100 : 0,
	};
}
