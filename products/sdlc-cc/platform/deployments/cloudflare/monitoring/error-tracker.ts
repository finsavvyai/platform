// Error tracking for worker observability

import type { ObservabilityConfig, ErrorContext } from './observability-types';
import type { StructuredLogger } from './structured-logger';

export class ErrorTracker {
  private config: ObservabilityConfig;
  private logger: StructuredLogger;

  constructor(config: ObservabilityConfig, logger: StructuredLogger) {
    this.config = config;
    this.logger = logger;
  }

  async captureError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    if (!this.config.enableErrorTracking) return;

    const fullContext: ErrorContext = {
      service: this.config.service,
      environment: this.config.environment,
      version: this.config.version,
      ...context
    };

    this.logger.error(`Unhandled error: ${error.message}`, error, {
      errorContext: fullContext
    });

    if (this.config.sentryDsn) {
      await this.sendToSentry(error, fullContext);
    }

    await this.sendToErrorTrackingServices(error, fullContext);
  }

  private async sendToSentry(
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    try {
      // Implementation for Sentry integration
    } catch (sentryError) {
      this.logger.error(
        'Failed to send error to Sentry',
        sentryError as Error
      );
    }
  }

  private async sendToErrorTrackingServices(
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    // Implementation for other error tracking services
    // DataDog, Rollbar, etc.
  }

  createErrorFeedback(
    errorId: string,
    userId: string,
    feedback: string
  ): void {
    this.logger.info('User feedback received for error', {
      errorId,
      userId,
      feedback,
      type: 'user_feedback'
    });
  }
}
