import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Logger } from './utils/logger';
import { errorHandler } from './utils/error-handler';
import { DocumentProcessorRouter } from './api/routes/document-processor';
import { HealthRouter } from './api/routes/health';
import { MetricsRouter } from './api/routes/metrics';
import { QueueManager } from './core/queue-manager';
import { StorageManager } from './core/storage-manager';
import { MetricsCollector } from './utils/metrics';

// Load environment variables
dotenv.config();

class DocumentProcessorService {
  private app: express.Application;
  private server: ReturnType<typeof import('http').createServer> | null;
  private logger: Logger;
  private queueManager!: QueueManager;
  private storageManager!: StorageManager;
  private metricsCollector!: MetricsCollector;
  private port: number;

  constructor() {
    this.app = express();
    this.logger = new Logger('DocumentProcessorService');
    this.port = parseInt(process.env.PORT || '3005', 10);

    this.initializeCoreServices();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeCoreServices(): Promise<void> {
    try {
      this.logger.info('Initializing core services...');

      // Initialize metrics collector
      this.metricsCollector = new MetricsCollector();
      await this.metricsCollector.initialize();

      // Initialize storage manager
      this.storageManager = new StorageManager();
      await this.storageManager.initialize();

      // Initialize queue manager
      this.queueManager = new QueueManager();
      await this.queueManager.initialize();

      this.logger.info('Core services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize core services:', error);
      throw error;
    }
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit requests per window
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api', limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          this.logger.info(message.trim());
        }
      }
    }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);

        // Record metrics
        this.metricsCollector.recordHttpRequest(req.method, req.path, res.statusCode, duration);
      });

      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.use('/health', new HealthRouter().router);

    // Metrics endpoint
    this.app.use('/metrics', new MetricsRouter().router);

    // Document processing API
    this.app.use('/api/v1', new DocumentProcessorRouter(
      this.queueManager,
      this.storageManager,
      this.metricsCollector
    ).router);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'SDLC Document Processor',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        capabilities: [
          'PDF text extraction',
          'OCR support',
          'Microsoft Office processing',
          'HTML/web content extraction',
          'Text cleaning and normalization',
          'Document chunking',
          'Batch processing',
          'Quality assessment'
        ]
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      this.server = createServer(this.app);

      this.server.listen(this.port, () => {
        this.logger.info(`🚀 Document Processor Service started on port ${this.port}`);
        this.logger.info(`📊 Health check available at http://localhost:${this.port}/health`);
        this.logger.info(`📈 Metrics available at http://localhost:${this.port}/metrics`);
        this.logger.info(`🔗 API documentation at http://localhost:${this.port}/api/v1/docs`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));
      process.on('SIGUSR2', () => this.shutdown('SIGUSR2')); // nodemon restart

    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  public async shutdown(signal: string): Promise<void> {
    this.logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      // Stop accepting new connections
      if (this.server) {
        this.server.close(async () => {
          this.logger.info('HTTP server closed');

          // Shutdown core services
          await this.queueManager.shutdown();
          await this.storageManager.shutdown();
          await this.metricsCollector.shutdown();

          this.logger.info('Graceful shutdown completed');
          process.exit(0);
        });
      }
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the service
const service = new DocumentProcessorService();
service.start().catch((error) => {
  console.error('Failed to start Document Processor Service:', error);
  process.exit(1);
});

export { DocumentProcessorService };
