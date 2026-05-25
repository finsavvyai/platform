import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDb } from '../test/mock-db.js';
import {
  getAgentInventory,
  registerAgent,
  updateAgentRisk,
  getAgentDetail,
  AGENT_SOURCES,
  AGENT_STATUS,
} from './agent-registry.js';

describe('Agent Registry Service', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.spyOn(global.crypto, 'getRandomValues').mockReturnValue(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
    );
  });

  describe('AGENT_SOURCES', () => {
    it('should contain all expected sources', () => {
      expect(AGENT_SOURCES.IDE).toBe('ide');
      expect(AGENT_SOURCES.COPILOT).toBe('copilot');
      expect(AGENT_SOURCES.OPENAI_SDK).toBe('openai-sdk');
      expect(AGENT_SOURCES.LANGSMITH).toBe('langsmith');
      expect(AGENT_SOURCES.MCP).toBe('mcp');
    });

    it('should have exactly 5 sources', () => {
      const sources = Object.values(AGENT_SOURCES);
      expect(sources).toHaveLength(5);
    });
  });

  describe('AGENT_STATUS', () => {
    it('should contain all expected statuses', () => {
      expect(AGENT_STATUS.ACTIVE).toBe('active');
      expect(AGENT_STATUS.INACTIVE).toBe('inactive');
      expect(AGENT_STATUS.SUSPENDED).toBe('suspended');
    });

    it('should have exactly 3 statuses', () => {
      const statuses = Object.values(AGENT_STATUS);
      expect(statuses).toHaveLength(3);
    });
  });

  describe('registerAgent', () => {
    it('should insert into DB with correct fields', async () => {
      const agent = {
        userId: 'user-123',
        instanceId: 'instance-456',
        name: 'Test Agent',
        source: 'ide' as const,
        owner: 'dev-team',
        permissions: ['read', 'execute'],
        riskScore: 25,
        status: 'active' as const,
        lastActiveAt: '2024-03-20T10:00:00Z',
      };

      const result = await registerAgent(mockDb, agent);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.name).toBe('Test Agent');
      expect(result.userId).toBe('user-123');
    });

    it('should stringify permissions before insert', async () => {
      const agent = {
        userId: 'user-123',
        name: 'Agent',
        source: 'copilot' as const,
        owner: 'team',
        permissions: ['read', 'write'],
        riskScore: 10,
        status: 'active' as const,
      };

      await registerAgent(mockDb, agent);

      const insertChain = mockDb._insertChain;
      const passedValues = insertChain.values.mock.calls[0][0];
      expect(typeof passedValues.permissions).toBe('string');
    });

    it('should set createdAt to current ISO time', async () => {
      const agent = {
        userId: 'user-123',
        name: 'Agent',
        source: 'openai-sdk' as const,
        permissions: [],
        riskScore: 0,
        status: 'active' as const,
      };

      const before = new Date();
      const result = await registerAgent(mockDb, agent);
      const after = new Date();

      const resultTime = new Date(result.createdAt);
      expect(resultTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(resultTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

;

  describe('getAgentDetail', () => {
    it('should return agent when found', async () => {
      mockDb._setSelectResult([
        {
          id: 'agent-123',
          userId: 'user-abc',
          instanceId: 'instance-xyz',
          name: 'MyAgent',
          source: 'ide',
          owner: 'team-x',
          permissions: '["read","write"]',
          riskScore: 35,
          status: 'active',
          lastActiveAt: '2024-03-20T12:00:00Z',
          createdAt: '2024-03-19T10:00:00Z',
        },
      ]);

      const agent = await getAgentDetail(mockDb, 'agent-123');

      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('MyAgent');
      expect(agent?.permissions).toEqual(['read', 'write']);
    });

    it('should return null when agent not found', async () => {
      mockDb._setSelectResult([]);

      const agent = await getAgentDetail(mockDb, 'unknown-agent');

      expect(agent).toBeNull();
    });

    it('should parse all fields correctly', async () => {
      mockDb._setSelectResult([
        {
          id: 'agent-1',
          userId: 'user-1',
          instanceId: null,
          name: 'TestAgent',
          source: 'langsmith',
          owner: null,
          permissions: '[]',
          riskScore: 50,
          status: 'suspended',
          lastActiveAt: null,
          createdAt: '2024-03-20T10:00:00Z',
        },
      ]);

      const agent = await getAgentDetail(mockDb, 'agent-1');

      expect(agent?.instanceId).toBeUndefined();
      expect(agent?.owner).toBeUndefined();
      expect(agent?.lastActiveAt).toBeUndefined();
    });
  });
});
