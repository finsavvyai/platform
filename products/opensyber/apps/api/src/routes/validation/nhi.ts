/**
 * NHI Route Validation Schemas
 */
import { z } from 'zod';

const NHI_AGENT_TYPES = [
  'claude_code', 'cursor', 'windsurf', 'copilot',
  'custom', 'mcp_server', 'ci_runner', 'service_account',
] as const;

export const createNhiAgentSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(NHI_AGENT_TYPES),
  metadata: z.record(z.unknown()).optional(),
});

export const updateNhiAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(NHI_AGENT_TYPES).optional(),
  metadata: z.record(z.unknown()).optional(),
});
