/**
 * Advanced Condition Evaluator
 *
 * Supports recursive AND/OR condition groups with multiple operators
 * for webhook-to-workflow trigger rule matching.
 */

export interface Condition {
	field: string;
	operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'regex' | 'in' | 'not_in';
	value: unknown;
}

export interface ConditionGroup {
	logic: 'and' | 'or';
	conditions: (Condition | ConditionGroup)[];
}

function isConditionGroup(item: Condition | ConditionGroup): item is ConditionGroup {
	return 'logic' in item && 'conditions' in item;
}

function getNestedValue(data: Record<string, unknown>, path: string): unknown {
	const parts = path.split('.');
	let current: unknown = data;
	for (const part of parts) {
		if (current === null || current === undefined) return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function evaluateSingle(data: Record<string, unknown>, condition: Condition): boolean {
	const fieldValue = getNestedValue(data, condition.field);
	const { operator, value } = condition;

	switch (operator) {
		case 'equals':
			return fieldValue === value;
		case 'not_equals':
			return fieldValue !== value;
		case 'contains': {
			if (typeof fieldValue !== 'string' || typeof value !== 'string') return false;
			return fieldValue.includes(value);
		}
		case 'gt': {
			if (typeof fieldValue !== 'number' || typeof value !== 'number') return false;
			return fieldValue > value;
		}
		case 'lt': {
			if (typeof fieldValue !== 'number' || typeof value !== 'number') return false;
			return fieldValue < value;
		}
		case 'regex': {
			if (typeof fieldValue !== 'string' || typeof value !== 'string') return false;
			if (value.length > 200) return false; // Prevent ReDoS via complex patterns
			try {
				return new RegExp(value).test(fieldValue);
			} catch {
				return false;
			}
		}
		case 'in': {
			if (!Array.isArray(value)) return false;
			return value.includes(fieldValue);
		}
		case 'not_in': {
			if (!Array.isArray(value)) return false;
			return !value.includes(fieldValue);
		}
		default:
			return false;
	}
}

/** Recursively evaluate a condition group against data */
export function evaluateConditions(data: Record<string, unknown>, group: ConditionGroup): boolean {
	if (!group.conditions || group.conditions.length === 0) return true;

	const results = group.conditions.map((item) => {
		if (isConditionGroup(item)) {
			return evaluateConditions(data, item);
		}
		return evaluateSingle(data, item);
	});

	return group.logic === 'and'
		? results.every(Boolean)
		: results.some(Boolean);
}

/** Validate a condition group structure before saving */
export function validateConditionGroup(group: unknown): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!group || typeof group !== 'object') {
		return { valid: false, errors: ['Condition group must be an object'] };
	}

	const g = group as Record<string, unknown>;
	if (g.logic !== 'and' && g.logic !== 'or') {
		errors.push('logic must be "and" or "or"');
	}

	if (!Array.isArray(g.conditions)) {
		errors.push('conditions must be an array');
		return { valid: false, errors };
	}

	const validOperators = ['equals', 'not_equals', 'contains', 'gt', 'lt', 'regex', 'in', 'not_in'];

	for (let i = 0; i < g.conditions.length; i++) {
		const item = g.conditions[i] as Record<string, unknown>;
		if ('logic' in item) {
			const nested = validateConditionGroup(item);
			if (!nested.valid) {
				errors.push(...nested.errors.map((e) => `conditions[${i}]: ${e}`));
			}
		} else {
			if (!item.field || typeof item.field !== 'string') {
				errors.push(`conditions[${i}]: field must be a non-empty string`);
			}
			if (!validOperators.includes(item.operator as string)) {
				errors.push(`conditions[${i}]: operator must be one of ${validOperators.join(', ')}`);
			}
			if (item.value === undefined) {
				errors.push(`conditions[${i}]: value is required`);
			}
		}
	}

	return { valid: errors.length === 0, errors };
}
