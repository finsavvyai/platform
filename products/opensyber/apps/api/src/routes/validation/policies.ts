import { z } from 'zod';

const VALID_POLICY_TYPES = [
  'network_allowlist', 'network_blocklist', 'file_path_rules',
  'shell_command_rules', 'ip_allowlist', 'rate_limit',
] as const;

const jsonString = z.string().refine(
  (s) => { try { JSON.parse(s); return true; } catch { return false; } },
  { message: 'rules must be valid JSON string' },
);

export const createPolicySchema = z.object({
  policyType: z.enum(VALID_POLICY_TYPES),
  name: z.string().min(1).max(200),
  rules: jsonString,
});

export const updatePolicySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  rules: jsonString.optional(),
  isActive: z.boolean().optional(),
});
