import { z } from 'zod';

const VALID_CATEGORIES = [
  'productivity', 'developer', 'finance', 'communication', 'home', 'security', 'utilities',
] as const;

export const submitSkillSchema = z.object({
  slug: z.string()
    .min(3, 'Slug must be lowercase, use hyphens, and be at least 3 characters')
    .max(100)
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      'Slug must be lowercase, use hyphens, and be at least 3 characters',
    ),
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({
      message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
    }),
  }),
  githubUrl: z.string().url().optional(),
  version: z.string().min(1, 'version is required').max(50),
});
