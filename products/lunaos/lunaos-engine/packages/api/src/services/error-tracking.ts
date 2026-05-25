/**
 * Error Tracking Service
 *
 * Provides comprehensive error tracking with structured logging
 * for Cloudflare Workers environments.
 */

// Re-export types and error classes for backward compatibility
export {
    type SeverityLevel,
    type ErrorContext,
    type LogEntry,
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
} from './error-types';

export { createErrorHandler } from './error-handler';

import type { SeverityLevel, ErrorContext, LogEntry } from './error-types';

// ─── Error Tracking Service ─────────────────────────────────────────────────

class ErrorTrackingService {
    private initialized = false;
    private environment: string;
    private serviceName: string;
    private sentryDsn?: string;

    constructor() {
        this.environment = 'production';
        this.serviceName = 'claude-agent-api';
    }

    init(dsn?: string, env?: { ENVIRONMENT?: string; SERVICE_NAME?: string }): void {
        if (this.initialized) return;
        this.sentryDsn = dsn;
        this.environment = env?.ENVIRONMENT || 'production';
        this.serviceName = env?.SERVICE_NAME || 'claude-agent-api';
        this.initialized = true;
        this.log('info', 'Error tracking service initialized');
    }

    captureException(error: Error, context?: ErrorContext): string | undefined {
        this.log('error', error.message, {
            error: { name: error.name, message: error.message, stack: error.stack },
            metadata: context as Record<string, unknown> | undefined,
        });

        if (this.environment === 'production' && this.initialized && this.sentryDsn) {
            this.reportToSentry(error, context).catch(() => { });
        }
        return undefined;
    }

    captureMessage(message: string, level: SeverityLevel = 'info', context?: ErrorContext): void {
        this.log(level === 'warning' ? 'warn' : level as LogEntry['level'], message, {
            metadata: context as Record<string, unknown> | undefined,
        });
    }

    setUser(_user: { id: string; email?: string; tier?: string }): void { }
    clearUser(): void { }

    addBreadcrumb(breadcrumb: { category: string; message: string; level?: SeverityLevel; data?: Record<string, unknown> }): void {
        if (this.environment !== 'production') {
            console.log(`[Breadcrumb] [${breadcrumb.category}] ${breadcrumb.message}`, breadcrumb.data || '');
        }
    }

    startTransaction(_name: string, _op: string): unknown { return null; }

    log(level: LogEntry['level'], message: string, data?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>): void {
        const entry: LogEntry = { level, message, timestamp: new Date().toISOString(), ...data };
        if (this.environment !== 'production') {
            const logMethod = level === 'fatal' ? 'error' : level;
            console[logMethod](`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, data || '');
            return;
        }
        console.log(JSON.stringify(entry));
    }

    async flush(_timeout: number = 2000): Promise<boolean> { return true; }

    private async reportToSentry(error: Error, context?: ErrorContext): Promise<void> {
        if (!this.sentryDsn) return;
        try {
            const dsnMatch = this.sentryDsn.match(/https?:\/\/(.+?)@(.+?)\/(.+)/);
            if (!dsnMatch) return;
            const [, publicKey, host, projectId] = dsnMatch;
            const endpoint = `https://${host}/api/${projectId}/store/`;

            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=workers/1.0, sentry_key=${publicKey}`,
                },
                body: JSON.stringify({
                    event_id: crypto.randomUUID().replace(/-/g, ''),
                    timestamp: new Date().toISOString(),
                    platform: 'javascript', level: 'error',
                    server_name: this.serviceName, environment: this.environment,
                    exception: {
                        values: [{
                            type: error.name, value: error.message,
                            stacktrace: error.stack ? { frames: parseStackFrames(error.stack) } : undefined,
                        }],
                    },
                    tags: context?.tags || {}, extra: context?.extra || {},
                    user: context?.userId ? { id: context.userId } : undefined,
                }),
            });
        } catch { /* Silently fail */ }
    }
}

function parseStackFrames(stack: string): Array<{ filename: string; lineno?: number; function?: string }> {
    return stack.split('\n').slice(1).map(line => {
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) return { function: match[1], filename: match[2], lineno: parseInt(match[3], 10) };
        return { filename: line.trim() };
    });
}

export const errorTracker = new ErrorTrackingService();
export default errorTracker;
