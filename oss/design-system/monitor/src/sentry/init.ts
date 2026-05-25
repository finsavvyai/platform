import type { SentryConfig } from '../types.js';

interface InitSentryOptions {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  debug?: boolean;
}

export async function initSentry(config: SentryConfig): Promise<void> {
  if (!config.dsn) {
    console.warn('Sentry DSN not provided, skipping initialization');
    return;
  }

  try {
    const sentryModule = await import('@sentry/node');
    const Sentry = sentryModule.default || sentryModule;

    const options: InitSentryOptions = {
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.tracesSampleRate ?? 0.1,
      debug: config.debugLogging ?? false,
    };

    if (Sentry.init) {
      Sentry.init(options);
    }
  } catch (error) {
    console.warn(
      'Sentry initialization failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
