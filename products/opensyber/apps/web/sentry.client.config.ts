/**
 * Sentry client-side configuration.
 *
 * Loaded by @sentry/nextjs in the browser. Initialization is skipped when
 * NEXT_PUBLIC_SENTRY_DSN is not set, so local development remains noise-free
 * and the integration is fully optional.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    // Tracing — keep low by default; ops can override via env.
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    // Session replay — disabled by default to avoid PII risk.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? '0',
    ),
    // Never send events while running automated tests.
    enabled: process.env.NODE_ENV !== 'test',
    // Strip known noisy breadcrumbs; keep stacks short and actionable.
    maxBreadcrumbs: 50,
    // Do not attach default PII. Event data should be opt-in.
    sendDefaultPii: false,
  });
}
