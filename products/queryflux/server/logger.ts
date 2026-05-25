import pino from 'pino';
import pinoHttp from 'pino-http';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }),
});

export function createRequestLogger() {
  return pinoHttp({
    logger,
    customLogLevel: (_req: unknown, res: { statusCode: number }) =>
      res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    customSuccessMessage: (req: { method: string }, res: { statusCode: number }) =>
      `${req.method} ${res.statusCode}`,
    redact: ['req.headers.authorization'],
  });
}
