import { describe, it, expect, vi } from 'vitest';
import { isValidTool, getToolDefinitions, executeToolCall } from './openhands-client';

describe('isValidTool', () => {
    it('accepts supported tools', () => {
        expect(isValidTool('bash')).toBe(true);
        expect(isValidTool('read_file')).toBe(true);
        expect(isValidTool('write_file')).toBe(true);
        expect(isValidTool('edit_file')).toBe(true);
        expect(isValidTool('browse')).toBe(true);
    });

    it('rejects unknown tools', () => {
        expect(isValidTool('eval')).toBe(false);
        expect(isValidTool('rm_rf')).toBe(false);
        expect(isValidTool('')).toBe(false);
    });
});

describe('getToolDefinitions', () => {
    it('returns 5 tool definitions', () => {
        const tools = getToolDefinitions();
        expect(tools).toHaveLength(5);
        expect(tools.map((t) => t.name)).toEqual([
            'bash', 'read_file', 'write_file', 'edit_file', 'browse',
        ]);
    });

    it('each tool has name, description, and input_schema', () => {
        for (const tool of getToolDefinitions()) {
            expect(tool.name).toBeDefined();
            expect(tool.description).toBeDefined();
            expect(tool.input_schema).toBeDefined();
        }
    });
});

describe('executeToolCall', () => {
    it('rejects unknown tool names', async () => {
        const result = await executeToolCall(
            { apiUrl: 'http://localhost:8000' },
            { name: 'dangerous_eval', input: {} },
        );
        expect(result.success).toBe(false);
        expect(result.output).toContain('Unknown tool');
    });

    it('handles network failures gracefully', async () => {
        const result = await executeToolCall(
            { apiUrl: 'http://localhost:99999', timeoutMs: 1000 },
            { name: 'bash', input: { command: 'echo test' } },
        );
        expect(result.success).toBe(false);
        expect(result.output).toContain('Execution failed');
        expect(result.durationMs).toBeGreaterThan(0);
    });
});
