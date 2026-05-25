import { z } from 'zod';

export const otelIngestSchema = z.object({
  resourceSpans: z.array(z.record(z.unknown())).min(1),
});
