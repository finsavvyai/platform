import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb } from '../test/mock-db.js';
import { getAgentInventory, updateAgentRisk } from './agent-registry.js';

describe('Agent Registry - Inventory Operations', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe('getAgentInventory', () => {
    it('should query by userId correctly', async () => {
      mockDb._setSelectResult([
        {
          id: 'agent-1',
          userId: 'user-123',
          instanceId: 'instance-1',
          name: 'Agent 1',
          source: 'ide',
          owner: 'team-a',
          permissions: '["read"]',
          riskScore: 10,
          status: 'active',
          lastActiveAt: '2024-03-20T10:00:00Z',
          createdAt: '2024-03-19T10:00:00Z',
        },
      ]);

      const agents = await getAgentInventory(mockDb, 'user-123');

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('agent-1');
      expect(agents[0].name).toBe('Agent 1');
    });

    it('should parse permissions from JSON string', async () => {
      mockDb._setSelectResult([
        {
          id: 'agent-1',
          userId: 'user-123',
          name: 'Agent',
          source: 'copilot',
          permissions: '["read","write","execute"]',
          riskScore: 50,
          status: 'active',
          createdAt: '2024-03-19T10:00:00Z',
        },
      ]);

      const agents = await getAgentInventory(mockDb, 'user-123');

      expect(agents[0].permissions).toEqual(['read', 'write', 'execute']);
    });

    it('should return multiple agents for user', async () => {
      mockDb._setSelectResults([
        [
          {
            id: 'agent-1',
            userId: 'user-123',
            name: 'Agent 1',
            source: 'ide',
            permissions: '[]',
            riskScore: 10,
            status: 'active',
            createdAt: '2024-03-19T10:00:00Z',
          },
          {
            id: 'agent-2',
            userId: 'user-123',
            name: 'Agent 2',
            source: 'openai-sdk',
            permissions: '[]',
            riskScore: 30,
            status: 'active',
            createdAt: '2024-03-18T10:00:00Z',
          },
        ],
      ]);
      const agents = await getAgentInventory(mockDb, 'user-123');
      expect(agents).toHaveLength(2);
    });

    it('should handle null optional fields', async () => {
      mockDb._setSelectResult([
        {
          id: 'agent-1',
          userId: 'user-123',
          instanceId: null,
          name: 'Agent',
          source: 'mcp',
          owner: null,
          permissions: '[]',
          riskScore: 10,
          status: 'active',
          lastActiveAt: null,
          createdAt: '2024-03-19T10:00:00Z',
        },
      ]);

      const agents = await getAgentInventory(mockDb, 'user-123');

      expect(agents[0].instanceId).toBeUndefined();
      expect(agents[0].owner).toBeUndefined();
      expect(agents[0].lastActiveAt).toBeUndefined();
    });
  });

  describe('updateAgentRisk', () => {
    it('should update risk score correctly', async () => {
      await updateAgentRisk(mockDb, 'agent-123', 65);

      expect(mockDb.update).toHaveBeenCalled();
      const setChain = mockDb._updateSetChain;
      expect(setChain.where).toHaveBeenCalled();
    });

    it('should clamp risk score to max 100', async () => {
      await updateAgentRisk(mockDb, 'agent-123', 150);

      const setChain = mockDb._updateChain;
      const passedData = setChain.set.mock.calls[0][0];
      expect(passedData.riskScore).toBeLessThanOrEqual(100);
    });

    it('should clamp risk score to min 0', async () => {
      await updateAgentRisk(mockDb, 'agent-123', -10);

      const setChain = mockDb._updateChain;
      const passedData = setChain.set.mock.calls[0][0];
      expect(passedData.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should keep valid scores unchanged', async () => {
      await updateAgentRisk(mockDb, 'agent-123', 42);

      const setChain = mockDb._updateChain;
      const passedData = setChain.set.mock.calls[0][0];
      expect(passedData.riskScore).toBe(42);
    });
  });
});
