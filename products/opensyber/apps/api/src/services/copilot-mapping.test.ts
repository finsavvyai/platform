import { describe, it, expect } from 'vitest';
import {
  mapCopilotOperation,
  extractCopilotInteractionDetails,
  COPILOT_STUDIO_OPERATIONS,
} from './copilot-studio.js';

describe('Copilot Studio - Operation Mapping', () => {
  it('should map AgentCreated to info severity', () => {
    const result = mapCopilotOperation(COPILOT_STUDIO_OPERATIONS.AGENT_CREATED);
    expect(result.severity).toBe('info');
    expect(result.category).toBe('lifecycle');
  });

  it('should map AgentPublished to low severity', () => {
    const result = mapCopilotOperation(COPILOT_STUDIO_OPERATIONS.AGENT_PUBLISHED);
    expect(result.severity).toBe('low');
    expect(result.category).toBe('lifecycle');
  });

  it('should map AgentDeleted to medium severity', () => {
    const result = mapCopilotOperation(COPILOT_STUDIO_OPERATIONS.AGENT_DELETED);
    expect(result.severity).toBe('medium');
    expect(result.category).toBe('lifecycle');
  });

  it('should map PolicyViolation to high severity', () => {
    const result = mapCopilotOperation(COPILOT_STUDIO_OPERATIONS.POLICY_VIOLATION);
    expect(result.severity).toBe('high');
    expect(result.category).toBe('policy');
  });

  it('should map DataAccess to medium severity', () => {
    const result = mapCopilotOperation(COPILOT_STUDIO_OPERATIONS.DATA_ACCESS);
    expect(result.severity).toBe('medium');
    expect(result.category).toBe('access');
  });

  it('should map AgentConfigured to info severity', () => {
    const result = mapCopilotOperation(COPILOT_STUDIO_OPERATIONS.AGENT_CONFIGURED);
    expect(result.severity).toBe('info');
    expect(result.category).toBe('config');
  });

  it('should map PluginAdded to low severity', () => {
    const result = mapCopilotOperation(COPILOT_STUDIO_OPERATIONS.PLUGIN_ADDED);
    expect(result.severity).toBe('low');
    expect(result.category).toBe('plugin');
  });

  it('should return default info/unknown for unmapped operation', () => {
    const result = mapCopilotOperation('UnknownOperation');
    expect(result.severity).toBe('info');
    expect(result.category).toBe('unknown');
  });

  describe('extractCopilotInteractionDetails', () => {
    it('should extract before/after modifications', () => {
      const details = {
        ModificationsBefore: { Name: 'OldName' },
        ModificationsAfter: { Name: 'NewName' },
        PluginNames: ['plugin-1', 'plugin-2'],
      };

      const result = extractCopilotInteractionDetails(details);

      expect(result.modificationsBefore).toEqual({ Name: 'OldName' });
      expect(result.modificationsAfter).toEqual({ Name: 'NewName' });
      expect(result.pluginNames).toEqual(['plugin-1', 'plugin-2']);
    });

    it('should return empty object when details undefined', () => {
      const result = extractCopilotInteractionDetails(undefined);
      expect(result).toEqual({});
    });

    it('should handle null plugin names', () => {
      const details = {
        ModificationsBefore: { Setting: 'value' },
        PluginNames: null,
      };
      const result = extractCopilotInteractionDetails(details);
      expect(result.modificationsBefore).toEqual({ Setting: 'value' });
      expect(result.pluginNames).toBeNull();
    });
  });

  describe('COPILOT_STUDIO_OPERATIONS', () => {
    it('should contain all expected operations', () => {
      expect(COPILOT_STUDIO_OPERATIONS.AGENT_CREATED).toBe('AgentCreated');
      expect(COPILOT_STUDIO_OPERATIONS.AGENT_PUBLISHED).toBe('AgentPublished');
      expect(COPILOT_STUDIO_OPERATIONS.AGENT_DELETED).toBe('AgentDeleted');
      expect(COPILOT_STUDIO_OPERATIONS.POLICY_VIOLATION).toBe('PolicyViolation');
      expect(COPILOT_STUDIO_OPERATIONS.DATA_ACCESS).toBe('DataAccess');
      expect(COPILOT_STUDIO_OPERATIONS.AGENT_CONFIGURED).toBe('AgentConfigured');
      expect(COPILOT_STUDIO_OPERATIONS.PLUGIN_ADDED).toBe('PluginAdded');
    });

    it('should have exactly 7 operations', () => {
      const ops = Object.values(COPILOT_STUDIO_OPERATIONS);
      expect(ops).toHaveLength(7);
    });
  });
});
