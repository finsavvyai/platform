/**
 * Sentry edge-runtime configuration.
 *
 * Used for Next.js code running in the Cloudflare/Vercel edge runtime
 * (middleware and edge route handlers). Must stay lightweight — no Node APIs.
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
