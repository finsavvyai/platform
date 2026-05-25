import { z } from 'zod';

const TRIGGER_TYPES = ['manual', 'auto', 'scheduled'] as const;

export const createPlaybookSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  triggerType: z.enum(TRIGGER_TYPES).optional().default('manual'),
  triggerConfig: z.record(z.unknown()).nullish(),
  steps: z.array(z.record(z.unknown())).min(1),
});

export const updatePlaybookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  steps: z.array(z.record(z.unknown())).min(1).optional(),
});

export const createRunSchema = z.object({
  playbookId: z.string().min(1).max(256),
});
