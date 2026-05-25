import pino, { type LevelWithSilent, type Logger as PinoLogger } from 'pino';

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

export interface LoggerConfig {
  env?: string;
  logLevel?: LevelWithSilent;
  serviceName?: string;
  version?: string;
}

const redactedPaths = [
  'password',
  'authorization',
  'headers.authorization',
  'headers.cookie',
  'token',
  'tokens',
  'apiKey',
  'secret',
  'secrets',
];

function normalizeBindings(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  if (value instanceof Error) {
    return {
      errorMessage: value.message,
      errorName: value.name,
      stack: value.stack,
    };
  }

  return value as Record<string, unknown>;
}

function emitLog(
  target: PinoLogger,
  level: 'info' | 'warn' | 'error' | 'debug',
  messageOrBindings?: unknown,
  bindings?: unknown,
): void {
  if (typeof messageOrBindings === 'string') {
    const normalizedBindings = normalizeBindings(bindings);

    if (normalizedBindings) {
      target[level](normalizedBindings, messageOrBindings);
      return;
    }

    if (bindings !== undefined) {
      target[level]({ value: bindings }, messageOrBindings);
      return;
    }

    target[level](messageOrBindings);
    return;
  }

  const normalizedBindings = normalizeBindings(messageOrBindings);
  const fallbackMessage = typeof bindings === 'string' ? bindings : 'log event';

  if (normalizedBindings) {
    target[level](normalizedBindings, fallbackMessage);
    return;
  }

  target[level]({ value: messageOrBindings }, fallbackMessage);
}

function wrapLogger(target: PinoLogger): Logger {
  return {
    info: (messageOrBindings?: unknown, bindings?: unknown): void => {
      emitLog(target, 'info', messageOrBindings, bindings);
    },
    warn: (messageOrBindings?: unknown, bindings?: unknown): void => {
      emitLog(target, 'warn', messageOrBindings, bindings);
    },
    error: (messageOrBindings?: unknown, bindings?: unknown): void => {
      emitLog(target, 'error', messageOrBindings, bindings);
    },
    debug: (messageOrBindings?: unknown, bindings?: unknown): void => {
      emitLog(target, 'debug', messageOrBindings, bindings);
    },
    child: (bindings: Record<string, unknown>): Logger => wrapLogger(target.child(bindings)),
  };
}

export function createLogger(config: LoggerConfig = {}): Logger {
  const target = pino({
    level: config.logLevel ?? 'info',
    base: {
      service: config.serviceName ?? 'sdlc-platform',
      env: config.env ?? process.env.NODE_ENV ?? 'development',
      version: config.version ?? process.env.APP_VERSION ?? '1.0.0',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: redactedPaths,
      censor: '[REDACTED]',
    },
  });

  return wrapLogger(target);
}

export const logger = createLogger();
