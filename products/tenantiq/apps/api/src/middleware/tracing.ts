import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app/types';
import { extractTraceContext, createTraceparent } from '../lib/tracing';
import { logger } from '../lib/logger';

/**
 * Distributed tracing middleware.
 * Extracts W3C Trace Context from incoming requests, sets trace IDs
 * on the Hono context, and logs request duration with trace context.
 */
export const tracingMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const traceCtx = extractTraceContext(c.req.raw.headers);

	c.set('traceId', traceCtx.traceId);
	c.set('spanId', traceCtx.spanId);

	c.header('x-trace-id', traceCtx.traceId);
	c.header('traceparent', createTraceparent(traceCtx));

	const start = Date.now();
	await next();
	const duration = Date.now() - start;

	logger.info('request completed', {
		traceId: traceCtx.traceId,
		spanId: traceCtx.spanId,
		parentSpanId: traceCtx.parentSpanId,
		method: c.req.method,
		path: c.req.path,
		status: c.res.status,
		durationMs: duration,
	});
});
