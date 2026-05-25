import { z } from 'zod';

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(255),
  source: z.string().min(1).max(100),
  owner: z.string().max(255).optional(),
  permissions: z.array(z.string()).optional(),
  instanceId: z.string().optional(),
});

export const updateAgentRiskSchema = z.object({
  riskScore: z.number().int().min(0).max(100),
});
