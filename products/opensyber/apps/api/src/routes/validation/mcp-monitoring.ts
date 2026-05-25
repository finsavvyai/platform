import { z } from 'zod';

export const trackInvocationSchema = z.object({
  serverId: z.string().min(1),
  toolName: z.string().min(1),
  agentId: z.string().min(1),
  instanceId: z.string().min(1),
});

export const scanServerSchema = z.object({
  serverId: z.string().min(1),
});
