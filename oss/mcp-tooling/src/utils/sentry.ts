/**
 * Sentry Error Tracking Integration
 *
 * This module provides Sentry integration for the MCPOverflow frontend.
 * Install with: npm install @sentry/react
 */

import type { User } from '@/types/database';

// Type definitions for Sentry (will be available after npm install @sentry/react)
interface SentryOptions {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  integrations?: any[];
  beforeSend?: (event: any, hint: any) => any;
}

interface SentryUser {
  id: string;
  email?: string;
  username?: string;
}

interface SentryScope {
  setUser(user: SentryUser | null): void;
  setTag(key: string, value: string): void;
  setContext(key: string, context: Record<string, any>): void;
}

// Placeholder types for when Sentry is not installed
let Sentry: any = null;
let isSentryAvailable = false;

// Try to import Sentry (will work after npm install @sentry/react)
try {
  Sentry = require('@sentry/react');
  isSentryAvailable = true;
} catch (error) {
  console.warn('Sentry not installed. Run: npm install @sentry/react');
}

/**
 * Initialize Sentry error tracking
 */
export function initSentry(): void {
  if (!isSentryAvailable || !Sentry) {
    console.warn('Sentry is not available. Error tracking disabled.');
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('VITE_SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  const environment = import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'development';
  const release = import.meta.env.VITE_RELEASE || 'mcpoverflow@0.1.4';

  try {
    Sentry.init({
      dsn,
      environment,
      release,
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: environment === 'production' ? 0.1 : 0.0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration({
          // Performance monitoring
          tracePropagationTargets: [
            'localhost',
            /^https:\/\/.*\.mcpoverflow\.(io|com|ai|dev)/,
          ],
        }),
        Sentry.replayIntegration({
          // Session replay for debugging
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      beforeSend(event, hint) {
        // Filter out sensitive information
        if (event.request) {
          // Remove sensitive headers
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
            delete event.request.headers['x-api-key'];
          }

          // Remove sensitive query parameters
          if (event.request.query_string) {
            const sensitiveParams = ['token', 'key', 'secret', 'password'];
            sensitiveParams.forEach(param => {
              event.request.query_string = event.request.query_string?.replace(
                new RegExp(`${param}=[^&]*`, 'gi'),
                `${param}=***`
              );
            });
          }
        }

        // Don't send events in development unless explicitly enabled
        if (environment === 'development' && !import.meta.env.VITE_SENTRY_DEBUG) {
          return null;
        }

        return event;
      },
    });

    console.log(`Sentry initialized for environment: ${environment}`);
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Set the current user context for Sentry
 */
export function setUser(user: User | null): void {
  if (!isSentryAvailable || !Sentry) return;

  try {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.email?.split('@')[0],
      });
    } else {
      Sentry.setUser(null);
    }
  } catch (error) {
    console.error('Failed to set Sentry user:', error);
  }
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (!isSentryAvailable || !Sentry) {
    console.error('Sentry not available, error:', error, context);
    return;
  }

  try {
    if (context) {
      Sentry.withScope((scope: SentryScope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch (err) {
    console.error('Failed to capture exception:', err);
  }
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!isSentryAvailable || !Sentry) {
    console.log(`[${level}] ${message}`);
    return;
  }

  try {
    Sentry.captureMessage(message, level);
  } catch (error) {
    console.error('Failed to capture message:', error);
  }
}

/**
 * Add a breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string = 'user-action',
  level: 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  if (!isSentryAvailable || !Sentry) return;

  try {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    console.error('Failed to add breadcrumb:', error);
  }
}

/**
 * Set a custom tag
 */
export function setTag(key: string, value: string): void {
  if (!isSentryAvailable || !Sentry) return;

  try {
    Sentry.setTag(key, value);
  } catch (error) {
    console.error('Failed to set tag:', error);
  }
}

/**
 * Set custom context data
 */
export function setContext(key: string, context: Record<string, any>): void {
  if (!isSentryAvailable || !Sentry) return;

  try {
    Sentry.setContext(key, context);
  } catch (error) {
    console.error('Failed to set context:', error);
  }
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, operation: string): any {
  if (!isSentryAvailable || !Sentry) return null;

  try {
    return Sentry.startTransaction({ name, op: operation });
  } catch (error) {
    console.error('Failed to start transaction:', error);
    return null;
  }
}

/**
 * Finish a performance transaction
 */
export function finishTransaction(transaction: any): void {
  if (!transaction || !isSentryAvailable) return;

  try {
    transaction.finish();
  } catch (error) {
    console.error('Failed to finish transaction:', error);
  }
}

/**
 * Create an error boundary component
 * Use this to wrap your app or specific components
 */
export function createErrorBoundary(): any {
  if (!isSentryAvailable || !Sentry) {
    // Return a simple fallback error boundary
    return ({ children }: { children: React.ReactNode }) => children;
  }

  try {
    return Sentry.ErrorBoundary;
  } catch (error) {
    console.error('Failed to create error boundary:', error);
    return ({ children }: { children: React.ReactNode }) => children;
  }
}

/**
 * Track API errors specifically
 */
export function captureAPIError(
  error: Error,
  endpoint: string,
  method: string,
  statusCode?: number
): void {
  captureException(error, {
    api: {
      endpoint,
      method,
      statusCode,
    },
  });
}

/**
 * Track navigation/routing errors
 */
export function captureNavigationError(error: Error, path: string): void {
  captureException(error, {
    navigation: {
      path,
      referrer: document.referrer,
    },
  });
}

/**
 * Track authentication errors
 */
export function captureAuthError(error: Error, action: string): void {
  captureException(error, {
    auth: {
      action,
      timestamp: new Date().toISOString(),
    },
  });
}

// Export whether Sentry is available
export const sentryAvailable = isSentryAvailable;

// Export Sentry for advanced usage
export { Sentry };
