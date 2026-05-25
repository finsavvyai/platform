import { z } from 'zod';

export const activitySyncSchema = z.object({
  events: z.array(z.unknown()).min(1).max(200),
});

const riskLevelEnum = z.enum(['low', 'medium', 'high', 'critical']);
const eventTypeEnum = z.enum([
  'file_access', 'file_write', 'terminal_command', 'secret_detected', 'network_request',
]);

const extensionEventSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().min(1),
  agentName: z.string().min(1).max(100),
  eventType: eventTypeEnum,
  riskLevel: riskLevelEnum,
  filePath: z.string().optional(),
  summary: z.string().min(1).max(500).optional(),
  secretsDetected: z.number().int().min(0).default(0),
  metadata: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const extensionSyncSchema = z.object({
  events: z.array(extensionEventSchema).min(0).max(100),
});

export type ExtensionEventInput = z.infer<typeof extensionEventSchema>;
