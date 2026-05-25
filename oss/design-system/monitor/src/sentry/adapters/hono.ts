interface HonoRequest {
  method: string;
  url: string;
  header?: (key: string) => string | undefined;
}

interface HonoContext {
  req: HonoRequest;
  env?: Record<string, unknown>;
}

interface HonoNext {
  (): Promise<void>;
}

interface HonoMiddlewareHandler {
  (c: HonoContext, next: HonoNext): Promise<void>;
}

export function sentryMiddleware(): HonoMiddlewareHandler {
  return async (context: HonoContext, next: HonoNext): Promise<void> => {
    try {
      const startTime = Date.now();

      await next();

      const duration = Date.now() - startTime;
      if (context.env?.DEBUG) {
        console.log(
          `[Sentry] Request ${context.req.method} ${context.req.url} completed in ${duration}ms`
        );
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[Sentry] Error caught by middleware:', errorMsg);
      throw error;
    }
  };
}
