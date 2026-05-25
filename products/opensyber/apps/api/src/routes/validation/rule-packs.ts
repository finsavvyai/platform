import { z } from 'zod';

export const installRulePackSchema = z.object({
  packId: z.string().min(1, 'packId is required'),
  instanceId: z.string().min(1, 'instanceId is required'),
});

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['equals', 'contains', 'gt', 'lt', 'in', 'matches']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

const actionSchema = z.object({
  type: z.enum(['alert', 'notify', 'block']),
  config: z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    channel: z.string().optional(),
  }),
});

const ruleDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  conditions: z.array(conditionSchema).min(1),
  actions: z.array(actionSchema).min(1),
});

export const createCustomPackSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(['ai_security', 'cloud_posture', 'dev_environment', 'compliance']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  rules: z.array(ruleDefinitionSchema).min(1),
});
