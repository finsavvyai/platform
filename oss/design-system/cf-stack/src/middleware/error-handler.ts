import type { Context, Next } from 'hono';

export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
}

export function createErrorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const status = (err as any)?.status || 500;
      const message = error.message || 'Internal server error';

      console.error('[Error]', {
        status,
        message,
        stack: error.stack,
      });

      c.status(status);
      return c.json({
        error: status === 500 ? 'Internal Server Error' : error.name,
        message,
        status,
      } as ErrorResponse);
    }
  };
}
