import type { Context } from 'hono';
import { z } from 'zod';

type ValidationSuccess<T> = {
  success: true;
  data: T;
};

type ValidationFailure = {
  success: false;
  response: Response;
};

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  c: Context,
  schema: TSchema,
): Promise<ValidationSuccess<z.infer<TSchema>> | ValidationFailure> {
  let payload: unknown;

  try {
    payload = await c.req.json();
  } catch {
    return {
      success: false,
      response: c.json({ success: false, error: 'Invalid JSON body' }, 400),
    };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      response: c.json({
        success: false,
        error: 'Invalid request body',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }, 400),
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}
