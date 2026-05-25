import { Hono } from 'hono';
import { authMiddleware, tenantScopingMiddleware, requireRole } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { matchEvent, type TriggerRule, type WebhookEvent } from '../lib/event-bridge';
import { validateConditionGroup } from '../lib/workflows/condition-evaluator';
import type { AppEnv } from '../app/types';

const eventTriggers = new Hono<AppEnv>();

eventTriggers.use('*', authMiddleware);
eventTriggers.use('*', standardRateLimit);

const VALID_EVENT_TYPES = [
	'user.created', 'user.deleted', 'user.updated',
	'group.created', 'group.deleted',
	'security.alert', 'policy.changed', '*',
];

async function loadRules(kv: KVNamespace, tenantId: string): Promise<TriggerRule[]> {
	const raw = await kv.get(`triggers:${tenantId}`);
	return raw ? JSON.parse(raw) : [];
}

async function saveRules(kv: KVNamespace, tenantId: string, rules: TriggerRule[]): Promise<void> {
	await kv.put(`triggers:${tenantId}`, JSON.stringify(rules));
}

/** GET / — list trigger rules for tenant */
eventTriggers.get('/', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const rules = await loadRules(c.env.KV, tenantId);
	return c.json({ rules, total: rules.length });
});

/** POST / — create a trigger rule */
eventTriggers.post('/', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const body = await c.req.json<{
		eventType: string; resourceType: string; workflowId: string;
		conditions?: Record<string, unknown>; enabled?: boolean;
	}>();

	if (!body.eventType || !body.workflowId) {
		return c.json({ error: 'eventType and workflowId are required' }, 400);
	}
	if (!VALID_EVENT_TYPES.includes(body.eventType)) {
		return c.json({ error: `Invalid eventType. Valid: ${VALID_EVENT_TYPES.join(', ')}` }, 400);
	}

	if (body.conditions && Object.keys(body.conditions).length > 0) {
		const validation = validateConditionGroup(body.conditions);
		if (!validation.valid) {
			return c.json({ error: 'Invalid conditions', details: validation.errors }, 400);
		}
	}

	const rule: TriggerRule = {
		id: crypto.randomUUID(),
		eventType: body.eventType,
		resourceType: body.resourceType || '*',
		workflowId: body.workflowId,
		conditions: body.conditions,
		enabled: body.enabled ?? true,
		createdAt: new Date().toISOString(),
	};

	const rules = await loadRules(c.env.KV, tenantId);
	rules.push(rule);
	await saveRules(c.env.KV, tenantId, rules);

	return c.json({ message: 'Trigger rule created', rule });
});

/** PATCH /:id — update a trigger rule */
eventTriggers.patch('/:id', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const ruleId = c.req.param('id');
	const updates = await c.req.json<Partial<Pick<TriggerRule, 'enabled' | 'conditions' | 'eventType' | 'resourceType'>>>();

	const rules = await loadRules(c.env.KV, tenantId);
	const idx = rules.findIndex((r) => r.id === ruleId);
	if (idx === -1) return c.json({ error: 'Trigger rule not found' }, 404);

	if (updates.conditions && Object.keys(updates.conditions).length > 0) {
		const validation = validateConditionGroup(updates.conditions);
		if (!validation.valid) {
			return c.json({ error: 'Invalid conditions', details: validation.errors }, 400);
		}
	}

	rules[idx] = { ...rules[idx], ...updates };
	await saveRules(c.env.KV, tenantId, rules);

	return c.json({ message: 'Trigger rule updated', rule: rules[idx] });
});

/** DELETE /:id — remove a trigger rule */
eventTriggers.delete('/:id', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const ruleId = c.req.param('id');

	const rules = await loadRules(c.env.KV, tenantId);
	const filtered = rules.filter((r) => r.id !== ruleId);
	if (filtered.length === rules.length) return c.json({ error: 'Trigger rule not found' }, 404);

	await saveRules(c.env.KV, tenantId, filtered);
	return c.json({ message: 'Trigger rule deleted', ruleId });
});

/** POST /test — test a trigger rule against a sample event */
eventTriggers.post('/test', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const body = await c.req.json<{
		ruleId?: string;
		sampleEvent: { type: string; resource: string; data: Record<string, unknown> };
	}>();

	if (!body.sampleEvent) return c.json({ error: 'sampleEvent is required' }, 400);

	const rules = await loadRules(c.env.KV, tenantId);
	const rulesToTest = body.ruleId ? rules.filter((r) => r.id === body.ruleId) : rules;

	const event: WebhookEvent = {
		id: 'test-' + crypto.randomUUID(),
		type: body.sampleEvent.type,
		resource: body.sampleEvent.resource || '',
		resourceType: body.sampleEvent.type.split('.')[0] ?? '',
		data: body.sampleEvent.data || {},
		tenantId,
		receivedAt: new Date().toISOString(),
	};

	const matched = matchEvent(event, rulesToTest);
	const matchedConditions = matched.map((r) => `${r.eventType}:${r.resourceType}:${r.workflowId}`);

	return c.json({
		wouldTrigger: matched.length > 0,
		matchedRules: matched.length,
		matchedConditions,
	});
});

export { eventTriggers };
