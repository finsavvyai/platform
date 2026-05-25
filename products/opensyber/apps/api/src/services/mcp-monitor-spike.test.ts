import { describe, it, expect, beforeEach } from 'vitest';
import { createMockKV } from '../test/helpers.js';
import { createMockDb } from '../test/mock-db.js';
import { detectEnumerationSpike } from './mcp-monitor.js';

describe('MCP Monitor - Enumeration Spike Detection', () => {
  let mockKv: KVNamespace;
  let mockDb: any;

  beforeEach(() => {
    mockKv = createMockKV();
    mockDb = createMockDb();
  });

  it('should return null when invocations are below threshold', async () => {
    const invocations = Array.from({ length: 5 }, (_, i) => ({
      agentId: 'agent-1',
      serverId: `server-${i}`,
      toolName: `tool-${i}`,
      timestamp: new Date().toISOString(),
      status: 'success' as const,
      duration: 50,
    }));

    (mockKv.get as any).mockResolvedValueOnce(invocations);

    const result = await detectEnumerationSpike(mockKv, 'agent-1');

    expect(result).toBeNull();
  });

  it('should return high severity alert when >10 calls in 1 minute', async () => {
    const invocations = Array.from({ length: 15 }, (_, i) => ({
      agentId: 'agent-1',
      serverId: `server-${i}`,
      toolName: `tool-${i}`,
      timestamp: new Date().toISOString(),
      status: 'success' as const,
      duration: 50,
    }));

    (mockKv.get as any).mockResolvedValueOnce(invocations);

    const result = await detectEnumerationSpike(mockKv, 'agent-1');

    expect(result).not.toBeNull();
    expect(result?.count).toBe(15);
    expect(result?.severity).toBe('high');
    expect(result?.timeWindowMs).toBe(60000);
  });

  it('should return critical severity when >20 calls in 1 minute', async () => {
    const invocations = Array.from({ length: 25 }, (_, i) => ({
      agentId: 'agent-1',
      serverId: `server-${i}`,
      toolName: `tool-${i}`,
      timestamp: new Date().toISOString(),
      status: 'success' as const,
      duration: 50,
    }));

    (mockKv.get as any).mockResolvedValueOnce(invocations);

    const result = await detectEnumerationSpike(mockKv, 'agent-1');

    expect(result?.severity).toBe('critical');
    expect(result?.count).toBe(25);
  });

  it('should filter out old invocations outside time window', async () => {
    const now = Date.now();
    const invocations = [
      {
        agentId: 'agent-1',
        serverId: 'server-old',
        toolName: 'tool-old',
        timestamp: new Date(now - 120000).toISOString(),
        status: 'success' as const,
        duration: 50,
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        agentId: 'agent-1',
        serverId: `server-${i}`,
        toolName: `tool-${i}`,
        timestamp: new Date(now - 10000).toISOString(),
        status: 'success' as const,
        duration: 50,
      })),
    ];

    (mockKv.get as any).mockResolvedValueOnce(invocations);

    const result = await detectEnumerationSpike(mockKv, 'agent-1');

    expect(result).toBeNull();
  });

  it('should include agentId in alert', async () => {
    const invocations = Array.from({ length: 15 }, (_, i) => ({
      agentId: 'agent-xyz',
      serverId: `server-${i}`,
      toolName: `tool-${i}`,
      timestamp: new Date().toISOString(),
      status: 'success' as const,
      duration: 50,
    }));

    (mockKv.get as any).mockResolvedValueOnce(invocations);

    const result = await detectEnumerationSpike(mockKv, 'agent-xyz');

    expect(result?.agentId).toBe('agent-xyz');
  });
});
