import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Invalid slug format').optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(100),
});
