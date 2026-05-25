/**
 * Sentry Error Reporting for Cloudflare Workers
 *
 * Lightweight wrapper that sends errors to Sentry via their HTTP API.
 * No heavy SDK needed — CF Workers have limited bundle size.
 */

interface SentryOptions {
  dsn?: string;
  environment?: string;
  release?: string;
}

interface SentryEvent {
  exception: { values: Array<{ type: string; value: string; stacktrace?: { frames: Array<{ filename: string; lineno?: number }> } }> };
  level: string;
  environment: string;
  release?: string;
  timestamp: number;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

function parseDsn(dsn: string): { url: string; publicKey: string; projectId: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace('/', '');
    return {
      url: `https://${u.hostname}/api/${projectId}/store/`,
      publicKey: u.username,
      projectId,
    };
  } catch {
    return null;
  }
}

export function createSentry(options: SentryOptions): {
  captureException(err: unknown, context?: Record<string, unknown>): void;
  captureMessage(msg: string, context?: Record<string, unknown>): void;
} {
  const parsed = options.dsn ? parseDsn(options.dsn) : null;

  return {
    captureException(err: unknown, context?: Record<string, unknown>): void {
      const error = err instanceof Error ? err : new Error(String(err));

      if (!parsed) {
        console.error('[Sentry] No DSN configured, logging locally:', error.message);
        return;
      }

      const event: SentryEvent = {
        exception: {
          values: [{
            type: error.name,
            value: error.message,
            stacktrace: error.stack ? {
              frames: error.stack.split('\n').slice(1, 10).map((line) => ({
                filename: line.trim(),
              })),
            } : undefined,
          }],
        },
        level: 'error',
        environment: options.environment ?? 'production',
        release: options.release,
        timestamp: Date.now() / 1000,
        extra: context,
      };

      fetch(parsed.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7,sentry_client=opensyber-cf/1.0,sentry_key=${parsed.publicKey}`,
        },
        body: JSON.stringify(event),
      }).catch(() => {});
    },

    captureMessage(msg: string, context?: Record<string, unknown>): void {
      if (!parsed) {
        console.warn('[Sentry] No DSN configured:', msg);
        return;
      }

      const event = {
        message: { formatted: msg },
        level: 'warning',
        environment: options.environment ?? 'production',
        release: options.release,
        timestamp: Date.now() / 1000,
        extra: context,
      };

      fetch(parsed.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7,sentry_client=opensyber-cf/1.0,sentry_key=${parsed.publicKey}`,
        },
        body: JSON.stringify(event),
      }).catch(() => {});
    },
  };
}
