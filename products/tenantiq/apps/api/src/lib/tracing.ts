/**
 * Distributed tracing utilities for Cloudflare Workers.
 * Uses W3C Trace Context headers for propagation.
 */

export interface TraceContext {
	traceId: string;
	spanId: string;
	parentSpanId?: string;
}

/** Generate a random hex ID of the specified byte length. */
function randomHex(bytes: number): string {
	const arr = new Uint8Array(bytes);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract trace context from incoming request headers (W3C traceparent).
 * If no traceparent header is present, generates a new root trace.
 */
export function extractTraceContext(headers: Headers): TraceContext {
	const traceparent = headers.get('traceparent');
	if (traceparent) {
		const parts = traceparent.split('-');
		if (parts.length >= 4 && parts[1].length === 32 && parts[2].length === 16) {
			return {
				traceId: parts[1],
				spanId: randomHex(8),
				parentSpanId: parts[2],
			};
		}
	}
	return { traceId: randomHex(16), spanId: randomHex(8) };
}

/** Create a W3C traceparent header value from a trace context. */
export function createTraceparent(ctx: TraceContext): string {
	return `00-${ctx.traceId}-${ctx.spanId}-01`;
}

/** Create a child span derived from the current trace context. */
export function childSpan(parent: TraceContext): TraceContext {
	return {
		traceId: parent.traceId,
		spanId: randomHex(8),
		parentSpanId: parent.spanId,
	};
}

/** Inject trace context into outgoing fetch headers for propagation. */
export function injectTraceHeaders(headers: Headers, ctx: TraceContext): void {
	headers.set('traceparent', createTraceparent(ctx));
}
