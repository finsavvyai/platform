import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking for production environments.
 * Set VITE_SENTRY_DSN environment variable to enable.
 */
export function initSentry(): void {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (!dsn) {
        console.log('[Sentry] No DSN provided, error tracking disabled');
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE,

        // Performance monitoring
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],

        // Sample rates
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        replaysOnErrorSampleRate: 1.0,

        // Filter out common noise
        ignoreErrors: [
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
            'Non-Error promise rejection captured',
            /^Network request failed/,
        ],

        beforeSend(event) {
            // Don't send in development unless explicitly enabled
            if (import.meta.env.DEV && !import.meta.env.VITE_SENTRY_DEV) {
                return null;
            }
            return event;
        },
    });

    console.log('[Sentry] Error tracking initialized');
}

// Re-export Sentry utilities for use in components
export { Sentry };
