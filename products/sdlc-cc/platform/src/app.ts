import { randomUUID } from 'crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import pipelinesRouter from './api/pipelines';
import releasesRouter from './api/releases';
import { loadConfig, type AppConfig } from './config';
import { createLogger } from './utils/logger';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready';
  service: string;
  timestamp: string;
}

export interface NotFoundResponse {
  error: string;
  requestId: string;
}

export function createHealthResponse(
  config: AppConfig,
  uptimeSeconds = Math.round(process.uptime()),
  timestamp = new Date().toISOString(),
): HealthResponse {
  return {
    status: 'ok',
    service: config.serviceName,
    version: config.version,
    environment: config.env,
    uptimeSeconds,
    timestamp,
  };
}

export function createReadinessResponse(
  config: AppConfig,
  timestamp = new Date().toISOString(),
): ReadinessResponse {
  return {
    status: 'ready',
    service: config.serviceName,
    timestamp,
  };
}

export function createNotFoundResponse(
  method: string,
  path: string,
  requestId: string,
): NotFoundResponse {
  return {
    error: `Route not found: ${method} ${path}`,
    requestId,
  };
}

export function createApp(config: AppConfig = loadConfig()): Express {
  const app = express();
  const appLogger = createLogger(config);

  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = req.header('x-request-id')?.trim() || randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();

    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');

    if (config.env === 'production') {
      res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
      appLogger.info('HTTP request completed', {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        userAgent: req.get('user-agent'),
      });
    });

    next();
  });

  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.jsonBodyLimit }));

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json(createHealthResponse(config));
  });

  app.get('/ready', (_req: Request, res: Response) => {
    res.status(200).json(createReadinessResponse(config));
  });

  app.use('/api', pipelinesRouter);
  app.use('/api', releasesRouter);

  app.use((req: Request, res: Response) => {
    res.status(404).json(createNotFoundResponse(req.method, req.originalUrl, req.id));
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unknown error';

    appLogger.error('Unhandled request error', {
      requestId: req.id,
      message,
    });

    res.status(500).json({
      error: 'Internal server error',
      requestId: req.id,
    });
  });

  return app;
}

export const app = createApp();
