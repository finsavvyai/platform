import { z } from 'zod';

const VALID_PROVIDERS = ['aws', 'gcp', 'azure'] as const;
const VALID_STATUSES = ['active', 'inactive', 'error'] as const;
const VALID_SCHEDULES = ['manual', 'daily', 'weekly'] as const;

export const createCloudAccountSchema = z.object({
  provider: z.enum(VALID_PROVIDERS),
  name: z.string().min(1).max(100),
  externalId: z.string().max(256).optional(),
  roleArn: z.string().max(2048).optional(),
  credentials: z.record(z.unknown()).optional(),
  scanSchedule: z.enum(VALID_SCHEDULES).optional().default('manual'),
});

export const updateCloudAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  scanSchedule: z.enum(VALID_SCHEDULES).optional(),
});
