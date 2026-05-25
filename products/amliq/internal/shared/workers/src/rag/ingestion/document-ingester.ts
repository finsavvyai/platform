import { ContentExtractor } from "../extraction/content-extractor";
/**
 * Document Ingestion Framework
 *
 * Multi-source document ingestion pipeline supporting regulatory feeds,
 * user uploads, API imports, and web crawling with jurisdiction-aware processing.
 */

import {
  SourceAdapter,
  RegulatoryFeedAdapter,
  UserUploadAdapter,
  ApiImportAdapter,
  WebCrawlAdapter
} from "./source-adapters";

export const DocumentSource = {
  REGULATORY_FEED: "regulatory_feed",
  USER_UPLOAD: "user_upload",
  API_IMPORT: "api_import",
  WEB_CRAWL: "web_crawl"
} as const;

export const DocumentType = {
  REGULATION: "regulation",
  POLICY: "policy",
  CASE_LAW: "case_law",
  MARKET_DATA: "market_data",
  OTHER: "other"
} as const;

export const Jurisdiction = {
  US: "US",
  EU: "EU",
  GLOBAL: "GLOBAL"
} as const;

export type DocumentSource = typeof DocumentSource[keyof typeof DocumentSource];
export type DocumentType = typeof DocumentType[keyof typeof DocumentType];
export type Jurisdiction = typeof Jurisdiction[keyof typeof Jurisdiction];

export interface IngestionRequest {
  source: DocumentSource;
  type?: DocumentType;
  jurisdiction: Jurisdiction;
  content?: string;
  url?: string;
  apiUrl?: string;
  metadata?: Record<string, any>;
}

export interface IngestionResult {
  ingestionId: string;
  documentId?: string;
  status: "pending" | "processing" | "completed" | "failed" | "queued";
  metadata?: any;
  message?: string;
  error?: string;
  retryable?: boolean;
  estimatedProcessingTime?: number;
}

export interface DocumentIngesterConfig {
  maxConcurrentIngestions: number;
  priorityWeights: Record<DocumentSource, number>;
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
    maxBackoffMs: number;
  };
}

export class DocumentIngester {
  private adapters: Map<DocumentSource, SourceAdapter>;
  private queue: any;
  private logger: any;
  private config: DocumentIngesterConfig;
  private activeIngestions: Map<string, boolean>;


  private contentExtractor?: ContentExtractor;

  constructor(
    queue: any,
    logger: any,
    config: DocumentIngesterConfig = DocumentIngester.defaultConfig()
  ) {
    this.adapters = new Map();
    this.queue = queue;
    this.logger = logger;
    this.config = config;
    this.activeIngestions = new Map();

    // Initialize adapters
    this.initializeAdapters();

    // Initialize AI content extractor if AI is available
    if (typeof globalThis !== "undefined" && (globalThis as any).AI) {
      this.contentExtractor = new ContentExtractor((globalThis as any).AI, logger);
    }  }

  private initializeAdapters(): void {
    this.adapters.set(DocumentSource.REGULATORY_FEED, new RegulatoryFeedAdapter());
    this.adapters.set(DocumentSource.USER_UPLOAD, new UserUploadAdapter());
    this.adapters.set(DocumentSource.API_IMPORT, new ApiImportAdapter());
    this.adapters.set(DocumentSource.WEB_CRAWL, new WebCrawlAdapter());
  }

  /**
   * Ingest document from specified source with jurisdiction awareness
   */
  async ingestDocument(request: IngestionRequest): Promise<IngestionResult> {
    const ingestionId = this.generateIngestionId();

    try {
      // Check concurrent ingestion limit
      if (this.activeIngestions.size >= this.config.maxConcurrentIngestions) {
        throw new Error("Maximum concurrent ingestions reached");
      }

      // Mark ingestion as active
      this.activeIngestions.set(ingestionId, true);

      this.logger?.info("Starting document ingestion", {
        ingestionId,
        source: request.source,
        type: request.type,
        jurisdiction: request.jurisdiction
      });

      // Get appropriate adapter
      const adapter = this.adapters.get(request.source);
      if (!adapter) {
        throw new Error(`No adapter found for source: ${request.source}`);
      }

      // Validate request
      await adapter.validateRequest(request);

      // Calculate priority based on source and jurisdiction
      const priority = this.calculatePriority(request);

      // Queue for processing if high load
      if (this.shouldQueue(request)) {
        await this.queueIngestion(ingestionId, request, priority);
        return {
          ingestionId,
          status: "queued",
          message: "Document queued for processing",
          estimatedProcessingTime: this.estimateProcessingTime(request)
        };
      }

      // Process immediately
      const result = await this.processIngestion(ingestionId, request, adapter);

      this.logger?.info("Document ingestion completed", {
        ingestionId,
        status: result.status,
        documentId: result.documentId
      });

      return result;

    } catch (error) {
      this.logger?.error("Document ingestion failed", {
        ingestionId,
        error: error.message,
        request
      });

      return {
        ingestionId,
        status: "failed",
        error: error.message,
        retryable: this.isRetryableError(error)
      };
    } finally {
      this.activeIngestions.delete(ingestionId);
    }
  }

  /**
   * Process ingestion with adapter and handle errors with retry logic
   */
  private async processIngestion(
    ingestionId: string,
    request: IngestionRequest,
    adapter: SourceAdapter,
    retryCount: number = 0
  ): Promise<IngestionResult> {
    try {
      // Fetch document content
      const content = await adapter.fetchDocument(request);

      // Extract metadata
      const metadata = await adapter.extractMetadata(content, request);

      // Classify document if not provided
      const documentType = request.type || this.classifyDocument(content, metadata);

      // Enhance metadata with jurisdiction information
      const enhancedMetadata = {
        ...metadata,
        jurisdiction: request.jurisdiction,
        source: request.source,
        ingestionId,
        ingestionTimestamp: new Date().toISOString(),
        documentType,
        priority: this.calculatePriority({ ...request, type: documentType })
      };

      // Generate document ID
      const documentId = this.generateDocumentId();

      // Store document in R2 (via queue)
      await this.storeDocument(content, enhancedMetadata, documentId);

      // Queue for AI processing including vector embedding generation
      await this.queueForAIProcessing(documentId, content, enhancedMetadata);

      return {
        ingestionId,
        documentId,
        status: "queued_for_vectorization",
        metadata: enhancedMetadata,
        message: "Document successfully ingested and queued for vector embedding generation"
      };

    } catch (error) {
      // Implement retry logic
      if (retryCount < this.config.retryConfig.maxRetries && this.isRetryableError(error)) {
        const backoffMs = Math.min(
          this.config.retryConfig.backoffMs * Math.pow(2, retryCount),
          this.config.retryConfig.maxBackoffMs
        );

        this.logger?.warn("Retrying document ingestion", {
          ingestionId,
          retryCount,
          backoffMs,
          error: error.message
        });

        await this.sleep(backoffMs);
        return this.processIngestion(ingestionId, request, adapter, retryCount + 1);
      }

      throw error;
    }
  }


  /**
   * Calculate priority based on source, jurisdiction, and document type
   */
  private calculatePriority(request: IngestionRequest): number {
    let priority = this.config.priorityWeights[request.source] || 1;

    // Boost priority for certain jurisdictions
    if (request.jurisdiction === Jurisdiction.US) {
      priority *= 1.2;
    } else if (request.jurisdiction === Jurisdiction.EU) {
      priority *= 1.1;
    }

    // Boost priority for certain document types
    if (request.type === DocumentType.REGULATION) {
      priority *= 1.5;
    } else if (request.type === DocumentType.POLICY) {
      priority *= 1.3;
    }

    return Math.round(priority * 100); // Convert to integer for queue priority
  }

  /**
   * Classify document type using simple rules
   */
  private classifyDocument(content: string, metadata: any): DocumentType {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes("regulation") || lowerContent.includes("federal register")) {
      return DocumentType.REGULATION;
    } else if (lowerContent.includes("policy") || lowerContent.includes("guideline")) {
      return DocumentType.POLICY;
    } else if (lowerContent.includes("court") || lowerContent.includes("v.") || lowerContent.includes("case")) {
      return DocumentType.CASE_LAW;
    } else if (lowerContent.includes("market") || lowerContent.includes("price") || lowerContent.includes("trading")) {
      return DocumentType.MARKET_DATA;
    } else {
      return DocumentType.OTHER;
    }
  }

  /**
   * Store document in R2 with metadata
   */
  private async storeDocument(content: string, metadata: any, documentId: string): Promise<void> {
    const key = `documents/${metadata.jurisdiction}/${metadata.documentType}/${documentId}.json`;

    const document = {
      id: documentId,
      content,
      metadata,
      createdAt: new Date().toISOString(),
      version: 1
    };

    // Store in R2 via queue
    if (this.queue) {
      await this.queue.sendMessage("r2-storage", {
        operation: "store",
        key,
        content: JSON.stringify(document),
        metadata: {
          contentType: "application/json",
          jurisdiction: metadata.jurisdiction,
          documentType: metadata.documentType
        }
      });
    }
  }

  /**
   * Queue document for AI processing
   */
  /**
   * Queue document for AI processing with content extraction
   */
  private async queueForAIProcessing(documentId: string, content: string, metadata: any): Promise<void> {
    if (this.queue) {
      // If AI extraction is available, process content before queuing
      if (this.contentExtractor) {
        try {
          const extractedContent = await this.contentExtractor.extractContent(documentId, content, metadata);

          await this.queue.sendMessage("ai-processing", {
            documentId,
            originalContent: content,
            extractedContent,
            metadata,
            processingSteps: [
              "embedding-generation",
              "knowledge-graph-integration"
            ]
          });
        } catch (error) {
          this.logger?.warn("AI content extraction failed, using original content", { documentId, error: error.message });

          // Fallback to original content
          await this.queue.sendMessage("ai-processing", {
            documentId,
            content,
            metadata,
            processingSteps: [
              "content-extraction",
              "embedding-generation",
              "knowledge-graph-integration"
            ]
          });
        }
      } else {
        // No AI available, queue for later processing
        await this.queue.sendMessage("ai-processing", {
          documentId,
          content,
          metadata,
          processingSteps: [
            "content-extraction",
            "embedding-generation",
            "knowledge-graph-integration"
          ]
        });
      }
    }
  }    }

  /** Check if ingestion should be queued based on current load
   */
  private shouldQueue(request: IngestionRequest): boolean {
    return this.activeIngestions.size >= this.config.maxConcurrentIngestions * 0.8;
  }

  /**
   * Queue ingestion for later processing
   */
  private async queueIngestion(ingestionId: string, request: IngestionRequest, priority: number): Promise<void> {
    if (this.queue) {
      await this.queue.sendMessage("document-ingestion", {
        ingestionId,
        request,
        priority,
        queuedAt: new Date().toISOString()
      }, { priority });
    }
  }

  /**
   * Estimate processing time based on document characteristics
   */
  private estimateProcessingTime(request: IngestionRequest): number {
    // Base time in seconds
    let baseTime = 30;

    // Adjust based on source
    switch (request.source) {
      case DocumentSource.REGULATORY_FEED:
        baseTime = 45;
        break;
      case DocumentSource.WEB_CRAWL:
        baseTime = 60;
        break;
      case DocumentSource.API_IMPORT:
        baseTime = 35;
        break;
      case DocumentSource.USER_UPLOAD:
        baseTime = 25;
        break;
    }

    // Adjust based on jurisdiction
    if (request.jurisdiction === Jurisdiction.GLOBAL) {
      baseTime *= 1.3;
    }

    return Math.round(baseTime);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      "network timeout",
      "temporary failure",
      "rate limit",
      "service unavailable"
    ];

    return retryableErrors.some(retryableError =>
      error.message.toLowerCase().includes(retryableError)
    );
  }

  /**
   * Generate unique ingestion ID
   */
  private generateIngestionId(): string {
    return `ingest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep helper for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current ingestion statistics
   */
  getIngestionStats(): {
    active: number;
    maxConcurrent: number;
  } {
    return {
      active: this.activeIngestions.size,
      maxConcurrent: this.config.maxConcurrentIngestions
    };
  }

  /**
   * Default configuration
   */
  static defaultConfig(): DocumentIngesterConfig {
    return {
      maxConcurrentIngestions: 10,
      priorityWeights: {
        [DocumentSource.REGULATORY_FEED]: 10,
        [DocumentSource.USER_UPLOAD]: 5,
        [DocumentSource.API_IMPORT]: 7,
        [DocumentSource.WEB_CRAWL]: 3
      },
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000
      }
    };
  }
}
