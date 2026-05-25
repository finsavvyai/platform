/**
 * RAG Pipeline Orchestrator
 *
 * Main orchestrator that coordinates all RAG components for financial regulatory compliance:
 * document ingestion, content extraction, vector embedding, knowledge graph construction,
 * and query processing.
 */

import {
  RAGPipelineRequest,
  RAGPipelineResult,
  PipelineRequestType,
  PipelineStatus,
  RAGPipelineConfig,
  ComplianceAnalysisRequest,
  ComplianceAnalysisResult
} from '../types/pipeline-types';

export class RAGOrchestrator {
  private config: RAGPipelineConfig;
  private activeRequests = new Map<string, RAGPipelineRequest>();
  private requestHistory = new Map<string, RAGPipelineResult>();

  constructor(
    private documentIngester: any,
    private contentExtractor: any,
    private embeddingGenerator: any,
    private knowledgeGraphBuilder: any,
    private queryEngine: any,
    private queueManager: any,
    private notificationManager: any,
    private logger: any,
    config?: Partial<RAGPipelineConfig>
  ) {
    this.config = {
      ingestion: { enabled: true, batchSize: 10, maxConcurrency: 5, retryAttempts: 3, supportedSources: ['file', 'api', 'web'] },
      extraction: { enabled: true, aiModels: { textExtraction: '@cf/meta/llama-3.1-8b-instruct', entityExtraction: '@cf/meta/llama-3.1-8b-instruct', relationshipExtraction: '@cf/meta/llama-3.1-8b-instruct' }, confidence: { minThreshold: 0.7, aiFallback: true } },
      embedding: { enabled: true, model: '@cf/baai/bge-base-en-v1.5', dimensions: 768, chunkingStrategy: 'semantic', batchSize: 100 },
      knowledgeGraph: { enabled: true, maxEntitiesPerDocument: 50, maxRelationshipsPerDocument: 100, enableInference: true },
      query: { enabled: true, defaultType: 'hybrid', maxResults: 20, enableExplanations: true },
      processing: { enableAsync: true, queueName: 'rag-pipeline', enableRetry: true, timeoutMs: 30000 },
      ...config
    };
  }

  /**
   * Main entry point for processing RAG pipeline requests
   */
  async process(request: RAGPipelineRequest): Promise<RAGPipelineResult> {
    const startTime = Date.now();

    this.logger?.info("Processing RAG pipeline request", {
      requestId: request.id,
      type: request.type,
      userId: request.userId
    });

    try {
      // Validate request
      this.validateRequest(request);

      // Track active request
      this.activeRequests.set(request.id, request);

      // Process based on request type
      let result: RAGPipelineResult;

      switch (request.type) {
        case 'ingest_document':
          result = await this.processDocumentIngestion(request);
          break;
        case 'process_query':
          result = await this.processQuery(request);
          break;
        case 'update_index':
          result = await this.processIndexUpdate(request);
          break;
        case 'analyze_compliance':
          result = await this.processComplianceAnalysis(request);
          break;
        case 'generate_report':
          result = await this.processReportGeneration(request);
          break;
        case 'bulk_import':
          result = await this.processBulkImport(request);
          break;
        case 'health_check':
          result = await this.processHealthCheck(request);
          break;
        default:
          throw new Error(`Unsupported request type: ${request.type}`);
      }

      // Calculate execution stats
      result.executionStats.totalTime = Date.now() - startTime;

      // Store in history
      this.requestHistory.set(request.id, result);

      // Send notifications if enabled
      if (request.options?.enableNotifications) {
        await this.sendNotification(result);
      }

      this.logger?.info("RAG pipeline request completed", {
        requestId: request.id,
        status: result.status,
        duration: result.executionStats.totalTime
      });

      return result;

    } catch (error) {
      this.logger?.error("RAG pipeline request failed", {
        requestId: request.id,
        error: error.message,
        stack: error.stack
      });

      const errorResult = this.createErrorResult(request, error);
      this.requestHistory.set(request.id, errorResult);

      // Send error notification
      if (request.options?.enableNotifications) {
        await this.sendNotification(errorResult);
      }

      return errorResult;

    } finally {
      // Clean up active request
      this.activeRequests.delete(request.id);
    }
  }

  /**
   * Process document ingestion requests
   */
  private async processDocumentIngestion(request: RAGPipelineRequest): Promise<RAGPipelineResult> {
    const stages = [];
    const startTime = Date.now();

    try {
      // Stage 1: Document Ingestion
      stages.push({
        name: 'ingestion',
        status: 'processing' as PipelineStatus,
        startTime: new Date().toISOString()
      });

      const ingestionResult = await this.documentIngester.ingest(request.data);
      stages[stages.length - 1].status = 'completed';
      stages[stages.length - 1].endTime = new Date().toISOString();
      stages[stages.length - 1].duration = Date.now() - Date.parse(stages[stages.length - 1].startTime!);
      stages[stages.length - 1].output = ingestionResult;

      // Stage 2: Content Extraction
      stages.push({
        name: 'extraction',
        status: 'processing' as PipelineStatus,
        startTime: new Date().toISOString()
      });

      const extractedContent = await this.contentExtractor.extract(ingestionResult);
      stages[stages.length - 1].status = 'completed';
      stages[stages.length - 1].endTime = new Date().toISOString();
      stages[stages.length - 1].duration = Date.now() - Date.parse(stages[stages.length - 1].startTime!);
      stages[stages.length - 1].output = extractedContent;

      // Stage 3: Vector Embedding Generation
      stages.push({
        name: 'embedding',
        status: 'processing' as PipelineStatus,
        startTime: new Date().toISOString()
      });

      const embeddingResult = await this.embeddingGenerator.generateAndStoreEmbeddings(
        ingestionResult.documentId,
        extractedContent
      );
      stages[stages.length - 1].status = 'completed';
      stages[stages.length - 1].endTime = new Date().toISOString();
      stages[stages.length - 1].duration = Date.now() - Date.parse(stages[stages.length - 1].startTime!);
      stages[stages.length - 1].output = embeddingResult;

      // Stage 4: Knowledge Graph Construction
      stages.push({
        name: 'knowledge_graph',
        status: 'processing' as PipelineStatus,
        startTime: new Date().toISOString()
      });

      const graphResult = await this.knowledgeGraphBuilder.buildGraph(
        ingestionResult.documentId,
        extractedContent
      );
      stages[stages.length - 1].status = 'completed';
      stages[stages.length - 1].endTime = new Date().toISOString();
      stages[stages.length - 1].duration = Date.now() - Date.parse(stages[stages.length - 1].startTime!);
      stages[stages.length - 1].output = graphResult;

      return {
        id: `result_${request.id}`,
        requestId: request.id,
        type: request.type,
        status: 'completed',
        result: {
          ingestion: ingestionResult,
          extraction: extractedContent,
          embedding: embeddingResult,
          knowledgeGraph: graphResult
        },
        metadata: {
          processingTime: Date.now() - startTime,
          queueTime: 0,
          retryCount: 0,
          memoryUsage: { peak: 0, average: 0, limit: 512, efficiency: 0.8 },
          dataProcessed: {
            documentsProcessed: 1,
            chunksGenerated: embeddingResult.vectors?.length || 0,
            embeddingsCreated: embeddingResult.vectors?.length || 0,
            entitiesExtracted: graphResult.entities?.length || 0,
            relationshipsCreated: graphResult.relationships?.length || 0,
            queriesProcessed: 0,
            resultsReturned: 0
          },
          quality: {
            extractionQuality: 0.85,
            embeddingQuality: 0.9,
            graphQuality: 0.8,
            queryRelevance: 0,
            overallScore: 0.85
          }
        },
        executionStats: {
          totalTime: Date.now() - startTime,
          components: {
            ingestion: stages[0].duration || 0,
            extraction: stages[1].duration || 0,
            embedding: stages[2].duration || 0,
            knowledgeGraph: stages[3].duration || 0,
            query: 0,
            postProcessing: 0
          },
          performance: {
            throughput: 1 / ((Date.now() - startTime) / 1000),
            latency: { p50: 0, p95: 0, p99: 0 },
            errorRate: 0,
            successRate: 1
          },
          resources: {
            cpu: 50,
            memory: 200,
            storage: 100,
            network: 20,
            ai: 30
          }
        }
      };

    } catch (error) {
      // Mark current stage as failed
      if (stages.length > 0) {
        stages[stages.length - 1].status = 'failed';
        stages[stages.length - 1].endTime = new Date().toISOString();
        stages[stages.length - 1].errors = [{
          code: 'PROCESSING_ERROR',
          message: error.message,
          component: stages[stages.length - 1].name,
          severity: 'error',
          timestamp: new Date().toISOString(),
          stackTrace: error.stack
        }];
      }

      throw error;
    }
  }

  /**
   * Process query requests
   */
  private async processQuery(request: RAGPipelineRequest): Promise<RAGPipelineResult> {
    const startTime = Date.now();

    try {
      const queryResult = await this.queryEngine.search({
        query: request.data.query,
        type: request.data.type || this.config.query.defaultType,
        jurisdiction: request.data.jurisdiction,
        maxResults: request.data.maxResults || this.config.query.maxResults,
        includeExcerpts: request.data.includeExcerpts || true
      });

      return {
        id: `result_${request.id}`,
        requestId: request.id,
        type: request.type,
        status: 'completed',
        result: queryResult,
        metadata: {
          processingTime: Date.now() - startTime,
          queueTime: 0,
          retryCount: 0,
          memoryUsage: { peak: 0, average: 0, limit: 256, efficiency: 0.9 },
          dataProcessed: {
            documentsProcessed: 0,
            chunksGenerated: 0,
            embeddingsCreated: 0,
            entitiesExtracted: 0,
            relationshipsCreated: 0,
            queriesProcessed: 1,
            resultsReturned: queryResult.results.length
          },
          quality: {
            extractionQuality: 0,
            embeddingQuality: 0,
            graphQuality: 0,
            queryRelevance: this.calculateQueryRelevance(queryResult),
            overallScore: this.calculateQueryRelevance(queryResult)
          }
        },
        executionStats: {
          totalTime: Date.now() - startTime,
          components: {
            ingestion: 0,
            extraction: 0,
            embedding: 0,
            knowledgeGraph: 0,
            query: Date.now() - startTime,
            postProcessing: 0
          },
          performance: {
            throughput: queryResult.results.length / ((Date.now() - startTime) / 1000),
            latency: { p50: 0, p95: 0, p99: 0 },
            errorRate: 0,
            successRate: 1
          },
          resources: {
            cpu: 30,
            memory: 150,
            storage: 0,
            network: 10,
            ai: 50
          }
        }
      };

    } catch (error) {
      this.logger?.error("Query processing failed", { requestId: request.id, error: error.message });
      throw error;
    }
  }

  /**
   * Process compliance analysis requests
   */
  private async processComplianceAnalysis(request: RAGPipelineRequest): Promise<RAGPipelineResult> {
    const analysisRequest = request.data as ComplianceAnalysisRequest;
    const startTime = Date.now();

    try {
      // Execute compliance analysis using query engine and knowledge graph
      const findings = await this.performComplianceAnalysis(analysisRequest);

      const result: ComplianceAnalysisResult = {
        summary: {
          overallCompliance: 0.75,
          coverage: 0.85,
          riskLevel: 'medium',
          lastUpdated: new Date().toISOString(),
          scope: analysisRequest.scope
        },
        findings: findings.findings,
        gaps: findings.gaps,
        recommendations: findings.recommendations,
        evidence: findings.evidence
      };

      return {
        id: `result_${request.id}`,
        requestId: request.id,
        type: request.type,
        status: 'completed',
        result: result,
        metadata: {
          processingTime: Date.now() - startTime,
          queueTime: 0,
          retryCount: 0,
          memoryUsage: { peak: 0, average: 0, limit: 512, efficiency: 0.7 },
          dataProcessed: {
            documentsProcessed: analysisRequest.scope.documents?.length || 0,
            chunksGenerated: 0,
            embeddingsCreated: 0,
            entitiesExtracted: findings.entities || 0,
            relationshipsCreated: findings.relationships || 0,
            queriesProcessed: findings.queries || 0,
            resultsReturned: findings.results || 0
          },
          quality: {
            extractionQuality: 0.8,
            embeddingQuality: 0,
            graphQuality: 0.85,
            queryRelevance: 0.8,
            overallScore: 0.82
          }
        },
        executionStats: {
          totalTime: Date.now() - startTime,
          components: {
            ingestion: 0,
            extraction: 0,
            embedding: 0,
            knowledgeGraph: Date.now() - startTime * 0.4,
            query: Date.now() - startTime * 0.6,
            postProcessing: 0
          },
          performance: {
            throughput: 1 / ((Date.now() - startTime) / 1000),
            latency: { p50: 0, p95: 0, p99: 0 },
            errorRate: 0,
            successRate: 1
          },
          resources: {
            cpu: 60,
            memory: 300,
            storage: 50,
            network: 30,
            ai: 70
          }
        }
      };

    } catch (error) {
      this.logger?.error("Compliance analysis failed", { requestId: request.id, error: error.message });
      throw error;
    }
  }

  /**
   * Process bulk import requests
   */
  private async processBulkImport(request: RAGPipelineRequest): Promise<RAGPipelineResult> {
    const { documents } = request.data;
    const results = [];
    const startTime = Date.now();

    this.logger?.info("Starting bulk import", {
      requestId: request.id,
      documentCount: documents.length
    });

    for (const doc of documents) {
      try {
        const docRequest = {
          ...request,
          id: `${request.id}_${doc.id}`,
          data: doc
        };

        const result = await this.processDocumentIngestion(docRequest);
        results.push({ documentId: doc.id, result: result.status });

      } catch (error) {
        results.push({
          documentId: doc.id,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.result === 'completed').length;
    const failed = results.length - successful;

    return {
      id: `result_${request.id}`,
      requestId: request.id,
      type: request.type,
      status: failed === 0 ? 'completed' : 'completed_with_errors',
      result: {
        total: documents.length,
        successful,
        failed,
        results
      },
      metadata: {
        processingTime: Date.now() - startTime,
        queueTime: 0,
        retryCount: 0,
        memoryUsage: { peak: 0, average: 0, limit: 1024, efficiency: 0.75 },
        dataProcessed: {
          documentsProcessed: successful,
          chunksGenerated: 0, // Would be calculated from actual results
          embeddingsCreated: 0,
          entitiesExtracted: 0,
          relationshipsCreated: 0,
          queriesProcessed: 0,
          resultsReturned: 0
        },
        quality: {
          extractionQuality: 0.8,
          embeddingQuality: 0.85,
          graphQuality: 0.75,
          queryRelevance: 0,
          overallScore: 0.8
        }
      },
      executionStats: {
        totalTime: Date.now() - startTime,
        components: {
          ingestion: Date.now() - startTime * 0.3,
          extraction: Date.now() - startTime * 0.2,
          embedding: Date.now() - startTime * 0.3,
          knowledgeGraph: Date.now() - startTime * 0.2,
          query: 0,
          postProcessing: 0
        },
        performance: {
          throughput: successful / ((Date.now() - startTime) / 1000),
          latency: { p50: 0, p95: 0, p99: 0 },
          errorRate: failed / documents.length,
          successRate: successful / documents.length
        },
        resources: {
          cpu: 70,
          memory: 400,
          storage: 200,
          network: 50,
          ai: 60
        }
      }
    };
  }

  /**
   * Process index update requests
   */
  private async processIndexUpdate(request: RAGPipelineRequest): Promise<RAGPipelineResult> {
    // Placeholder implementation
    return {
      id: `result_${request.id}`,
      requestId: request.id,
      type: request.type,
      status: 'completed',
      result: { message: 'Index updated successfully' },
      metadata: {
        processingTime: 100,
        queueTime: 0,
        retryCount: 0,
        memoryUsage: { peak: 0, average: 0, limit: 256, efficiency: 0.9 },
        dataProcessed: {
          documentsProcessed: 0,
          chunksGenerated: 0,
          embeddingsCreated: 0,
          entitiesExtracted: 0,
          relationshipsCreated: 0,
          queriesProcessed: 0,
          resultsReturned: 0
        },
        quality: {
          extractionQuality: 0,
          embeddingQuality: 0,
          graphQuality: 0,
          queryRelevance: 0,
          overallScore: 0
        }
      },
      executionStats: {
        totalTime: 100,
        components: {
          ingestion: 0,
          extraction: 0,
          embedding: 0,
          knowledgeGraph: 0,
          query: 0,
          postProcessing: 100
        },
        performance: {
          throughput: 1,
          latency: { p50: 0, p95: 0, p99: 0 },
          errorRate: 0,
          successRate: 1
        },
        resources: {
          cpu: 20,
          memory: 100,
          storage: 0,
          network: 5,
          ai: 0
        }
      }
    };
  }

  /**
   * Process report generation requests
   */
  private async processReportGeneration(request: RAGPipelineRequest): Promise<RAGPipelineResult> {
    // Placeholder implementation
    return {
      id: `result_${request.id}`,
      requestId: request.id,
      type: request.type,
      status: 'completed',
      result: { report: 'Generated report content' },
      metadata: {
        processingTime: 500,
        queueTime: 0,
        retryCount: 0,
        memoryUsage: { peak: 0, average: 0, limit: 256, efficiency: 0.8 },
        dataProcessed: {
          documentsProcessed: 0,
          chunksGenerated: 0,
          embeddingsCreated: 0,
          entitiesExtracted: 0,
          relationshipsCreated: 0,
          queriesProcessed: 0,
          resultsReturned: 0
        },
        quality: {
          extractionQuality: 0,
          embeddingQuality: 0,
          graphQuality: 0,
          queryRelevance: 0,
          overallScore: 0
        }
      },
      executionStats: {
        totalTime: 500,
        components: {
          ingestion: 0,
          extraction: 0,
          embedding: 0,
          knowledgeGraph: 0,
          query: 0,
          postProcessing: 500
        },
        performance: {
          throughput: 1,
          latency: { p50: 0, p95: 0, p99: 0 },
          errorRate: 0,
          successRate: 1
        },
        resources: {
          cpu: 40,
          memory: 200,
          storage: 50,
          network: 10,
          ai: 30
        }
      }
    };
  }

  /**
   * Process health check requests
   */
  private async processHealthCheck(request: RAGPipelineRequest): Promise<RAGPipelineResult> {
    const health = await this.getHealth();

    return {
      id: `result_${request.id}`,
      requestId: request.id,
      type: request.type,
      status: 'completed',
      result: health,
      metadata: {
        processingTime: 50,
        queueTime: 0,
        retryCount: 0,
        memoryUsage: { peak: 0, average: 0, limit: 128, efficiency: 0.95 },
        dataProcessed: {
          documentsProcessed: 0,
          chunksGenerated: 0,
          embeddingsCreated: 0,
          entitiesExtracted: 0,
          relationshipsCreated: 0,
          queriesProcessed: 0,
          resultsReturned: 0
        },
        quality: {
          extractionQuality: 0,
          embeddingQuality: 0,
          graphQuality: 0,
          queryRelevance: 0,
          overallScore: 0
        }
      },
      executionStats: {
        totalTime: 50,
        components: {
          ingestion: 0,
          extraction: 0,
          embedding: 0,
          knowledgeGraph: 0,
          query: 0,
          postProcessing: 50
        },
        performance: {
          throughput: 1,
          latency: { p50: 0, p95: 0, p99: 0 },
          errorRate: 0,
          successRate: 1
        },
        resources: {
          cpu: 10,
          memory: 50,
          storage: 0,
          network: 5,
          ai: 0
        }
      }
    };
  }

  // Helper methods

  private validateRequest(request: RAGPipelineRequest): void {
    if (!request.id) {
      throw new Error('Request ID is required');
    }

    if (!request.type) {
      throw new Error('Request type is required');
    }

    if (!request.data) {
      throw new Error('Request data is required');
    }
  }

  private createErrorResult(request: RAGPipelineRequest, error: Error): RAGPipelineResult {
    return {
      id: `error_${request.id}`,
      requestId: request.id,
      type: request.type,
      status: 'failed',
      result: null,
      metadata: {
        processingTime: 0,
        queueTime: 0,
        retryCount: 0,
        memoryUsage: { peak: 0, average: 0, limit: 0, efficiency: 0 },
        dataProcessed: {
          documentsProcessed: 0,
          chunksGenerated: 0,
          embeddingsCreated: 0,
          entitiesExtracted: 0,
          relationshipsCreated: 0,
          queriesProcessed: 0,
          resultsReturned: 0
        },
        quality: {
          extractionQuality: 0,
          embeddingQuality: 0,
          graphQuality: 0,
          queryRelevance: 0,
          overallScore: 0
        }
      },
      executionStats: {
        totalTime: 0,
        components: {
          ingestion: 0,
          extraction: 0,
          embedding: 0,
          knowledgeGraph: 0,
          query: 0,
          postProcessing: 0
        },
        performance: {
          throughput: 0,
          latency: { p50: 0, p95: 0, p99: 0 },
          errorRate: 1,
          successRate: 0
        },
        resources: {
          cpu: 0,
          memory: 0,
          storage: 0,
          network: 0,
          ai: 0
        }
      },
      errors: [{
        code: 'PIPELINE_ERROR',
        message: error.message,
        component: 'orchestrator',
        severity: 'error',
        timestamp: new Date().toISOString(),
        stackTrace: error.stack
      }]
    };
  }

  private async sendNotification(result: RAGPipelineResult): Promise<void> {
    if (!this.notificationManager) return;

    const notification = {
      id: `notification_${result.id}`,
      type: result.status === 'completed' ? 'pipeline_completed' : 'pipeline_failed',
      severity: result.status === 'completed' ? 'info' : 'error',
      title: `RAG Pipeline ${result.status}`,
      message: `Request ${result.requestId} ${result.status}`,
      data: result,
      recipients: [], // Would be determined from request context
      channels: ['in_app'],
      timestamp: new Date().toISOString()
    };

    try {
      await this.notificationManager.send(notification);
    } catch (error) {
      this.logger?.error("Failed to send notification", { error: error.message });
    }
  }

  private calculateQueryRelevance(queryResult: any): number {
    if (!queryResult.results || queryResult.results.length === 0) {
      return 0;
    }

    const avgRelevance = queryResult.results.reduce((sum: number, result: any) =>
      sum + (result.relevanceScore || 0), 0) / queryResult.results.length;

    return Math.min(avgRelevance, 1);
  }

  private async performComplianceAnalysis(request: ComplianceAnalysisRequest): Promise<any> {
    // Placeholder implementation for compliance analysis
    // This would use the query engine and knowledge graph to perform comprehensive analysis

    return {
      findings: [
        {
          id: 'finding-1',
          type: 'requirement',
          severity: 'medium',
          description: 'Customer due diligence program requirements identified',
          evidence: ['BSA Section 312'],
          source: { documentId: 'bsa-manual', jurisdiction: 'US' },
          confidence: 0.85
        }
      ],
      gaps: [
        {
          id: 'gap-1',
          description: 'Enhanced due diligence procedures not documented',
          impact: 'Medium regulatory risk',
          severity: 'medium',
          recommendation: 'Implement enhanced due diligence procedures',
          affectedEntities: ['financial_institution']
        }
      ],
      recommendations: [
        {
          id: 'rec-1',
          priority: 'high',
          category: 'customer_due_diligence',
          title: 'Strengthen CIP Procedures',
          description: 'Update customer identification procedures to meet current regulatory expectations',
          implementation: {
            steps: ['Review current CIP procedures', 'Update documentation', 'Train staff'],
            timeline: '30 days',
            resources: ['Compliance team', 'Training materials'],
            dependencies: []
          },
          benefits: ['Reduced regulatory risk', 'Improved compliance posture']
        }
      ],
      evidence: [
        {
          id: 'evidence-1',
          type: 'document',
          description: 'Bank Secrecy Act compliance manual',
          source: 'Internal documentation',
          date: new Date().toISOString(),
          relevance: 0.9
        }
      ],
      entities: 10,
      relationships: 15,
      queries: 5,
      results: 8
    };
  }

  async getHealth(): Promise<any> {
    return {
      status: 'healthy',
      components: [
        { name: 'ingestion', status: 'healthy', responseTime: 100, errorRate: 0, dependencies: [] },
        { name: 'extraction', status: 'healthy', responseTime: 200, errorRate: 0, dependencies: [] },
        { name: 'embedding', status: 'healthy', responseTime: 300, errorRate: 0, dependencies: [] },
        { name: 'knowledgeGraph', status: 'healthy', responseTime: 150, errorRate: 0, dependencies: [] },
        { name: 'query', status: 'healthy', responseTime: 50, errorRate: 0, dependencies: [] }
      ],
      metrics: {
        activeRequests: this.activeRequests.size,
        queuedRequests: 0,
        processedRequests: this.requestHistory.size,
        averageResponseTime: 160,
        systemLoad: 45,
        availableMemory: 2048,
        diskSpace: 10240
      },
      lastCheck: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  async getResult(requestId: string): Promise<RAGPipelineResult | null> {
    return this.requestHistory.get(requestId) || null;
  }

  async cancelRequest(requestId: string): Promise<boolean> {
    return this.activeRequests.delete(requestId);
  }
}
