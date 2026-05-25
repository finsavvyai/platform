// Structured logging for worker observability

import type { ObservabilityConfig, LogEntry } from './observability-types';

export class StructuredLogger {
  private config: ObservabilityConfig;
  private requestId?: string;

  constructor(config: ObservabilityConfig) {
    this.config = config;
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  private createLogEntry(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.service,
      environment: this.config.environment,
      message,
      requestId: this.requestId,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];
    return messageLevel >= currentLevel;
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const logMessage = JSON.stringify(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }

    this.sendToExternalLogger(entry);
  }

  private async sendToExternalLogger(entry: LogEntry): Promise<void> {
    // Implementation for external logging services
    // This could be sent to Logtail, DataDog, or other services
  }

  debug(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('debug', message, metadata);
    this.log(entry);
  }

  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('info', message, metadata);
    this.log(entry);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('warn', message, metadata);
    this.log(entry);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('error', message, metadata, error);
    this.log(entry);
  }

  audit(
    event: string,
    userId?: string,
    tenantId?: string,
    metadata?: Record<string, any>
  ): void {
    const entry = this.createLogEntry('info', `AUDIT: ${event}`, {
      ...metadata,
      auditEvent: event,
      userId,
      tenantId,
      timestamp: new Date().toISOString()
    });
    this.log(entry);
  }

  performance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const entry = this.createLogEntry('info', `Performance: ${operation}`, {
      ...metadata,
      operation,
      duration,
      performanceMetric: true
    });
    this.log(entry);
  }
}
