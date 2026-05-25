import { createLogger } from '@finsavvyai/monitor';

// NOTE: Elasticsearch transport is handled separately.
// The previous Winston-based logger shipped logs to ES via winston-elasticsearch.
// If ES ingestion is still needed, configure a Pino transport or a sidecar shipper
// (e.g., Filebeat / Vector) to forward structured JSON stdout to Elasticsearch.

const pinoLogger = createLogger({
  name: 'DocumentProcessor',
  level: process.env.LOG_LEVEL || 'info',
  maskSensitiveFields: true,
});

export class Logger {
  private context: string;

  constructor(context: string = 'DocumentProcessor') {
    this.context = context;
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    pinoLogger.info(message, { context: this.context, ...meta });
  }

  public error(
    message: string,
    error?: Error | unknown,
    meta?: Record<string, unknown>,
  ): void {
    if (error instanceof Error) {
      pinoLogger.error(message, {
        context: this.context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...meta,
      });
    } else {
      pinoLogger.error(message, { context: this.context, error, ...meta });
    }
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    pinoLogger.warn(message, { context: this.context, ...meta });
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    pinoLogger.debug(message, { context: this.context, ...meta });
  }

  public verbose(message: string, meta?: Record<string, unknown>): void {
    // Pino has no "verbose" level; map to debug with a verbose flag
    pinoLogger.debug(message, {
      context: this.context,
      verbose: true,
      ...meta,
    });
  }

  public startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${label} completed in ${duration}ms`, { duration, label });
    };
  }

  public logRequest(
    req: {
      method: string;
      url: string;
      get: (h: string) => string | undefined;
      ip?: string;
      connection: { remoteAddress?: string };
    },
    res: { statusCode: number },
    duration: number,
  ): void {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
    });
  }

  public logDocumentProcessing(
    documentId: string,
    operation: string,
    status: string,
    duration?: number,
    metadata?: Record<string, unknown>,
  ): void {
    this.info('Document Processing', {
      documentId,
      operation,
      status,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  public logErrorWithContext(
    operation: string,
    error: Error,
    context: Record<string, unknown> = {},
  ): void {
    this.error(`${operation} failed`, error, {
      operation,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}
