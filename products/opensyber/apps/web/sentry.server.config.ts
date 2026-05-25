/**
 * Sentry server-side (Node.js runtime) configuration.
 *
 * Used for Next.js server components, API routes, and middleware running in
 * the Node runtime. Initialization is a no-op when NEXT_PUBLIC_SENTRY_DSN is
 * not set, matching the client-side behavior.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    enabled: process.env.NODE_ENV !== 'test',
    sendDefaultPii: false,
  });
}
