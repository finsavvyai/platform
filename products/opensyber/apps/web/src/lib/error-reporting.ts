/**
 * Lightweight error reporting utility.
 *
 * In production, sends errors to configured endpoint.
 * Falls back to console.error in development.
 *
 * To upgrade to Sentry:
 * 1. pnpm add @sentry/nextjs
 * 2. Replace captureError with Sentry.captureException
 * 3. Replace captureMessage with Sentry.captureMessage
 */

const REPORT_URL = process.env.NEXT_PUBLIC_ERROR_REPORT_URL;

export function captureError(error: unknown, context?: Record<string, string>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error('[Error]', message, context);

  if (REPORT_URL && typeof fetch !== 'undefined') {
    fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'error', message, stack, context, timestamp: new Date().toISOString() }),
    }).catch(() => { /* non-blocking */ });
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' = 'info'): void {
  if (level === 'warning') {
    console.warn('[Warning]', message);
  }

  if (REPORT_URL && typeof fetch !== 'undefined') {
    fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, timestamp: new Date().toISOString() }),
    }).catch(() => { /* non-blocking */ });
  }
}
