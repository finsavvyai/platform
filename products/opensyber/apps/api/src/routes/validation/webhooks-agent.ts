import { z } from 'zod';

export const agentProvisionedSchema = z.object({
  instanceId: z.string().min(1),
});

export const agentHealthSchema = z.object({
  instanceId: z.string().min(1),
  status: z.string().min(1),
  cpuPercent: z.number().min(0).max(100),
  memoryPercent: z.number().min(0).max(100),
  diskPercent: z.number().min(0).max(100),
  networkRxBytes: z.number().int().optional(),
  networkTxBytes: z.number().int().optional(),
  engineRunning: z.boolean(),
  agentVersion: z.string().min(1),
  engineVersion: z.string().min(1),
});
