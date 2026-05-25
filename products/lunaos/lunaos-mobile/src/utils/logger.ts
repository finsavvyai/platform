/**
 * Structured logger. Noop in production builds.
 */

const IS_DEV = __DEV__;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, tag: string, message: string, data?: unknown): void {
  if (!IS_DEV && level !== 'error') return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${tag}]`;

  switch (level) {
    case 'error':
      // eslint-disable-next-line no-console
      console.error(prefix, message, data ?? '');
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(prefix, message, data ?? '');
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(prefix, message, data ?? '');
  }
}

export const logger = {
  debug: (tag: string, msg: string, data?: unknown) => log('debug', tag, msg, data),
  info: (tag: string, msg: string, data?: unknown) => log('info', tag, msg, data),
  warn: (tag: string, msg: string, data?: unknown) => log('warn', tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => log('error', tag, msg, data),
};
