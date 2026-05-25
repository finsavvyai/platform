import { z } from 'zod';

const VALID_REGIONS = ['eu-central', 'us-east', 'us-west', 'ap-southeast'] as const;

export const createInstanceSchema = z.object({
  name: z.string().min(1).max(100).optional().default('My Agent'),
  region: z.enum(VALID_REGIONS),
});

export const updateInstanceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});
