import client from 'prom-client';
import { Logger } from './logger';

export class MetricsCollector {
  private logger: Logger;
  private register: client.Registry;
  private httpRequestDuration!: client.Histogram<string>;
  private httpRequestTotal!: client.Counter<string>;
  private documentProcessingDuration!: client.Histogram<string>;
  private documentProcessingTotal!: client.Counter<string>;
  private documentProcessingErrors!: client.Counter<string>;
  private queueSize!: client.Gauge<string>;
  private storageUsage!: client.Gauge<string>;
  private ocrProcessingDuration!: client.Histogram<string>;
  private textExtractionDuration!: client.Histogram<string>;
  private chunkingDuration!: client.Histogram<string>;
  private qualityAssessmentDuration!: client.Histogram<string>;

  constructor() {
    this.logger = new Logger('MetricsCollector');
    this.register = new client.Registry();

    // Add default metrics
    client.collectDefaultMetrics({ register: this.register });

    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // HTTP request metrics
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register],
    });

    this.httpRequestTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    // Document processing metrics
    this.documentProcessingDuration = new client.Histogram({
      name: 'document_processing_duration_seconds',
      help: 'Duration of document processing in seconds',
      labelNames: ['document_type', 'operation', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [this.register],
    });

    this.documentProcessingTotal = new client.Counter({
      name: 'document_processing_total',
      help: 'Total number of document processing operations',
      labelNames: ['document_type', 'operation', 'status'],
      registers: [this.register],
    });

    this.documentProcessingErrors = new client.Counter({
      name: 'document_processing_errors_total',
      help: 'Total number of document processing errors',
      labelNames: ['document_type', 'operation', 'error_type'],
      registers: [this.register],
    });

    // Queue metrics
    this.queueSize = new client.Gauge({
      name: 'queue_size',
      help: 'Current queue size',
      labelNames: ['queue_name'],
      registers: [this.register],
    });

    // Storage metrics
    this.storageUsage = new client.Gauge({
      name: 'storage_usage_bytes',
      help: 'Current storage usage in bytes',
      labelNames: ['storage_type'],
      registers: [this.register],
    });

    // Specific operation metrics
    this.ocrProcessingDuration = new client.Histogram({
      name: 'ocr_processing_duration_seconds',
      help: 'Duration of OCR processing in seconds',
      labelNames: ['document_type', 'language'],
      buckets: [1, 2, 5, 10, 20, 30, 60, 120],
      registers: [this.register],
    });

    this.textExtractionDuration = new client.Histogram({
      name: 'text_extraction_duration_seconds',
      help: 'Duration of text extraction in seconds',
      labelNames: ['document_type', 'extraction_method'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 20],
      registers: [this.register],
    });

    this.chunkingDuration = new client.Histogram({
      name: 'document_chunking_duration_seconds',
      help: 'Duration of document chunking in seconds',
      labelNames: ['chunking_strategy', 'document_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.qualityAssessmentDuration = new client.Histogram({
      name: 'quality_assessment_duration_seconds',
      help: 'Duration of quality assessment in seconds',
      labelNames: ['assessment_type', 'document_type'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });
  }

  public async initialize(): Promise<void> {
    this.logger.info('Metrics collector initialized');
  }

  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString(),
    };

    this.httpRequestDuration.observe(labels, duration / 1000); // Convert ms to seconds
    this.httpRequestTotal.inc(labels);
  }

  public recordDocumentProcessing(
    documentType: string,
    operation: string,
    status: string,
    duration: number
  ): void {
    const labels = { document_type: documentType, operation, status };

    this.documentProcessingDuration.observe(labels, duration / 1000);
    this.documentProcessingTotal.inc(labels);

    if (status === 'error') {
      this.documentProcessingErrors.inc({
        document_type: documentType,
        operation,
        error_type: 'processing_error',
      });
    }
  }

  public recordDocumentProcessingError(
    documentType: string,
    operation: string,
    errorType: string
  ): void {
    this.documentProcessingErrors.inc({
      document_type: documentType,
      operation,
      error_type: errorType,
    });
  }

  public recordOCRProcessing(
    documentType: string,
    language: string,
    duration: number
  ): void {
    this.ocrProcessingDuration.observe(
      { document_type: documentType, language },
      duration / 1000
    );
  }

  public recordTextExtraction(
    documentType: string,
    extractionMethod: string,
    duration: number
  ): void {
    this.textExtractionDuration.observe(
      { document_type: documentType, extraction_method: extractionMethod },
      duration / 1000
    );
  }

  public recordChunkingOperation(
    chunkingStrategy: string,
    documentType: string,
    duration: number
  ): void {
    this.chunkingDuration.observe(
      { chunking_strategy: chunkingStrategy, document_type: documentType },
      duration / 1000
    );
  }

  public recordQualityAssessment(
    assessmentType: string,
    documentType: string,
    duration: number
  ): void {
    this.qualityAssessmentDuration.observe(
      { assessment_type: assessmentType, document_type: documentType },
      duration / 1000
    );
  }

  public setQueueSize(queueName: string, size: number): void {
    this.queueSize.set({ queue_name: queueName }, size);
  }

  public setStorageUsage(storageType: string, usage: number): void {
    this.storageUsage.set({ storage_type: storageType }, usage);
  }

  public async getMetrics(): Promise<string> {
    return await this.register.metrics();
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Metrics collector shutdown');
  }

  // Custom metrics can be added dynamically
  public createCustomMetric(
    type: 'counter' | 'gauge' | 'histogram' | 'summary',
    name: string,
    help: string,
    labelNames?: string[]
  ): client.Counter | client.Gauge | client.Histogram | client.Summary {
    const config: { name: string; help: string; labelNames: string[]; registers: client.Registry[]; buckets?: number[] } = {
      name,
      help,
      labelNames: labelNames || [],
      registers: [this.register],
    };

    switch (type) {
      case 'counter':
        return new client.Counter(config);
      case 'gauge':
        return new client.Gauge(config);
      case 'histogram':
        return new client.Histogram({
          ...config,
          buckets: [0.1, 0.5, 1, 2, 5, 10],
        });
      case 'summary':
        return new client.Summary({
          ...config,
          percentiles: [0.5, 0.9, 0.95, 0.99],
        });
      default:
        throw new Error(`Unsupported metric type: ${type}`);
    }
  }
}
