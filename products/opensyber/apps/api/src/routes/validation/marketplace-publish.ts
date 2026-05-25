import { z } from 'zod';

export const publishSkillSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100),
  version: z.string().min(1).max(50),
  tier: z.enum(['free', 'pro', 'team', 'enterprise']).optional(),
  changelog: z.string().max(5000).optional(),
});

export const updateSkillMetadataSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  homepage: z.string().url().max(500).optional(),
  repository: z.string().url().max(500).optional(),
});
