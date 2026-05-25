import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { ElasticsearchClient } from '@elastic/elasticsearch';

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string = 'DocumentProcessor') {
    this.context = context;
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}] [${this.context}]: ${message} ${metaString}`;
          })
        ),
      }),
    ];

    // File transports (only in production)
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        // Error log file
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
        // Combined log file
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        })
      );
    }

    // Elasticsearch transport (if configured)
    if (process.env.ELASTICSEARCH_URL) {
      try {
        const esTransport = new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL,
            auth: process.env.ELASTICSEARCH_AUTH ?
              JSON.parse(process.env.ELASTICSEARCH_AUTH) : undefined,
          },
          index: 'document-processor-logs',
          transformer: (logData: any) => {
            return {
              '@timestamp': new Date().toISOString(),
              service: 'document-processor',
              context: this.context,
              level: logData.level,
              message: logData.message,
              ...logData.meta,
            };
          },
        });
        transports.push(esTransport);
      } catch (error) {
        console.warn('Failed to initialize Elasticsearch transport:', error);
      }
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata()
      ),
      transports,
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production' ? [
          new winston.transports.File({ filename: 'logs/exceptions.log' })
        ] : [])
      ],
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production' ? [
          new winston.transports.File({ filename: 'logs/rejections.log' })
        ] : [])
      ],
    });
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public error(message: string, error?: Error | any, meta?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...meta
      });
    } else {
      this.logger.error(message, { error, ...meta });
    }
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  public verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  // Performance logging
  public startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${label} completed in ${duration}ms`, { duration, label });
    };
  }

  // Structured logging for API requests
  public logRequest(req: any, res: any, duration: number): void {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
    });
  }

  // Structured logging for document processing
  public logDocumentProcessing(
    documentId: string,
    operation: string,
    status: string,
    duration?: number,
    metadata?: any
  ): void {
    this.info('Document Processing', {
      documentId,
      operation,
      status,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  // Error context logging
  public logErrorWithContext(
    operation: string,
    error: Error,
    context: Record<string, any> = {}
  ): void {
    this.error(`${operation} failed`, error, {
      operation,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}
