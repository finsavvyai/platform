import { z } from 'zod';

/** Query params for semantic search endpoints (/skills, /findings) */
export const semanticSearchQuerySchema = z.object({
  q: z.string().min(1, 'Query parameter q is required').max(500),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});
