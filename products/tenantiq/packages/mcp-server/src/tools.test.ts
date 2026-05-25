import { describe, expect, it } from 'vitest';
import { TOOLS, findTool, listToolsPayload } from './tools';

describe('MCP Tool Definitions', () => {
  it('should define exactly 15 tools', () => {
    expect(TOOLS).toHaveLength(15);
  });

  it('should have no duplicate tool names', () => {
    const names = TOOLS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('should prefix all tool names with tenantiq.', () => {
    for (const tool of TOOLS) {
      expect(tool.name).toMatch(/^tenantiq\./);
    }
  });

  it('should have valid JSON Schema input for every tool', () => {
    for (const tool of TOOLS) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
      expect(typeof tool.inputSchema.properties).toBe('object');
    }
  });

  it('should have a non-empty description for every tool', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('should have a valid API method for every tool', () => {
    const validMethods = ['GET', 'POST', 'PATCH'];
    for (const tool of TOOLS) {
      expect(validMethods).toContain(tool.apiMethod);
    }
  });

  it('should have an API path starting with / for every tool', () => {
    for (const tool of TOOLS) {
      expect(tool.apiPath).toMatch(/^\//);
    }
  });

  it('should find a tool by name', () => {
    const tool = findTool('tenantiq.list_tenants');
    expect(tool).toBeDefined();
    expect(tool!.apiPath).toBe('/api/tenants');
  });

  it('should return undefined for unknown tool name', () => {
    expect(findTool('tenantiq.nonexistent')).toBeUndefined();
  });

  it('should return tools/list payload with correct shape', () => {
    const payload = listToolsPayload();
    expect(payload.tools).toHaveLength(15);
    for (const t of payload.tools) {
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('description');
      expect(t).toHaveProperty('inputSchema');
      // Should not leak apiMethod/apiPath
      expect(t).not.toHaveProperty('apiMethod');
      expect(t).not.toHaveProperty('apiPath');
    }
  });

  it('should require path params where needed', () => {
    const dashTool = findTool('tenantiq.get_dashboard');
    expect(dashTool!.inputSchema.required).toContain('tenantId');

    const ackTool = findTool('tenantiq.acknowledge_alert');
    expect(ackTool!.inputSchema.required).toContain('alertId');
  });
});
