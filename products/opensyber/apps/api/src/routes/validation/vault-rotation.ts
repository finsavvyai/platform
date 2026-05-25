import { z } from 'zod';

export const createRotationPolicySchema = z.object({
  secretPattern: z.string().min(1).max(256),
  rotationIntervalDays: z.number().int().min(1).max(365),
  notifyChannelId: z.string().max(256).nullish(),
});
