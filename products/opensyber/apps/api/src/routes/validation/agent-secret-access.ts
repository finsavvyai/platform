import { z } from 'zod';

const ACCESS_TYPES = ['read', 'write', 'delete'] as const;

export const createSecretAccessSchema = z.object({
  agentId: z.string().min(1).max(256),
  secretName: z.string().min(1).max(256),
  accessType: z.enum(ACCESS_TYPES).optional().default('read'),
});
