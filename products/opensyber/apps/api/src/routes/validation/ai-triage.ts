import { z } from 'zod';

export const triageEventSchema = z.object({
  eventType: z.string().min(1).max(100),
  riskLevel: z.string().min(1).max(20),
  timestamp: z.string().min(1),
  filePath: z.string().optional(),
  command: z.string().optional(),
  agentName: z.string().optional(),
});

export const batchTriageSchema = z.object({
  events: z.array(triageEventSchema).min(1).max(500),
});
