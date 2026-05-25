/**
 * Structured JSON Logger
 *
 * Emits structured logs for Cloudflare Workers (picked up by logpush).
 * Replaces raw console.error/console.log for production observability.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  switch (level) {
    case 'error':
      console.error(JSON.stringify(entry));
      break;
    case 'warn':
      console.warn(JSON.stringify(entry));
      break;
    case 'debug':
      console.debug(JSON.stringify(entry));
      break;
    default:
      console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    emit('debug', message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    emit('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    emit('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    emit('error', message, context);
  },
};
