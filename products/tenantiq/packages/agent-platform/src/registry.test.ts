import { describe, it, expect, beforeEach } from 'vitest';
import { registerTools, getTools, findTool, clearRegistry } from './registry';
import type { ToolDefinition } from './types';

describe('Tool Registry', () => {
	beforeEach(() => {
		clearRegistry();
	});

	const sampleTool: ToolDefinition = {
		name: 'test_tool',
		description: 'A test tool',
		inputSchema: { type: 'object', properties: {} },
		permission: 'read',
	};

	it('should register and find tools by qualified name', () => {
		registerTools('tenantiq', [sampleTool]);
		const found = findTool('tenantiq.test_tool');
		expect(found).toBeDefined();
		expect(found?.name).toBe('test_tool');
	});

	it('should return undefined for unknown tools', () => {
		expect(findTool('tenantiq.nonexistent')).toBeUndefined();
	});

	it('should list all tools when no namespace filter', () => {
		registerTools('tenantiq', [sampleTool]);
		registerTools('pushci', [{ ...sampleTool, name: 'ci_tool' }]);
		expect(getTools()).toHaveLength(2);
	});

	it('should filter tools by namespace', () => {
		registerTools('tenantiq', [sampleTool]);
		registerTools('pushci', [{ ...sampleTool, name: 'ci_tool' }]);
		const tiq = getTools('tenantiq');
		expect(tiq).toHaveLength(1);
		expect(tiq[0].qualifiedName).toBe('tenantiq.test_tool');
	});

	it('should overwrite on duplicate registration', () => {
		registerTools('tenantiq', [sampleTool]);
		registerTools('tenantiq', [{ ...sampleTool, description: 'Updated' }]);
		const found = findTool('tenantiq.test_tool');
		expect(found?.description).toBe('Updated');
	});
});
