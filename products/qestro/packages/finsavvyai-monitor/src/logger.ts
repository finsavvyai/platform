/**
 * @finsavvyai/monitor — Structured JSON logger
 * Drop-in replacement for custom loggers with Sentry-ready error capture
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown> | Error;

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  child: (meta: LogContext) => Logger;
}

export interface LoggerConfig {
  service: string;
  environment: string;
  version?: string;
  sentryDsn?: string;
  level?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

let sentryCapture: ((error: Error, context?: Record<string, unknown>) => void) | null = null;

export function configureSentry(
  captureFunction: (error: Error, context?: Record<string, unknown>) => void,
): void {
  sentryCapture = captureFunction;
}

const normalizeContext = (context: LogContext): Record<string, unknown> => {
  if (context instanceof Error) {
    return {
      error: context.message,
      stack: context.stack,
      name: context.name,
    };
  }
  return context;
};

export function createLogger(config: LoggerConfig, meta: LogContext = {}): Logger {
  const minLevel = LOG_LEVELS[config.level || 'debug'];

  const emit = (level: LogLevel, message: string, context: LogContext = {}) => {
    if (LOG_LEVELS[level] < minLevel) return;

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: config.service,
      environment: config.environment,
      version: config.version,
      message,
      ...normalizeContext(meta),
      ...normalizeContext(context),
    };

    const line = JSON.stringify(payload);

    if (level === 'error') {
      console.error(line);
      // Forward errors to Sentry if configured
      if (sentryCapture && context instanceof Error) {
        sentryCapture(context, normalizeContext(meta));
      }
      return;
    }
    if (level === 'warn') { console.warn(line); return; }
    if (level === 'debug') { console.debug(line); return; }
    console.info(line);
  };

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    child: (childMeta) => createLogger(config, {
      ...normalizeContext(meta),
      ...normalizeContext(childMeta),
    }),
  };
}
