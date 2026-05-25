import { z } from 'zod';

export const startDiscoveryRunSchema = z.object({
  sourceType: z.string().min(1).max(100).optional(),
  sourceRef: z.string().min(1).max(255).optional(),
});

export const listDiscoveryAgentsQuerySchema = z.object({
  status: z.enum(['unsecured', 'protected', 'ignored']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  owner: z.string().min(1).optional(),
  sourceType: z.string().min(1).optional(),
});

export const setAgentOwnerSchema = z.object({
  ownerUserId: z.string().min(1).max(255).nullable().optional(),
  ownerTeamId: z.string().min(1).max(255).nullable().optional(),
  ownerSource: z.string().min(1).max(100).default('manual'),
  confidence: z.number().int().min(0).max(100).default(80),
});

export const protectDiscoveredAgentSchema = z.object({
  instanceId: z.string().min(1).max(255).optional(),
  protectionMethod: z.string().min(1).max(100).default('opensyber-runtime'),
});
