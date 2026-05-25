import { describe, it, expect, beforeEach } from 'vitest';
import { executeRecipe, validateRecipe } from './orchestrator';
import { registerTools, clearRegistry } from './registry';
import { createSession, clearSessions } from './session';
import type { Recipe, AgentEvent, ToolDefinition } from './types';

const tool: ToolDefinition = {
	name: 'list_tenants',
	description: 'List tenants',
	inputSchema: { type: 'object', properties: {} },
	permission: 'read',
};

describe('Orchestrator', () => {
	beforeEach(() => {
		clearRegistry();
		clearSessions();
		registerTools('tenantiq', [tool, { ...tool, name: 'get_health_score' }]);
	});

	it('should execute a recipe and return results', async () => {
		const session = createSession('tenantiq', 't1', 'u1');
		const recipe: Recipe = {
			name: 'Test',
			description: 'test',
			steps: [{ tool: 'tenantiq.list_tenants', input: {} }],
		};
		const handler = async () => ({ output: '["t1"]', success: true });
		const result = await executeRecipe(session, recipe, handler);
		expect(result.success).toBe(true);
		expect(result.steps).toHaveLength(1);
	});

	it('should abort on failure when configured', async () => {
		const session = createSession('tenantiq', 't1', 'u1');
		const recipe: Recipe = {
			name: 'Abort',
			description: 'test',
			steps: [
				{ tool: 'tenantiq.list_tenants', input: {}, onFailure: 'abort' },
				{ tool: 'tenantiq.get_health_score', input: {} },
			],
		};
		const handler = async () => ({ output: 'fail', success: false });
		const result = await executeRecipe(session, recipe, handler);
		expect(result.success).toBe(false);
		expect(result.steps).toHaveLength(1);
	});

	it('should emit events during execution', async () => {
		const session = createSession('tenantiq', 't1', 'u1');
		const recipe: Recipe = {
			name: 'Events',
			description: 'test',
			steps: [{ tool: 'tenantiq.list_tenants', input: {} }],
		};
		const events: AgentEvent[] = [];
		const handler = async () => ({ output: 'ok', success: true });
		await executeRecipe(session, recipe, handler, (e) => events.push(e));
		expect(events.some((e) => e.type === 'tool_call')).toBe(true);
		expect(events.some((e) => e.type === 'turn_complete')).toBe(true);
	});

	it('should validate recipes for missing tools', () => {
		const recipe: Recipe = {
			name: 'Bad',
			description: 'test',
			steps: [{ tool: 'tenantiq.nonexistent', input: {} }],
		};
		const errors = validateRecipe(recipe);
		expect(errors).toHaveLength(1);
	});
});
