import { z } from 'zod';

const RULE_TYPES = ['file_pattern', 'command_pattern', 'risk_threshold', 'secrets_threshold'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

const jsonValue = z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]);

export const createAgentPolicySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ruleType: z.enum(RULE_TYPES),
  ruleConfig: jsonValue,
  severity: z.enum(SEVERITIES).optional().default('high'),
});

export const updateAgentPolicySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  severity: z.enum(SEVERITIES).optional(),
  isActive: z.boolean().optional(),
  ruleConfig: jsonValue.optional(),
});
