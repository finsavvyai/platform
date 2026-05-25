import { createLogger } from '@finsavvyai/monitor';

const pinoLogger = createLogger({
  name: 'RealtimeService',
  level: process.env.LOG_LEVEL || 'info',
  maskSensitiveFields: true,
});

export class WinstonLogger {
  error(message: string, meta?: Record<string, unknown>) {
    pinoLogger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    pinoLogger.warn(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    pinoLogger.info(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    pinoLogger.debug(message, meta);
  }
}
