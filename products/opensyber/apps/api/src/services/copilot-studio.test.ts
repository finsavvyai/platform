import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb } from '../test/mock-db.js';
import {
  mapCopilotOperation,
  processCopilotStudioEvent,
  extractCopilotInteractionDetails,
  COPILOT_STUDIO_OPERATIONS,
} from './copilot-studio.js';

describe('Copilot Studio Service', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe('processCopilotStudioEvent', () => {
    it('should create integration event with correct fields', async () => {
      const record = {
        RecordType: 'CopilotStudio' as const,
        CreationTime: '2024-03-20T10:00:00Z',
        UserId: 'user-123',
        Operation: COPILOT_STUDIO_OPERATIONS.AGENT_CREATED,
        ObjectId: 'agent-xyz',
        Details: {
          AgentId: 'agent-xyz',
          AgentName: 'Sales Copilot',
        },
      };

      const event = await processCopilotStudioEvent(mockDb, record);

      expect(event.agentName).toBe('agent-xyz');
      expect(event.userId).toBe('user-123');
      expect(event.operation).toBe(COPILOT_STUDIO_OPERATIONS.AGENT_CREATED);
      expect(event.severity).toBe('info');
      expect(event.timestamp).toBe('2024-03-20T10:00:00Z');
    });

    it('should use Unknown Agent when ObjectId is missing', async () => {
      const record = {
        RecordType: 'CopilotStudio' as const,
        CreationTime: '2024-03-20T10:00:00Z',
        UserId: 'user-123',
        Operation: COPILOT_STUDIO_OPERATIONS.AGENT_PUBLISHED,
        Details: {},
      };

      const event = await processCopilotStudioEvent(mockDb, record);

      expect(event.agentName).toBe('Unknown Agent');
    });

    it('should include category in details from mapping', async () => {
      const record = {
        RecordType: 'CopilotStudio' as const,
        CreationTime: '2024-03-20T10:00:00Z',
        UserId: 'user-123',
        Operation: COPILOT_STUDIO_OPERATIONS.POLICY_VIOLATION,
        ObjectId: 'agent-xyz',
        Details: {
          ViolationType: 'DataAccess',
        },
      };

      const event = await processCopilotStudioEvent(mockDb, record);

      expect(event.details.category).toBe('policy');
      expect(event.details.ViolationType).toBe('DataAccess');
    });

    it('should handle policy violation with high severity', async () => {
      const record = {
        RecordType: 'CopilotStudio' as const,
        CreationTime: '2024-03-20T10:00:00Z',
        UserId: 'user-456',
        Operation: COPILOT_STUDIO_OPERATIONS.POLICY_VIOLATION,
        ObjectId: 'agent-abc',
        Details: {
          PolicyName: 'DataProtection',
          Status: 'Violated',
        },
      };

      const event = await processCopilotStudioEvent(mockDb, record);

      expect(event.severity).toBe('high');
      expect(event.details.PolicyName).toBe('DataProtection');
    });

    it('should handle deletion with medium severity', async () => {
      const record = {
        RecordType: 'CopilotStudio' as const,
        CreationTime: '2024-03-20T11:00:00Z',
        UserId: 'admin-789',
        Operation: COPILOT_STUDIO_OPERATIONS.AGENT_DELETED,
        ObjectId: 'agent-to-delete',
        Details: {
          Reason: 'NoLongerNeeded',
        },
      };

      const event = await processCopilotStudioEvent(mockDb, record);

      expect(event.severity).toBe('medium');
      expect(event.details.Reason).toBe('NoLongerNeeded');
    });
  });
});
