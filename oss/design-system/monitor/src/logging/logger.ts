import type { LogEntry, LoggerOptions } from '../types.js';

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'Authorization',
];

interface LoggerInstance {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

function maskSensitiveData(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const masked = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (field in masked && masked[field]) {
      masked[field] = '[REDACTED]';
    }
  }
  return masked;
}

function formatEntry(
  level: string,
  message: string,
  metadata?: Record<string, unknown>
): LogEntry {
  return {
    level: level as LogEntry['level'],
    message,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

export function createLogger(opts?: LoggerOptions): LoggerInstance {
  const shouldMask = opts?.maskSensitiveFields ?? true;

  return {
    debug(message: string, metadata?: Record<string, unknown>): void {
      const masked = metadata && shouldMask ? maskSensitiveData(metadata) : metadata;
      const entry = formatEntry('debug', message, masked);
      console.log(JSON.stringify(entry));
    },

    info(message: string, metadata?: Record<string, unknown>): void {
      const masked = metadata && shouldMask ? maskSensitiveData(metadata) : metadata;
      const entry = formatEntry('info', message, masked);
      console.log(JSON.stringify(entry));
    },

    warn(message: string, metadata?: Record<string, unknown>): void {
      const masked = metadata && shouldMask ? maskSensitiveData(metadata) : metadata;
      const entry = formatEntry('warn', message, masked);
      console.warn(JSON.stringify(entry));
    },

    error(message: string, metadata?: Record<string, unknown>): void {
      const masked = metadata && shouldMask ? maskSensitiveData(metadata) : metadata;
      const entry = formatEntry('error', message, masked);
      console.error(JSON.stringify(entry));
    },
  };
}
