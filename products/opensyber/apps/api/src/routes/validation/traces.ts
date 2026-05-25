import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Path params for trace retrieval endpoint */
export const traceParamsSchema = z.object({
  traceId: z.string().regex(UUID_REGEX, 'Invalid trace ID format'),
});
