/**
 * Cost Route Validation Schemas
 */
import { z } from 'zod';

export const costIngestSchema = z.object({
  agentId: z.string().min(1).max(120),
  sessionId: z.string().min(1).max(120),
  provider: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});

const BUDGET_SCOPES = [
  'per_session', 'daily', 'weekly', 'monthly',
] as const;

export const createBudgetSchema = z.object({
  scope: z.enum(BUDGET_SCOPES),
  limitUsd: z.number().positive(),
  agentId: z.string().min(1).max(120).nullable().optional(),
});
