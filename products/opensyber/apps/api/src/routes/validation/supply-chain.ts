import { z } from 'zod';

export const scanSkillSchema = z.object({
  source: z.string().min(1),
  domains: z.array(z.string()).optional(),
});

export const scanMcpSchema = z.object({
  configs: z.array(z.object({
    name: z.string().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  }).passthrough()),
});
