/**
 * Sentry Error Tracking — Cloudflare Workers integration
 *
 * Lightweight Sentry client for Workers (no SDK needed).
 * Uses Sentry's HTTP API to report errors with stack traces,
 * request context, and user information.
 */

interface SentryConfig {
    dsn: string;
    environment: string;
    release?: string;
}

interface SentryContext {
    method: string;
    url: string;
    userId?: string;
    userEmail?: string;
    userTier?: string;
    headers?: Record<string, string>;
}

/**
 * Parse a Sentry DSN into its components
 * DSN format: https://<key>@<host>/<project-id>
 */
function parseDSN(dsn: string): { key: string; host: string; projectId: string } | null {
    try {
        const url = new URL(dsn);
        const key = url.username;
        const projectId = url.pathname.replace('/', '');
        const host = url.hostname;
        return { key, host, projectId };
    } catch {
        return null;
    }
}

/**
 * Build a Sentry event payload from an error
 */
function buildEvent(
    error: Error,
    context: SentryContext,
    config: SentryConfig,
): Record<string, any> {
    return {
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: new Date().toISOString(),
        platform: 'javascript',
        level: 'error',
        logger: 'lunaos-engine',
        server_name: 'cloudflare-worker',
        environment: config.environment,
        release: config.release || '0.2.0',
        exception: {
            values: [{
                type: error.name || 'Error',
                value: error.message,
                stacktrace: error.stack ? {
                    frames: parseStackFrames(error.stack),
                } : undefined,
            }],
        },
        request: {
            method: context.method,
            url: context.url,
            headers: context.headers || {},
        },
        user: context.userId ? {
            id: context.userId,
            email: context.userEmail,
            subscription: context.userTier,
        } : undefined,
        tags: {
            runtime: 'cloudflare-workers',
            tier: context.userTier || 'anonymous',
        },
        extra: {
            workerVersion: config.release || '0.2.0',
        },
    };
}

/**
 * Parse a JS stack trace into Sentry-compatible frames
 */
function parseStackFrames(stack: string): Record<string, any>[] {
    const lines = stack.split('\n').slice(1); // Skip the error message line
    const frames: Record<string, any>[] = [];

    for (const line of lines) {
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
            frames.push({
                function: match[1],
                filename: match[2],
                lineno: parseInt(match[3]),
                colno: parseInt(match[4]),
                in_app: !match[2].includes('node_modules'),
            });
            continue;
        }
        // Handle lines without parentheses: at file:line:col
        const simpleMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);
        if (simpleMatch) {
            frames.push({
                filename: simpleMatch[1],
                lineno: parseInt(simpleMatch[2]),
                colno: parseInt(simpleMatch[3]),
                in_app: true,
            });
        }
    }

    return frames.reverse(); // Sentry wants frames in oldest-first order
}

/**
 * Send an error event to Sentry via HTTP API.
 * Non-blocking — fires and forgets.
 */
export async function captureException(
    error: Error,
    context: SentryContext,
    config: SentryConfig,
): Promise<void> {
    if (!config.dsn) return;

    const parsed = parseDSN(config.dsn);
    if (!parsed) {
        console.error('[Sentry] Invalid DSN');
        return;
    }

    const event = buildEvent(error, context, config);
    const url = `https://${parsed.host}/api/${parsed.projectId}/store/`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=lunaos-worker/1.0, sentry_key=${parsed.key}`,
            },
            body: JSON.stringify(event),
        });
    } catch (err) {
        // Sentry reporting is best-effort — never block the response
        console.error('[Sentry] Failed to send event:', err);
    }
}

/**
 * Create a Sentry-reporting error handler for Hono.
 * Wraps the existing error handler to also report to Sentry.
 */
export function createSentryErrorHandler(config: SentryConfig) {
    return async (err: Error, c: any) => {
        // Extract context
        const context: SentryContext = {
            method: c.req.method,
            url: c.req.url,
            userId: c.get?.('userId'),
            userEmail: c.get?.('userEmail'),
            userTier: c.get?.('userTier'),
            headers: {
                'user-agent': c.req.header('user-agent') || '',
                'content-type': c.req.header('content-type') || '',
            },
        };

        // Fire and forget — don't await in the response path
        c.executionCtx?.waitUntil?.(captureException(err, context, config));

        // Log locally
        console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);

        // Return standard error response
        return c.json({
            error: 'Internal Server Error',
            message: config.environment === 'development' ? err.message : 'Something went wrong',
        }, 500);
    };
}
