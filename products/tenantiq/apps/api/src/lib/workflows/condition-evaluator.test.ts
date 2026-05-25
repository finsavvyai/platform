import { describe, expect, it } from 'vitest';
import { evaluateConditions, validateConditionGroup } from './condition-evaluator';
import type { ConditionGroup } from './condition-evaluator';

describe('evaluateConditions', () => {
	const data = { type: 'alert', severity: 'high', count: 5, nested: { val: 'deep' } };

	it('equals operator matches', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'type', operator: 'equals', value: 'alert' }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('not_equals operator matches', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'type', operator: 'not_equals', value: 'info' }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('contains operator matches substring', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'severity', operator: 'contains', value: 'hi' }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('gt operator compares numbers', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'count', operator: 'gt', value: 3 }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('lt operator compares numbers', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'count', operator: 'lt', value: 10 }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('regex operator matches pattern', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'type', operator: 'regex', value: '^ale' }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('in operator checks membership', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'severity', operator: 'in', value: ['high', 'critical'] }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('not_in operator checks exclusion', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'severity', operator: 'not_in', value: ['low', 'medium'] }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('AND logic requires all conditions true', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [
				{ field: 'type', operator: 'equals', value: 'alert' },
				{ field: 'severity', operator: 'equals', value: 'low' },
			],
		};
		expect(evaluateConditions(data, group)).toBe(false);
	});

	it('OR logic requires any condition true', () => {
		const group: ConditionGroup = {
			logic: 'or',
			conditions: [
				{ field: 'type', operator: 'equals', value: 'wrong' },
				{ field: 'severity', operator: 'equals', value: 'high' },
			],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('nested condition groups work', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [
				{ field: 'type', operator: 'equals', value: 'alert' },
				{
					logic: 'or',
					conditions: [
						{ field: 'count', operator: 'gt', value: 100 },
						{ field: 'severity', operator: 'equals', value: 'high' },
					],
				},
			],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('missing field returns false for contains', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'missing', operator: 'contains', value: 'x' }],
		};
		expect(evaluateConditions(data, group)).toBe(false);
	});

	it('nested path access works', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'nested.val', operator: 'equals', value: 'deep' }],
		};
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('empty conditions returns true', () => {
		const group: ConditionGroup = { logic: 'and', conditions: [] };
		expect(evaluateConditions(data, group)).toBe(true);
	});

	it('regex over 200 chars returns false', () => {
		const group: ConditionGroup = {
			logic: 'and',
			conditions: [{ field: 'type', operator: 'regex', value: 'a'.repeat(201) }],
		};
		expect(evaluateConditions(data, group)).toBe(false);
	});
});

describe('validateConditionGroup', () => {
	it('valid group returns valid true', () => {
		const result = validateConditionGroup({
			logic: 'and',
			conditions: [{ field: 'x', operator: 'equals', value: 1 }],
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('non-object returns invalid', () => {
		const result = validateConditionGroup(null);
		expect(result.valid).toBe(false);
	});

	it('invalid logic returns error', () => {
		const result = validateConditionGroup({ logic: 'xor', conditions: [] });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('logic'))).toBe(true);
	});

	it('missing conditions array returns error', () => {
		const result = validateConditionGroup({ logic: 'and' });
		expect(result.valid).toBe(false);
	});

	it('invalid operator returns error', () => {
		const result = validateConditionGroup({
			logic: 'and',
			conditions: [{ field: 'x', operator: 'nope', value: 1 }],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('operator'))).toBe(true);
	});

	it('missing field returns error', () => {
		const result = validateConditionGroup({
			logic: 'and',
			conditions: [{ operator: 'equals', value: 1 }],
		});
		expect(result.valid).toBe(false);
	});

	it('missing value returns error', () => {
		const result = validateConditionGroup({
			logic: 'and',
			conditions: [{ field: 'x', operator: 'equals' }],
		});
		expect(result.valid).toBe(false);
	});
});
