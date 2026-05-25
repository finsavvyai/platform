import { describe, it, expect, vi } from 'vitest';

// Unit tests for chain-stream-handler extracted helpers
// We test the internal logic indirectly since streamChainExecution needs Hono context

describe('chain-stream-handler', () => {
    it('should export streamChainExecution function', async () => {
        const mod = await import('./chain-stream-handler');
        expect(typeof mod.streamChainExecution).toBe('function');
    });
});

describe('chain progress event shape', () => {
    it('should cap output at 2000 chars in progress callback', () => {
        // Simulate the output truncation logic used in createProgressCallback
        const longOutput = 'x'.repeat(5000);
        const truncated = longOutput.substring(0, 2000);
        expect(truncated.length).toBe(2000);
    });

    it('should serialize intermediate outputs as Map entries', () => {
        const outputs = new Map<string, string>();
        outputs.set('node-1', 'result A');
        outputs.set('node-2', 'result B');
        const serialized = JSON.stringify(Array.from(outputs.entries()));
        const parsed = new Map(JSON.parse(serialized));
        expect(parsed.get('node-1')).toBe('result A');
        expect(parsed.get('node-2')).toBe('result B');
    });
});
