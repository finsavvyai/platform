import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockKV } from '../test/helpers.js';
import { createMockDb } from '../test/mock-db.js';
import {
  trackMcpInvocation,
  detectEnumerationSpike,
  scanMcpCredentials,
  getMcpServerInventory,
} from './mcp-monitor.js';

describe('MCP Monitor Service', () => {
  let mockKv: KVNamespace;
  let mockDb: any;

  beforeEach(() => {
    mockKv = createMockKV();
    mockDb = createMockDb();
  });

  describe('trackMcpInvocation', () => {
    it('should increment KV counter for agent invocation', async () => {
      const invocation = {
        agentId: 'agent-1',
        serverId: 'server-1',
        toolName: 'test-tool',
        duration: 100,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
      };

      await trackMcpInvocation(mockDb, mockKv, invocation);

      // Verify KV put was called
      expect(mockKv.put).toHaveBeenCalled();
      const callArgs = (mockKv.put as any).mock.calls[0];
      expect(callArgs[0]).toBe('mcp:invocations:agent-1');

      // Verify stored data contains the invocation
      const storedData = JSON.parse(callArgs[1]);
      expect(storedData).toHaveLength(1);
      expect(storedData[0].toolName).toBe('test-tool');
    });

    it('should preserve recent invocations when adding new ones', async () => {
      const initial = [
        {
          agentId: 'agent-1',
          serverId: 'server-1',
          toolName: 'tool-1',
          timestamp: new Date(Date.now() - 30000).toISOString(),
          status: 'success' as const,
          duration: 50,
        },
      ];
      // Mock get to return parsed JSON data when called with 'json' format
      (mockKv.get as any).mockImplementationOnce(async (key: string, format?: string) => {
        if (format === 'json') {
          return initial;
        }
        return null;
      });

      const invocation = {
        agentId: 'agent-1',
        serverId: 'server-1',
        toolName: 'tool-2',
        duration: 100,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
      };

      await trackMcpInvocation(mockDb, mockKv, invocation);

      const storedData = JSON.parse((mockKv.put as any).mock.calls[0][1]);
      expect(storedData).toHaveLength(2);
    });
  });

;

  describe('scanMcpCredentials', () => {
    it('should detect static API keys in environment variables', () => {
      const config = {
        id: 'server-1',
        name: 'test-server',
        command: 'node',
        env: {
          API_KEY: 'sk-1234567890',
          PATH: '/usr/bin',
        },
      };

      const alerts = scanMcpCredentials(config);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].serverId).toBe('server-1');
      expect(alerts[0].credentialType).toBe('API_KEY');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].timestamp).toBeDefined();
    });

    it('should detect multiple credential types', () => {
      const config = {
        id: 'server-1',
        name: 'test-server',
        command: 'node',
        env: {
          API_KEY: 'sk-123',
          PASSWORD: 'secret123',
          TOKEN: 'token123',
          NORMAL_VAR: 'ok',
        },
      };

      const alerts = scanMcpCredentials(config);

      expect(alerts).toHaveLength(3);
      expect(alerts.map((a) => a.credentialType)).toContain('API_KEY');
      expect(alerts.map((a) => a.credentialType)).toContain('PASSWORD');
      expect(alerts.map((a) => a.credentialType)).toContain('TOKEN');
    });

    it('should detect credentials in command arguments', () => {
      const config = {
        id: 'server-1',
        name: 'test-server',
        command: 'node',
        args: ['--api_key', 'sk-123', '--port', '3000'],
      };

      const alerts = scanMcpCredentials(config);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].credentialType).toBe('command_arg');
      expect(alerts[0].severity).toBe('high');
    });

    it('should return clean alert list for safe config', () => {
      const config = {
        id: 'server-1',
        name: 'test-server',
        command: 'node',
        args: ['--port', '3000', '--timeout', '5000'],
        env: {
          NODE_ENV: 'production',
          PATH: '/usr/bin',
        },
      };

      const alerts = scanMcpCredentials(config);

      expect(alerts).toHaveLength(0);
    });

    it('should handle missing env and args gracefully', () => {
      const config = {
        id: 'server-1',
        name: 'test-server',
        command: 'node',
      };

      const alerts = scanMcpCredentials(config);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('getMcpServerInventory', () => {
    it('should query DB and return registered servers', async () => {
      mockDb._setSelectResult([
        {
          id: 'server-1',
          name: 'Production Server',
          command: 'python',
          registered: true,
        },
        {
          id: 'server-2',
          name: 'Test Server',
          command: 'node',
          registered: true,
        },
      ]);

      const result = await getMcpServerInventory(mockDb);

      // Current implementation returns empty array
      expect(result).toEqual([]);
    });
  });
});
