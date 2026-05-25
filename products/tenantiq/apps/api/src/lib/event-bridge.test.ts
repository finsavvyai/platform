import { describe, expect, it } from 'vitest';
import { matchEvent, type TriggerRule, type WebhookEvent } from './event-bridge';

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
	return {
		id: 'evt-1',
		type: 'user.created',
		resource: 'users/123',
		resourceType: 'users',
		data: { changeType: 'created' },
		tenantId: 't1',
		receivedAt: new Date().toISOString(),
		...overrides,
	};
}

function makeRule(overrides: Partial<TriggerRule> = {}): TriggerRule {
	return {
		id: 'rule-1',
		eventType: 'user.created',
		resourceType: 'users',
		workflowId: 'wf-1',
		enabled: true,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

describe('matchEvent', () => {
	it('matches event by type and resourceType', () => {
		const event = makeEvent();
		const rules = [makeRule()];
		const matched = matchEvent(event, rules);
		expect(matched).toHaveLength(1);
		expect(matched[0].id).toBe('rule-1');
	});

	it('returns empty when event type does not match', () => {
		const event = makeEvent({ type: 'group.deleted' });
		const rules = [makeRule()];
		expect(matchEvent(event, rules)).toHaveLength(0);
	});

	it('disabled rule is not matched', () => {
		const event = makeEvent();
		const rules = [makeRule({ enabled: false })];
		expect(matchEvent(event, rules)).toHaveLength(0);
	});

	it('wildcard eventType matches any event', () => {
		const event = makeEvent({ type: 'security.alert' });
		const rules = [makeRule({ eventType: '*', resourceType: '*' })];
		expect(matchEvent(event, rules)).toHaveLength(1);
	});

	it('wildcard resourceType matches any resource', () => {
		const event = makeEvent({ resourceType: 'groups' });
		const rules = [makeRule({ eventType: 'user.created', resourceType: '*' })];
		expect(matchEvent(event, rules)).toHaveLength(1);
	});

	it('condition-based matching filters with evaluateConditions', () => {
		const event = makeEvent({ data: { changeType: 'created', severity: 'high' } });
		const rules = [
			makeRule({
				conditions: {
					logic: 'and',
					conditions: [{ field: 'severity', operator: 'equals', value: 'high' }],
				} as any,
			}),
		];
		expect(matchEvent(event, rules)).toHaveLength(1);
	});

	it('condition-based matching rejects non-matching data', () => {
		const event = makeEvent({ data: { changeType: 'created', severity: 'low' } });
		const rules = [
			makeRule({
				conditions: {
					logic: 'and',
					conditions: [{ field: 'severity', operator: 'equals', value: 'high' }],
				} as any,
			}),
		];
		expect(matchEvent(event, rules)).toHaveLength(0);
	});

	it('matches multiple rules', () => {
		const event = makeEvent();
		const rules = [
			makeRule({ id: 'r1' }),
			makeRule({ id: 'r2', workflowId: 'wf-2' }),
		];
		expect(matchEvent(event, rules)).toHaveLength(2);
	});

	it('empty rules returns empty', () => {
		const event = makeEvent();
		expect(matchEvent(event, [])).toHaveLength(0);
	});

	it('rule without conditions matches if type/resource match', () => {
		const event = makeEvent();
		const rules = [makeRule({ conditions: undefined })];
		expect(matchEvent(event, rules)).toHaveLength(1);
	});

	it('rule with empty conditions object still matches', () => {
		const event = makeEvent();
		const rules = [makeRule({ conditions: {} })];
		expect(matchEvent(event, rules)).toHaveLength(1);
	});
});
