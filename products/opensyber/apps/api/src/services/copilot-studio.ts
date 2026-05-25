/**
 * Copilot Studio Monitoring Service
 * Processes M365 Management Activity API CopilotStudio records
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';

export interface CopilotStudioRecord {
  RecordType: 'CopilotStudio';
  CreationTime: string;
  UserId: string;
  Operation: string;
  ObjectId?: string;
  Details?: Record<string, any>;
}

export interface NormalizedCopilotEvent {
  agentName: string;
  userId: string;
  operation: string;
  severity: string;
  details: Record<string, any>;
  timestamp: string;
}

export const COPILOT_STUDIO_OPERATIONS = {
  AGENT_CREATED: 'AgentCreated',
  AGENT_PUBLISHED: 'AgentPublished',
  AGENT_DELETED: 'AgentDeleted',
  POLICY_VIOLATION: 'PolicyViolation',
  DATA_ACCESS: 'DataAccess',
  AGENT_CONFIGURED: 'AgentConfigured',
  PLUGIN_ADDED: 'PluginAdded',
} as const;

export function mapCopilotOperation(operation: string): {
  severity: string;
  category: string;
} {
  const map: Record<string, { severity: string; category: string }> = {
    [COPILOT_STUDIO_OPERATIONS.AGENT_CREATED]: { severity: 'info', category: 'lifecycle' },
    [COPILOT_STUDIO_OPERATIONS.AGENT_PUBLISHED]: { severity: 'low', category: 'lifecycle' },
    [COPILOT_STUDIO_OPERATIONS.AGENT_DELETED]: { severity: 'medium', category: 'lifecycle' },
    [COPILOT_STUDIO_OPERATIONS.POLICY_VIOLATION]: { severity: 'high', category: 'policy' },
    [COPILOT_STUDIO_OPERATIONS.DATA_ACCESS]: { severity: 'medium', category: 'access' },
    [COPILOT_STUDIO_OPERATIONS.AGENT_CONFIGURED]: { severity: 'info', category: 'config' },
    [COPILOT_STUDIO_OPERATIONS.PLUGIN_ADDED]: { severity: 'low', category: 'plugin' },
  };

  return map[operation] || { severity: 'info', category: 'unknown' };
}

export async function processCopilotStudioEvent(
  _db: DrizzleD1Database<typeof schema>,
  record: CopilotStudioRecord,
): Promise<NormalizedCopilotEvent> {
  const mapping = mapCopilotOperation(record.Operation);
  const agentName = record.ObjectId || 'Unknown Agent';

  return {
    agentName,
    userId: record.UserId,
    operation: record.Operation,
    severity: mapping.severity,
    details: {
      ...record.Details,
      category: mapping.category,
    },
    timestamp: record.CreationTime,
  };
}

export function extractCopilotInteractionDetails(
  details?: Record<string, any>,
): {
  modificationsBefore?: Record<string, any>;
  modificationsAfter?: Record<string, any>;
  pluginNames?: string[];
} {
  if (!details) return {};

  return {
    modificationsBefore: details.ModificationsBefore,
    modificationsAfter: details.ModificationsAfter,
    pluginNames: details.PluginNames as string[] | undefined,
  };
}
