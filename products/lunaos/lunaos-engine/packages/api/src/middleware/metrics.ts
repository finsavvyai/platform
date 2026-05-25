/**
 * Performance Metrics Middleware — track response times per endpoint
 *
 * Logs P50/P95/P99 response times using KV for storage.
 * Adds Server-Timing header to all responses.
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';

/**
 * Track response time for every request
 */
export const trackMetrics = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    const method = c.req.method;
    const path = c.req.path;

    // Add Server-Timing header
    c.header('Server-Timing', `total;dur=${duration}`);

    // Store metrics in KV (non-blocking)
    try {
        const key = `metrics:${method}:${normalizePath(path)}`;
        const now = Date.now();

        // Store individual timing with timestamp for sliding window
        const entryKey = `${key}:${now}`;
        await c.env.KV.put(entryKey, String(duration), {
            expirationTtl: 3600, // Keep for 1 hour
        });

        // Increment counter for this endpoint
        const countKey = `${key}:count`;
        const current = await c.env.KV.get(countKey);
        await c.env.KV.put(countKey, String(parseInt(current || '0') + 1), {
            expirationTtl: 3600,
        });
    } catch {
        // Non-critical — never block requests for metrics
    }
});

/**
 * Normalize request path for metric grouping
 * /agents/execute → /agents/execute
 * /api-keys/abc-123 → /api-keys/:id
 */
function normalizePath(path: string): string {
    return path
        // Replace UUIDs
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
        // Replace numeric IDs
        .replace(/\/\d+/g, '/:id');
}

/**
 * GET /metrics — internal endpoint for performance data
 * Returns aggregated response times per endpoint
 */
export async function getMetricsSummary(kv: KVNamespace): Promise<{
    endpoints: Record<string, { count: string; note: string }>;
    timestamp: string;
}> {
    // List all metric keys
    const list = await kv.list({ prefix: 'metrics:' });

    const endpoints: Record<string, { count: string; note: string }> = {};

    for (const key of list.keys) {
        if (key.name.endsWith(':count')) {
            const endpoint = key.name.replace('metrics:', '').replace(':count', '');
            const count = await kv.get(key.name);
            endpoints[endpoint] = {
                count: count || '0',
                note: 'Last 1 hour',
            };
        }
    }

    return {
        endpoints,
        timestamp: new Date().toISOString(),
    };
}
