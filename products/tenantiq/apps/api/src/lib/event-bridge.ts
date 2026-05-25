/**
 * Event Bridge
 *
 * Routes incoming webhook events to matching workflow trigger rules.
 * Handles deduplication, condition evaluation, and workflow queuing.
 */

import { evaluateConditions, type ConditionGroup } from './workflows/condition-evaluator';
import { storeEvent, type StoredEvent } from './event-store';
import type { GraphNotification } from './webhook-processor';

export interface TriggerRule {
	id: string;
	eventType: string;
	resourceType: string;
	workflowId: string;
	conditions?: Record<string, unknown>;
	enabled: boolean;
	createdAt: string;
}

export interface WebhookEvent {
	id: string;
	type: string;
	resource: string;
	resourceType: string;
	data: Record<string, unknown>;
	tenantId: string;
	receivedAt: string;
}

const EVENT_TYPE_MAP: Record<string, string> = {
	'users:created': 'user.created',
	'users:deleted': 'user.deleted',
	'users:updated': 'user.updated',
	'groups:created': 'group.created',
	'groups:deleted': 'group.deleted',
	'security/alerts_v2:created': 'security.alert',
	'security/alerts_v2:updated': 'security.alert',
};

const DEDUP_PREFIX = 'event-dedup';
const DEDUP_TTL = 3600; // 1 hour

/** Convert a Graph notification to a WebhookEvent */
export function notificationToEvent(notification: GraphNotification): WebhookEvent | null {
	const tenantId = notification.clientState?.replace('tenantiq-', '');
	if (!tenantId) return null;

	const resourceBase = notification.resource.split('/').filter(Boolean)[0] ?? '';
	const mapKey = `${resourceBase}:${notification.changeType}`;
	const eventType = EVENT_TYPE_MAP[mapKey] ?? `${resourceBase}.${notification.changeType}`;

	return {
		id: crypto.randomUUID(),
		type: eventType,
		resource: notification.resource,
		resourceType: resourceBase,
		data: {
			resourceId: notification.resourceData.id,
			odataType: notification.resourceData['@odata.type'],
			changeType: notification.changeType,
			subscriptionId: notification.subscriptionId,
		},
		tenantId,
		receivedAt: new Date().toISOString(),
	};
}

/** Find trigger rules that match a given event */
export function matchEvent(event: WebhookEvent, rules: TriggerRule[]): TriggerRule[] {
	return rules.filter((rule) => {
		if (!rule.enabled) return false;
		if (rule.eventType !== event.type && rule.eventType !== '*') return false;
		if (rule.resourceType && rule.resourceType !== event.resourceType && rule.resourceType !== '*') return false;

		if (rule.conditions && Object.keys(rule.conditions).length > 0) {
			const group = rule.conditions as unknown as ConditionGroup;
			if (group.logic && group.conditions) {
				return evaluateConditions(event.data, group);
			}
		}
		return true;
	});
}

/** Compute a dedup hash for an event */
function computeEventHash(event: WebhookEvent): string {
	const key = `${event.type}:${event.tenantId}:${JSON.stringify(event.data)}`;
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
	}
	return Math.abs(hash).toString(36);
}

/** Process an event: deduplicate, match rules, queue workflows, store audit */
export async function processEvent(
	env: { KV: KVNamespace; SCAN_QUEUE: Queue },
	event: WebhookEvent
): Promise<{ triggeredWorkflows: string[] }> {
	const startTime = Date.now();
	const eventHash = computeEventHash(event);
	const dedupKey = `${DEDUP_PREFIX}:${eventHash}`;

	const existing = await env.KV.get(dedupKey);
	if (existing) {
		await storeAuditEvent(env, event, 'skipped', [], Date.now() - startTime);
		return { triggeredWorkflows: [] };
	}

	await env.KV.put(dedupKey, '1', { expirationTtl: DEDUP_TTL });

	const rulesRaw = await env.KV.get(`triggers:${event.tenantId}`);
	const rules: TriggerRule[] = rulesRaw ? JSON.parse(rulesRaw) : [];
	const matched = matchEvent(event, rules);
	const triggeredWorkflows = matched.map((r) => r.workflowId);

	try {
		for (const rule of matched) {
			await env.SCAN_QUEUE.send({
				type: 'workflow_execution',
				workflowId: rule.workflowId,
				tenantId: event.tenantId,
				triggeredBy: 'event_bridge',
				eventId: event.id,
				eventType: event.type,
			});
		}

		await storeAuditEvent(env, event, 'processed', triggeredWorkflows, Date.now() - startTime);
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Unknown error';
		await storeAuditEvent(env, event, 'failed', triggeredWorkflows, Date.now() - startTime, msg);
	}

	return { triggeredWorkflows };
}

async function storeAuditEvent(
	env: { KV: KVNamespace },
	event: WebhookEvent,
	status: StoredEvent['status'],
	triggeredWorkflows: string[],
	processingTime: number,
	error?: string
): Promise<void> {
	const stored: StoredEvent = {
		id: event.id,
		eventType: event.type,
		resourceType: event.resourceType,
		receivedAt: event.receivedAt,
		status,
		triggeredWorkflows,
		processingTime,
		payload: event.data,
		error,
	};
	await storeEvent(env, event.tenantId, stored);
}
