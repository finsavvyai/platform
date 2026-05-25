/**
 * FinSavvy AI Suite - Intelligent Document Processing System
 *
 * Revolutionary document intelligence system that integrates RAG, multi-modal AI,
 * real-time learning, and knowledge base capabilities for comprehensive document understanding.
 */

import { Logger } from '../utils/logger';
import { DatabaseService } from '../services/database-service';
import { VectorEmbeddingService } from '../rag/vector-service';
import { KnowledgeBaseService } from '../rag/knowledge-base';
import { MultiModalAIProcessor, ProcessingRequest } from './multimodal-processor';
import { DocumentAIService, Document, DocumentAnalysisResult } from './document-ai';
import { LearningEngine, LearningEvent } from './learning-engine';

export interface IntelligentDocumentRequest {
  id: string;
  user_id: string;
  organization_id: string;
  session_id: string;
  documents: Array<{
    content?: string;
    file_url?: string;
    type?: string;
    metadata?: Record<string, any>;
  }>;
  processing_options: {
    analysis_level: 'basic' | 'standard' | 'comprehensive' | 'deep';
    enable_rag: boolean;
    enable_multimodal: boolean;
    enable_learning: boolean;
    compliance_level: 'standard' | 'enhanced' | 'full';
    language_preferences?: string[];
    custom_patterns?: Record<string, any>;
  };
  business_context: {
    product_area: 'billing' | 'compliance' | 'intelligence' | 'risk' | 'general';
    use_case: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    regulatory_requirements?: string[];
  };
}

export interface IntelligentDocumentResult {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  documents: Array<{
    document_id: string;
    analysis: DocumentAnalysisResult;
    rag_insights: any;
    knowledge_integration: any;
    personalization: any;
  }>;
  cross_document_insights: {
    relationships: Array<{
      source_doc: string;
      target_doc: string;
      relationship_type: string;
      confidence: number;
      details: any;
    }>;
    themes: Array<{
      theme: string;
      relevance_score: number;
      documents: string[];
      insights: string[];
    }>;
    anomalies: Array<{
      type: string;
      severity: string;
      description: string;
      affected_documents: string[];
    }>;
    recommendations: Array<{
      category: string;
      priority: string;
      recommendation: string;
      rationale: string;
      action_items: string[];
    }>;
  };
  business_intelligence: {
    summary: string;
    key_findings: string[];
    risk_assessment: Array<{
      risk: string;
      level: string;
      probability: string;
      impact: string;
      mitigation: string;
    }>;
    opportunities: Array<{
      opportunity: string;
      potential_value: string;
      requirements: string[];
    }>;
    compliance_status: Array<{
      regulation: string;
      status: string;
      gaps: string[];
      recommendations: string[];
    }>;
  };
  learning_data: {
    patterns_detected: string[];
    user_preferences_updated: string[];
    model_improvements: string[];
    feedback_opportunities: string[];
  };
  metadata: {
    processing_time: number;
    models_used: string[];
    confidence_score: number;
    human_review_required: boolean;
    review_reasons: string[];
    next_steps: string[];
  };
}

export interface DocumentWorkflow {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    step_id: string;
    name: string;
    type: 'ingestion' | 'analysis' | 'verification' | 'approval' | 'distribution';
    required: boolean;
    ai_enhanced: boolean;
    configuration: Record<string, any>;
    conditions?: Array<{
      field: string;
      operator: string;
      value: any;
      action: string;
    }>;
  }>;
  triggers: Array<{
    event_type: string;
    conditions: Record<string, any>;
    auto_start: boolean;
  }>;
  integration_points: Array<{
    system: string;
    action: string;
    data_mapping: Record<string, string>;
  }>;
  compliance_requirements: string[];
  created_at: string;
  updated_at: string;
}

export class IntelligentDocumentSystem {
  private logger: Logger;
  private dbService: DatabaseService;
  private vectorService: VectorEmbeddingService;
  private knowledgeBase: KnowledgeBaseService;
  private multiModalProcessor: MultiModalAIProcessor;
  private documentAI: DocumentAIService;
  private learningEngine: LearningEngine;
  private processingQueue: Map<string, IntelligentDocumentRequest> = new Map();
  private activeWorkflows: Map<string, DocumentWorkflow> = new Map();

  constructor(env: any) {
    this.logger = new Logger(env, 'IntelligentDocumentSystem');
    this.dbService = new DatabaseService(env);
    this.vectorService = new VectorEmbeddingService(env);
    this.knowledgeBase = new KnowledgeBaseService(env);
    this.multiModalProcessor = new MultiModalAIProcessor(env);
    this.documentAI = new DocumentAIService(env);
    this.learningEngine = new LearningEngine(env);
  }

  /**
   * Initialize Intelligent Document System
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing Intelligent Document System...');

    try {
      // Initialize all subsystems
      await Promise.all([
        this.vectorService.initialize(),
        this.knowledgeBase.initialize(),
        this.multiModalProcessor.initialize(),
        this.documentAI.initialize(),
        this.learningEngine.initialize()
      ]);

      // Create document system tables
      await this.createDocumentSystemTables();

      // Load workflows
      await this.loadWorkflows();

      // Start processing engine
      this.startProcessingEngine();

      this.logger.info('Intelligent Document System initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Intelligent Document System', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create document system database tables
   */
  private async createDocumentSystemTables(): Promise<void> {
    const tables = [
      // Intelligent document requests
      `CREATE TABLE IF NOT EXISTS intelligent_document_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        session_id TEXT,
        request_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        results TEXT,
        processing_time INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      )`,

      // Document relationships
      `CREATE TABLE IF NOT EXISTS document_relationships (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        source_document_id TEXT NOT NULL,
        target_document_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence REAL DEFAULT 0,
        details TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES intelligent_document_requests(id)
      )`,

      // Cross-document insights
      `CREATE TABLE IF NOT EXISTS cross_document_insights (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        insight_type TEXT NOT NULL,
        insight_data TEXT NOT NULL,
        confidence REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES intelligent_document_requests(id)
      )`,

      // Document workflows
      `CREATE TABLE IF NOT EXISTS document_workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        workflow_data TEXT NOT NULL,
        triggers TEXT,
        integration_points TEXT,
        compliance_requirements TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // Workflow executions
      `CREATE TABLE IF NOT EXISTS workflow_executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        current_step INTEGER DEFAULT 0,
        step_results TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (workflow_id) REFERENCES document_workflows(id),
        FOREIGN KEY (request_id) REFERENCES intelligent_document_requests(id)
      )`,

      // Business intelligence cache
      `CREATE TABLE IF NOT EXISTS business_intelligence_cache (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        intelligence_type TEXT NOT NULL,
        intelligence_data TEXT NOT NULL,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES intelligent_document_requests(id)
      )`
    ];

    for (const tableSql of tables) {
      await this.dbService.query(tableSql);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_requests_user_status ON intelligent_document_requests(user_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_relationships_request ON document_relationships(request_id)',
      'CREATE INDEX IF NOT EXISTS idx_insights_request ON cross_document_insights(request_id)',
      'CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status)'
    ];

    for (const indexSql of indexes) {
      await this.dbService.query(indexSql);
    }
  }

  /**
   * Load workflows
   */
  private async loadWorkflows(): Promise<void> {
    try {
      const workflowsResult = await this.dbService.query(
        'SELECT * FROM document_workflows WHERE active = TRUE'
      );

      for (const row of workflowsResult.results) {
        const workflow: DocumentWorkflow = {
          id: row.id,
          name: row.name,
          description: row.description,
          steps: JSON.parse(row.workflow_data).steps,
          triggers: JSON.parse(row.triggers || '[]'),
          integration_points: JSON.parse(row.integration_points || '[]'),
          compliance_requirements: JSON.parse(row.compliance_requirements || '[]'),
          created_at: row.created_at,
          updated_at: row.updated_at
        };

        this.activeWorkflows.set(workflow.id, workflow);
      }

      this.logger.info('Workflows loaded', { count: this.activeWorkflows.size });
    } catch (error) {
      this.logger.warn('Failed to load workflows', { error: error.message });
    }
  }

  /**
   * Start processing engine
   */
  private startProcessingEngine(): void {
    // Process queue every 30 seconds
    setInterval(() => {
      this.processQueue();
    }, 30 * 1000);

    // Monitor workflow executions every minute
    setInterval(() => {
      this.monitorWorkflowExecutions();
    }, 60 * 1000);

    // Cleanup expired cache every hour
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 60 * 60 * 1000);

    this.logger.info('Processing engine started');
  }

  /**
   * Submit intelligent document processing request
   */
  public async submitRequest(request: IntelligentDocumentRequest): Promise<string> {
    this.logger.info('Submitting intelligent document request', {
      requestId: request.id,
      userId: request.user_id,
      documentCount: request.documents.length
    });

    try {
      // Store request
      await this.dbService.query(`
        INSERT INTO intelligent_document_requests (
          id, user_id, organization_id, session_id, request_data,
          status, progress, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        request.id,
        request.user_id,
        request.organization_id,
        request.session_id,
        JSON.stringify(request),
        'pending',
        0,
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      // Add to processing queue
      this.processingQueue.set(request.id, request);

      // Record learning event
      await this.learningEngine.recordEvent({
        id: crypto.randomUUID(),
        event_type: 'behavior',
        user_id: request.user_id,
        organization_id: request.organization_id,
        session_id: request.session_id,
        timestamp: new Date().toISOString(),
        context: {
          product_area: request.business_context.product_area,
          ai_model: 'intelligent-document-system',
          task_type: 'document_processing',
          input_data_hash: await this.calculateDataHash(request),
          processing_time: 0,
          environment: 'production',
          metadata: {
            document_count: request.documents.length,
            analysis_level: request.processing_options.analysis_level,
            priority: request.business_context.priority
          }
        },
        data: {
          request_type: 'intelligent_document_processing',
          options: request.processing_options,
          business_context: request.business_context
        },
        confidence: 0.9,
        impact_score: request.business_context.priority === 'critical' ? 1.0 : 0.7
      });

      // Start async processing
      this.processRequestAsync(request);

      return request.id;
    } catch (error) {
      this.logger.error('Failed to submit intelligent document request', {
        requestId: request.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process request asynchronously
   */
  private async processRequestAsync(request: IntelligentDocumentRequest): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status
      await this.updateRequestStatus(request.id, 'processing', 0);

      // Initialize result structure
      const result: IntelligentDocumentResult = {
        request_id: request.id,
        status: 'processing',
        progress: 0,
        documents: [],
        cross_document_insights: {
          relationships: [],
          themes: [],
          anomalies: [],
          recommendations: []
        },
        business_intelligence: {
          summary: '',
          key_findings: [],
          risk_assessment: [],
          opportunities: [],
          compliance_status: []
        },
        learning_data: {
          patterns_detected: [],
          user_preferences_updated: [],
          model_improvements: [],
          feedback_opportunities: []
        },
        metadata: {
          processing_time: 0,
          models_used: [],
          confidence_score: 0,
          human_review_required: false,
          review_reasons: [],
          next_steps: []
        }
      };

      // Step 1: Document Ingestion and Processing (0-30%)
      await this.updateRequestStatus(request.id, 'processing', 10);
      const processedDocuments = await this.processDocuments(request);
      result.documents = processedDocuments;
      await this.updateRequestStatus(request.id, 'processing', 30);

      // Step 2: RAG Integration (30-50%)
      if (request.processing_options.enable_rag) {
        await this.updateRequestStatus(request.id, 'processing', 35);
        await this.enrichWithRAG(result, request);
        await this.updateRequestStatus(request.id, 'processing', 50);
      }

      // Step 3: Cross-Document Analysis (50-70%)
      await this.updateRequestStatus(request.id, 'processing', 55);
      await this.performCrossDocumentAnalysis(result, request);
      await this.updateRequestStatus(request.id, 'processing', 70);

      // Step 4: Business Intelligence Generation (70-85%)
      await this.updateRequestStatus(request.id, 'processing', 75);
      await this.generateBusinessIntelligence(result, request);
      await this.updateRequestStatus(request.id, 'processing', 85);

      // Step 5: Learning Integration (85-95%)
      if (request.processing_options.enable_learning) {
        await this.updateRequestStatus(request.id, 'processing', 90);
        await this.integrateLearningData(result, request);
        await this.updateRequestStatus(request.id, 'processing', 95);
      }

      // Step 6: Final Processing and Completion (95-100%)
      await this.updateRequestStatus(request.id, 'processing', 98);
      await this.finalizeProcessing(result, request, startTime);
      await this.updateRequestStatus(request.id, 'processing', 100);

      // Complete request
      await this.completeRequest(request.id, result);

      // Trigger workflows if applicable
      await this.triggerWorkflows(request, result);

      this.logger.info('Intelligent document processing completed', {
        requestId: request.id,
        processingTime: Date.now() - startTime,
        documentCount: processedDocuments.length
      });

    } catch (error) {
      await this.failRequest(request.id, error.message);
      this.logger.error('Intelligent document processing failed', {
        requestId: request.id,
        error: error.message
      });
    } finally {
      // Remove from queue
      this.processingQueue.delete(request.id);
    }
  }

  /**
   * Process individual documents
   */
  private async processDocuments(
    request: IntelligentDocumentRequest
  ): Promise<IntelligentDocumentResult['documents']> {
    const documents = [];

    for (let i = 0; i < request.documents.length; i++) {
      const docRequest = request.documents[i];
      const progress = 10 + Math.floor((i / request.documents.length) * 20); // 10-30%

      try {
        let documentId: string;

        if (request.processing_options.enable_multimodal) {
          // Use multi-modal processing
          const processingRequest: ProcessingRequest = {
            id: crypto.randomUUID(),
            type: this.inferDocumentType(docRequest),
            content: docRequest.content,
            file_url: docRequest.file_url,
            metadata: docRequest.metadata || {},
            options: this.getProcessingOptions(request.processing_options),
            user_id: request.user_id,
            organization_id: request.organization_id
          };

          const processingResultId = await this.multiModalProcessor.submitProcessingRequest(processingRequest);

          // Wait for processing
          const processingResult = await this.waitForProcessing(processingResultId);

          if (processingResult.status === 'completed' && processingResult.results) {
            // Create document from multi-modal results
            documentId = await this.createDocumentFromMultiModal(
              docRequest,
              processingResult.results,
              request
            );
          } else {
            throw new Error(`Multi-modal processing failed: ${processingResult.errors?.join(', ')}`);
          }
        } else {
          // Use document AI directly
          documentId = await this.documentAI.processDocument(
            docRequest.content || '',
            this.createDocumentMetadata(docRequest),
            {
              userId: request.user_id,
              organizationId: request.organization_id,
              priority: request.business_context.priority === 'critical' ? 1 : 5
            }
          );
        }

        // Get document analysis
        const analysis = await this.documentAI.getDocumentAnalysis(documentId);

        // Get personalization data
        const personalization = await this.getDocumentPersonalization(documentId, request);

        documents.push({
          document_id: documentId,
          analysis: analysis || {
            document_id: documentId,
            classification: {
              type: 'other',
              category: 'administrative',
              confidence: 0.5,
              reasoning: 'Default classification'
            },
            extracted_data: {},
            quality_assessment: {
              overall_score: 0.5,
              readability_score: 0.5,
              completeness_score: 0.5,
              accuracy_score: 0.5,
              issues: []
            },
            compliance_assessment: {
              overall_risk_score: 0.5,
              compliance_score: 0.5,
              regulatory_flags: [],
              required_actions: []
            },
            business_insights: {
              summary: '',
              key_points: [],
              risks: [],
              opportunities: [],
              recommendations: []
            },
            processing_metadata: {
              processing_time: 0,
              models_used: [],
              confidence_scores: {},
              manual_review_required: false
            }
          },
          rag_insights: {}, // Will be filled in RAG step
          knowledge_integration: {}, // Will be filled in RAG step
          personalization
        });

        // Update progress
        await this.updateRequestStatus(request.id, 'processing', progress);

      } catch (error) {
        this.logger.warn('Document processing failed', {
          documentIndex: i,
          error: error.message
        });
        // Continue with other documents
      }
    }

    return documents;
  }

  /**
   * Enrich with RAG insights
   */
  private async enrichWithRAG(
    result: IntelligentDocumentResult,
    request: IntelligentDocumentRequest
  ): Promise<void> {
    try {
      for (const doc of result.documents) {
        // Get document content for RAG
        const document = await this.getDocument(doc.document_id);
        if (!document) continue;

        // Search knowledge base for relevant information
        const ragQuery = {
          query: this.generateDocumentQuery(document),
          filters: {
            categories: [document.category],
            compliance_levels: [request.processing_options.compliance_level]
          },
          include_regulations: true,
          include_compliance_assessments: true,
          limit: 10
        };

        const ragResponse = await this.knowledgeBase.searchKnowledgeBase(ragQuery);

        // Process RAG insights
        doc.rag_insights = {
          summary: ragResponse.summary,
          related_documents: ragResponse.sources.slice(0, 3),
          regulatory_context: ragResponse.sources.filter(s =>
            s.title.toLowerCase().includes('regulation') ||
            s.title.toLowerCase().includes('compliance')
          ),
          knowledge_gaps: this.identifyKnowledgeGaps(document, ragResponse),
          recommendations: ragResponse.recommendations
        };

        // Integrate with knowledge base
        doc.knowledge_integration = {
          added_to_kb: false,
          relationships_created: [],
          learning_opportunities: []
        };

        // Add document to knowledge base if valuable
        if (doc.analysis.processing_metadata.confidence_scores?.classification > 0.8) {
          await this.knowledgeBase.addDocument(document.content, {
            id: document.id,
            title: document.title,
            type: 'text',
            source: 'intelligent-document-system',
            category: document.category,
            compliance_level: request.processing_options.compliance_level,
            tags: document.metadata.tags
          });

          doc.knowledge_integration.added_to_kb = true;
        }
      }
    } catch (error) {
      this.logger.warn('RAG enrichment failed', { error: error.message });
    }
  }

  /**
   * Perform cross-document analysis
   */
  private async performCrossDocumentAnalysis(
    result: IntelligentDocumentResult,
    request: IntelligentDocumentRequest
  ): Promise<void> {
    try {
      if (result.documents.length < 2) return;

      // Find relationships between documents
      result.cross_document_insights.relationships = await this.findDocumentRelationships(result.documents);

      // Identify common themes
      result.cross_document_insights.themes = await this.identifyCommonThemes(result.documents);

      // Detect anomalies
      result.cross_document_insights.anomalies = await this.detectAnomalies(result.documents);

      // Generate recommendations
      result.cross_document_insights.recommendations = await this.generateCrossDocumentRecommendations(
        result.documents,
        request.business_context
      );

    } catch (error) {
      this.logger.warn('Cross-document analysis failed', { error: error.message });
    }
  }

  /**
   * Generate business intelligence
   */
  private async generateBusinessIntelligence(
    result: IntelligentDocumentResult,
    request: IntelligentDocumentRequest
  ): Promise<void> {
    try {
      const allAnalyses = result.documents.map(d => d.analysis);

      // Generate summary using AI
      result.business_intelligence.summary = await this.generateIntelligenceSummary(
        allAnalyses,
        request.business_context
      );

      // Extract key findings
      result.business_intelligence.key_findings = await this.extractKeyFindings(allAnalyses);

      // Assess risks
      result.business_intelligence.risk_assessment = await this.assessRisks(allAnalyses, request);

      // Identify opportunities
      result.business_intelligence.opportunities = await this.identifyOpportunities(allAnalyses, request);

      // Check compliance status
      result.business_intelligence.compliance_status = await this.assessComplianceStatus(
        allAnalyses,
        request.business_context.regulatory_requirements || []
      );

    } catch (error) {
      this.logger.warn('Business intelligence generation failed', { error: error.message });
    }
  }

  /**
   * Integrate learning data
   */
  private async integrateLearningData(
    result: IntelligentDocumentResult,
    request: IntelligentDocumentRequest
  ): Promise<void> {
    try {
      // Detect learning patterns
      result.learning_data.patterns_detected = await this.detectLearningPatterns(result, request);

      // Update user preferences
      result.learning_data.user_preferences_updated = await this.updateUserLearningPreferences(
        result,
        request
      );

      // Identify model improvement opportunities
      result.learning_data.model_improvements = await this.identifyModelImprovements(result);

      // Generate feedback opportunities
      result.learning_data.feedback_opportunities = await this.generateFeedbackOpportunities(result);

    } catch (error) {
      this.logger.warn('Learning integration failed', { error: error.message });
    }
  }

  /**
   * Finalize processing
   */
  private async finalizeProcessing(
    result: IntelligentDocumentResult,
    request: IntelligentDocumentRequest,
    startTime: number
  ): Promise<void> {
    result.status = 'completed';
    result.progress = 100;
    result.metadata.processing_time = Date.now() - startTime;
    result.metadata.models_used = [
      'multi-modal-ai',
      'document-ai',
      'rag-system',
      'learning-engine',
      'knowledge-base'
    ];
    result.metadata.confidence_score = this.calculateOverallConfidence(result);
    result.metadata.human_review_required = this.requiresHumanReview(result);
    result.metadata.review_reasons = this.getReviewReasons(result);
    result.metadata.next_steps = this.generateNextSteps(result, request);
  }

  /**
   * Find document relationships
   */
  private async findDocumentRelationships(
    documents: IntelligentDocumentResult['documents']
  ): Promise<IntelligentDocumentResult['cross_document_insights']['relationships']> {
    const relationships = [];

    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        const doc1 = documents[i];
        const doc2 = documents[j];

        // Check for various relationship types
        const relationshipChecks = [
          await this.checkFinancialRelationship(doc1, doc2),
          await this.checkTemporalRelationship(doc1, doc2),
          await this.checkEntityRelationship(doc1, doc2),
          await this.checkContentSimilarity(doc1, doc2)
        ];

        for (const check of relationshipChecks) {
          if (check.confidence > 0.6) {
            relationships.push({
              source_doc: doc1.document_id,
              target_doc: doc2.document_id,
              relationship_type: check.type,
              confidence: check.confidence,
              details: check.details
            });
          }
        }
      }
    }

    return relationships.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Identify common themes
   */
  private async identifyCommonThemes(
    documents: IntelligentDocumentResult['documents']
  ): Promise<IntelligentDocumentResult['cross_document_insights']['themes']> {
    const themes = [];

    // Extract key terms from all documents
    const allTerms = new Map<string, { count: number; docs: string[] }>();

    for (const doc of documents) {
      const entities = doc.analysis.extracted_data.entities || [];
      for (const entity of entities) {
        if (!allTerms.has(entity.text)) {
          allTerms.set(entity.text, { count: 0, docs: [] });
        }
        const termData = allTerms.get(entity.text)!;
        termData.count++;
        termData.docs.push(doc.document_id);
      }
    }

    // Find terms that appear in multiple documents
    for (const [term, data] of allTerms) {
      if (data.docs.length >= 2 && data.count >= 3) {
        const relevanceScore = (data.docs.length / documents.length) * (data.count / 10);

        if (relevanceScore > 0.3) {
          themes.push({
            theme: term,
            relevance_score: Math.min(relevanceScore, 1.0),
            documents: data.docs,
            insights: await this.generateThemeInsights(term, data.docs)
          });
        }
      }
    }

    return themes.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 10);
  }

  /**
   * Detect anomalies
   */
  private async detectAnomalies(
    documents: IntelligentDocumentResult['documents']
  ): Promise<IntelligentDocumentResult['cross_document_insights']['anomalies']> {
    const anomalies = [];

    // Check for classification anomalies
    const classifications = documents.map(d => d.analysis.classification.type);
    const uniqueTypes = new Set(classifications);
    if (uniqueTypes.size > classifications.length * 0.7) {
      anomalies.push({
        type: 'classification_diversity',
        severity: 'MEDIUM',
        description: 'High diversity in document types may indicate mixed submission',
        affected_documents: documents.map(d => d.document_id)
      });
    }

    // Check for quality anomalies
    const qualityScores = documents.map(d => d.analysis.quality_assessment.overall_score);
    const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    const lowQualityDocs = documents.filter(d => d.analysis.quality_assessment.overall_score < avgQuality - 0.2);

    if (lowQualityDocs.length > 0) {
      anomalies.push({
        type: 'quality_variance',
        severity: 'HIGH',
        description: 'Significant quality variance detected in document processing',
        affected_documents: lowQualityDocs.map(d => d.document_id)
      });
    }

    // Check for compliance anomalies
    const complianceScores = documents.map(d => d.analysis.compliance_assessment.compliance_score);
    const complianceIssues = documents.filter(d => d.analysis.compliance_assessment.compliance_score < 0.7);

    if (complianceIssues.length > 0) {
      anomalies.push({
        type: 'compliance_issues',
        severity: 'HIGH',
        description: 'Compliance issues detected in multiple documents',
        affected_documents: complianceIssues.map(d => d.document_id)
      });
    }

    return anomalies;
  }

  /**
   * Generate cross-document recommendations
   */
  private async generateCrossDocumentRecommendations(
    documents: IntelligentDocumentResult['documents'],
    businessContext: IntelligentDocumentRequest['business_context']
  ): Promise<IntelligentDocumentResult['cross_document_insights']['recommendations']> {
    const recommendations = [];

    // Analysis based recommendations
    const highRiskDocs = documents.filter(d =>
      d.analysis.compliance_assessment.overall_risk_score > 0.7
    );

    if (highRiskDocs.length > 0) {
      recommendations.push({
        category: 'risk_management',
        priority: 'HIGH',
        recommendation: 'Immediate review required for high-risk documents',
        rationale: `${highRiskDocs.length} documents identified as high risk`,
        action_items: [
          'Manually review high-risk documents',
          'Update compliance checking procedures',
          'Consider additional verification steps'
        ]
      });
    }

    // Quality-based recommendations
    const lowQualityDocs = documents.filter(d =>
      d.analysis.quality_assessment.overall_score < 0.6
    );

    if (lowQualityDocs.length > 0) {
      recommendations.push({
        category: 'quality_improvement',
        priority: 'MEDIUM',
        recommendation: 'Improve document quality through preprocessing',
        rationale: `${lowQualityDocs.length} documents have quality issues`,
        action_items: [
          'Enhance OCR quality for scanned documents',
          'Improve image preprocessing',
          'Add validation checks'
        ]
      });
    }

    // Business context specific recommendations
    if (businessContext.product_area === 'compliance') {
      recommendations.push({
        category: 'compliance_optimization',
        priority: 'HIGH',
        recommendation: 'Enhance compliance checking for regulatory requirements',
        rationale: 'Compliance-focused processing requires enhanced regulatory checking',
        action_items: [
          'Update regulatory rule sets',
          'Implement additional compliance validations',
          'Add compliance reporting'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Generate intelligence summary
   */
  private async generateIntelligenceSummary(
    analyses: DocumentAnalysisResult[],
    businessContext: IntelligentDocumentRequest['business_context']
  ): Promise<string> {
    try {
      const analysisSummary = analyses.map(a => ({
        type: a.classification.type,
        category: a.classification.category,
        confidence: a.classification.confidence,
        key_points: a.business_insights.key_points.slice(0, 3),
        risks: a.business_insights.risks.slice(0, 2)
      }));

      const prompt = `
Generate a comprehensive business summary for document analysis results:

Business Context:
- Product Area: ${businessContext.product_area}
- Use Case: ${businessContext.use_case}
- Priority: ${businessContext.priority}

Document Analyses:
${JSON.stringify(analysisSummary, null, 2)}

Provide a concise executive summary that includes:
1. Overall findings
2. Key business insights
3. Risk assessment
4. Recommended actions

Summary:
`;

      const response = await this.dbService.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 400,
        temperature: 0.3
      });

      return response.response.trim();
    } catch (error) {
      this.logger.warn('Intelligence summary generation failed', { error: error.message });
      return 'Unable to generate intelligence summary';
    }
  }

  /**
   * Extract key findings
   */
  private async extractKeyFindings(analyses: DocumentAnalysisResult[]): Promise<string[]> {
    const findings = [];

    for (const analysis of analyses) {
      // High confidence findings
      if (analysis.classification.confidence > 0.8) {
        findings.push(`Document classified as ${analysis.classification.type} with high confidence`);
      }

      // Risk findings
      const highRisks = analysis.business_insights.risks.filter(r => r.level === 'HIGH');
      if (highRisks.length > 0) {
        findings.push(`High-risk items identified: ${highRisks.map(r => r.type).join(', ')}`);
      }

      // Opportunity findings
      if (analysis.business_insights.opportunities.length > 0) {
        findings.push(`Business opportunities: ${analysis.business_insights.opportunities[0]}`);
      }

      // Quality findings
      if (analysis.quality_assessment.overall_score < 0.6) {
        findings.push('Quality issues detected requiring attention');
      }
    }

    return [...new Set(findings)]; // Remove duplicates
  }

  /**
   * Assess risks
   */
  private async assessRisks(
    analyses: DocumentAnalysisResult[],
    request: IntelligentDocumentRequest
  ): Promise<IntelligentDocumentResult['business_intelligence']['risk_assessment']> {
    const riskAssessment = [];
    const allRisks = analyses.flatMap(a => a.business_insights.risks);

    // Group risks by type
    const riskGroups = new Map<string, typeof allRisks>();
    for (const risk of allRisks) {
      if (!riskGroups.has(risk.type)) {
        riskGroups.set(risk.type, []);
      }
      riskGroups.get(risk.type)!.push(risk);
    }

    // Assess each risk group
    for (const [riskType, risks] of riskGroups) {
      const highRiskCount = risks.filter(r => r.level === 'HIGH').length;
      const mediumRiskCount = risks.filter(r => r.level === 'MEDIUM').length;

      let overallLevel = 'LOW';
      if (highRiskCount > 0) overallLevel = 'HIGH';
      else if (mediumRiskCount > 0) overallLevel = 'MEDIUM';

      const probability = highRiskCount > 0 ? 'HIGH' : mediumRiskCount > 2 ? 'MEDIUM' : 'LOW';
      const impact = overallLevel;

      riskAssessment.push({
        risk: riskType,
        level: overallLevel,
        probability,
        impact,
        mitigation: this.generateRiskMitigation(risks, request.business_context)
      });
    }

    return riskAssessment.sort((a, b) => {
      const levelOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return levelOrder[b.level] - levelOrder[a.level];
    });
  }

  /**
   * Identify opportunities
   */
  private async identifyOpportunities(
    analyses: DocumentAnalysisResult[],
    request: IntelligentDocumentRequest
  ): Promise<IntelligentDocumentResult['business_intelligence']['opportunities']> {
    const opportunities = [];
    const allOpportunities = analyses.flatMap(a => a.business_insights.opportunities);

    // Group and prioritize opportunities
    const opportunityMap = new Map<string, { count: number; examples: string[] }>();
    for (const opp of allOpportunities) {
      const key = opp.substring(0, 50); // Group by first 50 chars
      if (!opportunityMap.has(key)) {
        opportunityMap.set(key, { count: 0, examples: [] });
      }
      const data = opportunityMap.get(key)!;
      data.count++;
      if (data.examples.length < 3) {
        data.examples.push(opp);
      }
    }

    // Convert to opportunities with value estimation
    for (const [key, data] of opportunityMap) {
      if (data.count >= 2) { // Only include opportunities mentioned multiple times
        const potentialValue = this.estimateOpportunityValue(data.count, request.business_context);
        const requirements = this.identifyOpportunityRequirements(data.examples, request);

        opportunities.push({
          opportunity: data.examples[0],
          potential_value: potentialValue,
          requirements
        });
      }
    }

    return opportunities.sort((a, b) => {
      const valueOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return valueOrder[b.potential_value] - valueOrder[a.potential_value];
    });
  }

  /**
   * Assess compliance status
   */
  private async assessComplianceStatus(
    analyses: DocumentAnalysisResult[],
    regulatoryRequirements: string[]
  ): Promise<IntelligentDocumentResult['business_intelligence']['compliance_status']> {
    const complianceStatus = [];

    // Get all regulatory flags
    const allFlags = analyses.flatMap(a => a.compliance_assessment.regulatory_flags);

    // Group by regulation
    const flagsByRegulation = new Map<string, typeof allFlags>();
    for (const flag of allFlags) {
      if (!flagsByRegulation.has(flag.regulation)) {
        flagsByRegulation.set(flag.regulation, []);
      }
      flagsByRegulation.get(flag.regulation)!.push(flag);
    }

    // Assess each regulation
    for (const [regulation, flags] of flagsByRegulation) {
      const highSeverityFlags = flags.filter(f => f.severity === 'HIGH');
      const mediumSeverityFlags = flags.filter(f => f.severity === 'MEDIUM');

      let status = 'COMPLIANT';
      if (highSeverityFlags.length > 0) status = 'NON_COMPLIANT';
      else if (mediumSeverityFlags.length > 0) status = 'REQUIRES_REVIEW';

      const gaps = flags.map(f => f.description);
      const recommendations = flags.map(f => f.recommendation || `Address ${flag_type}`);

      complianceStatus.push({
        regulation,
        status,
        gaps,
        recommendations: [...new Set(recommendations)]
      });
    }

    // Check for missing regulatory requirements
    for (const requirement of regulatoryRequirements) {
      if (!flagsByRegulation.has(requirement)) {
        complianceStatus.push({
          regulation: requirement,
          status: 'REQUIRES_REVIEW',
          gaps: ['No compliance data available'],
          recommendations: ['Conduct compliance review for this regulation']
        });
      }
    }

    return complianceStatus;
  }

  // Helper methods
  private inferDocumentType(docRequest: any): string {
    if (docRequest.type) return docRequest.type;
    if (docRequest.file_url) {
      const extension = docRequest.file_url.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(extension || '')) return 'image';
      if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension || '')) return 'audio';
      if (['mp4', 'avi', 'mov', 'mkv'].includes(extension || '')) return 'video';
    }
    return 'document';
  }

  private getProcessingOptions(options: IntelligentDocumentRequest['processing_options']) {
    return {
      extract_text: true,
      extract_entities: true,
      analyze_sentiment: true,
      extract_tables: true,
      language_detection: true,
      quality_check: true,
      compliance_check: options.compliance_level !== 'standard',
      pii_detection: true
    };
  }

  private createDocumentMetadata(docRequest: any): any {
    return {
      file_info: {
        name: docRequest.metadata?.name || 'Uploaded Document',
        size: docRequest.metadata?.size || 0,
        mime_type: docRequest.metadata?.mime_type || 'application/pdf',
        checksum: docRequest.metadata?.checksum || ''
      },
      source: 'user_upload',
      author: docRequest.metadata?.author,
      language: docRequest.metadata?.language || 'en',
      tags: docRequest.metadata?.tags || [],
      sensitivity: docRequest.metadata?.sensitivity || 'internal',
      compliance_requirements: docRequest.metadata?.compliance_requirements || [],
      custom_fields: docRequest.metadata?.custom_fields || {}
    };
  }

  private async waitForProcessing(processingResultId: string, maxWaitTime = 120000): Promise<any> {
    const startTime = Date.now();
    const checkInterval = 3000;

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.multiModalProcessor.getRequestStatus(processingResultId);

      if (result && (result.status === 'completed' || result.status === 'failed')) {
        return result;
      }

      await this.delay(checkInterval);
    }

    throw new Error('Processing timeout');
  }

  private async createDocumentFromMultiModal(
    docRequest: any,
    processingResults: any,
    request: IntelligentDocumentRequest
  ): Promise<string> {
    // Create document from multi-modal processing results
    const content = processingResults.text?.content || processingResults.audio?.transcription || '';

    return await this.documentAI.processDocument(content, {
      ...this.createDocumentMetadata(docRequest),
      source: 'multi_modal_processing',
      language: processingResults.text?.language || 'en'
    }, {
      userId: request.user_id,
      organizationId: request.organization_id,
      priority: request.business_context.priority === 'critical' ? 1 : 5
    });
  }

  private async getDocumentPersonalization(documentId: string, request: IntelligentDocumentRequest): Promise<any> {
    // Get user's personalization profile
    const userProfile = await this.learningEngine.getUserProfile?.(request.user_id);

    if (!userProfile) {
      return {
        response_style: 'business',
        risk_tolerance: 'medium',
        compliance_level: request.processing_options.compliance_level,
        insights_priority: ['risk', 'opportunity', 'compliance']
      };
    }

    return {
      response_style: userProfile.preferences.response_style,
      risk_tolerance: userProfile.preferences.risk_tolerance,
      compliance_level: userProfile.preferences.compliance_level,
      insights_priority: this.determineInsightsPriority(userProfile.behavior_patterns, request.business_context)
    };
  }

  private determineInsightsPriority(behaviorPatterns: any, businessContext: any): string[] {
    // Determine insights priority based on user behavior and business context
    const priorities = ['risk', 'opportunity', 'compliance'];

    if (businessContext.product_area === 'compliance') {
      return ['compliance', 'risk', 'opportunity'];
    }

    if (businessContext.product_area === 'risk') {
      return ['risk', 'compliance', 'opportunity'];
    }

    return priorities;
  }

  private generateDocumentQuery(document: any): string {
    // Generate search query for RAG based on document content
    const entities = document.analysis?.extracted_data?.entities || [];
    const keyEntities = entities.slice(0, 5).map((e: any) => e.text).join(' ');
    const classification = document.analysis?.classification?.type || '';

    return `${classification} ${keyEntities} ${document.title || ''}`.trim();
  }

  private identifyKnowledgeGaps(document: any, ragResponse: any): string[] {
    const gaps = [];

    if (ragResponse.total_found < 3) {
      gaps.push('Limited related knowledge found in system');
    }

    if (ragResponse.sources.length === 0) {
      gaps.push('No relevant sources found for cross-reference');
    }

    if (ragResponse.regulations.length === 0 && document.category === 'compliance') {
      gaps.push('No regulatory references found for compliance document');
    }

    return gaps;
  }

  private async checkFinancialRelationship(doc1: any, doc2: any): Promise<any> {
    // Check for financial relationships between documents
    const doc1Financials = doc1.analysis.extracted_data.financials;
    const doc2Financials = doc2.analysis.extracted_data.financials;

    if (!doc1Financials || !doc2Financials) {
      return { type: 'financial', confidence: 0, details: {} };
    }

    let confidence = 0;
    const details: any = {};

    // Check for same currency
    if (doc1Financials.currency === doc2Financials.currency) {
      confidence += 0.3;
      details.same_currency = true;
    }

    // Check for related parties
    if (doc1Financials.parties?.vendor && doc2Financials.parties?.vendor) {
      if (doc1Financials.parties.vendor === doc2Financials.parties.vendor) {
        confidence += 0.5;
        details.same_vendor = true;
      }
    }

    // Check for date proximity
    if (doc1Financials.dates?.invoice_date && doc2Financials.dates?.invoice_date) {
      const date1 = new Date(doc1Financials.dates.invoice_date);
      const date2 = new Date(doc2Financials.dates.invoice_date);
      const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 30) {
        confidence += 0.2;
        details.date_proximity = daysDiff;
      }
    }

    return { type: 'financial', confidence, details };
  }

  private async checkTemporalRelationship(doc1: any, doc2: any): Promise<any> {
    // Check for temporal relationships
    const doc1Date = doc1.analysis.extracted_data.contract?.effective_date ||
                     doc1.analysis.extracted_data.financials?.dates?.invoice_date;
    const doc2Date = doc2.analysis.extracted_data.contract?.effective_date ||
                     doc2.analysis.extracted_data.financials?.dates?.invoice_date;

    if (!doc1Date || !doc2Date) {
      return { type: 'temporal', confidence: 0, details: {} };
    }

    const date1 = new Date(doc1Date);
    const date2 = new Date(doc2Date);
    const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);

    let confidence = 0;
    let relationshipType = '';

    if (daysDiff <= 7) {
      confidence = 0.8;
      relationshipType = 'contemporaneous';
    } else if (daysDiff <= 30) {
      confidence = 0.6;
      relationshipType = 'same_period';
    } else if (daysDiff <= 365) {
      confidence = 0.4;
      relationshipType = 'related_period';
    }

    return {
      type: 'temporal',
      confidence,
      details: {
        relationship_type: relationshipType,
        days_difference: daysDiff,
        chronological_order: date1 < date2 ? 'doc1_before_doc2' : 'doc2_before_doc1'
      }
    };
  }

  private async checkEntityRelationship(doc1: any, doc2: any): Promise<any> {
    // Check for entity relationships
    const doc1Entities = doc1.analysis.extracted_data.entities || [];
    const doc2Entities = doc2.analysis.extracted_data.entities || [];

    const doc1EntityTexts = new Set(doc1Entities.map((e: any) => e.text.toLowerCase()));
    const doc2EntityTexts = new Set(doc2Entities.map((e: any) => e.text.toLowerCase()));

    const commonEntities = [...doc1EntityTexts].filter(entity => doc2EntityTexts.has(entity));

    if (commonEntities.length === 0) {
      return { type: 'entity', confidence: 0, details: {} };
    }

    const confidence = Math.min(commonEntities.length / 5, 1.0); // Cap at 1.0

    return {
      type: 'entity',
      confidence,
      details: {
        common_entities: commonEntities,
        entity_count: commonEntities.length,
        entity_types: this.getEntityTypes(commonEntities, doc1Entities, doc2Entities)
      }
    };
  }

  private getEntityTypes(commonEntities: string[], doc1Entities: any[], doc2Entities: any[]): string[] {
    const types = new Set<string>();

    for (const entity of commonEntities) {
      const doc1Entity = doc1Entities.find((e: any) => e.text.toLowerCase() === entity);
      const doc2Entity = doc2Entities.find((e: any) => e.text.toLowerCase() === entity);

      if (doc1Entity) types.add(doc1Entity.type);
      if (doc2Entity) types.add(doc2Entity.type);
    }

    return Array.from(types);
  }

  private async checkContentSimilarity(doc1: any, doc2: any): Promise<any> {
    // Check for content similarity using extracted content
    const doc1Content = (doc1.analysis.extracted_data.entities || [])
      .map((e: any) => e.text)
      .join(' ');
    const doc2Content = (doc2.analysis.extracted_data.entities || [])
      .map((e: any) => e.text)
      .join(' ');

    if (!doc1Content || !doc2Content) {
      return { type: 'content_similarity', confidence: 0, details: {} };
    }

    // Simple similarity calculation (could be enhanced with embeddings)
    const doc1Words = new Set(doc1Content.toLowerCase().split(/\s+/));
    const doc2Words = new Set(doc2Content.toLowerCase().split(/\s+/));

    const intersection = [...doc1Words].filter(word => doc2Words.has(word));
    const union = [...new Set([...doc1Words, ...doc2Words])];

    const similarity = intersection.length / union.length;

    return {
      type: 'content_similarity',
      confidence: similarity,
      details: {
        similarity_score: similarity,
        common_words: intersection.slice(0, 10),
        total_intersection: intersection.length,
        total_union: union.length
      }
    };
  }

  private async generateThemeInsights(theme: string, documentIds: string[]): Promise<string[]> {
    // Generate insights for a specific theme
    return [
      `Theme "${theme}" appears across ${documentIds.length} documents`,
      `Cross-referencing this theme may reveal important patterns`,
      `Consider creating a dedicated workflow for ${theme}-related documents`
    ];
  }

  private calculateOverallConfidence(result: IntelligentDocumentResult): number {
    if (result.documents.length === 0) return 0;

    const confidences = result.documents.map(doc =>
      doc.analysis.processing_metadata.confidence_scores?.classification || 0.5
    );

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  private requiresHumanReview(result: IntelligentDocumentResult): boolean {
    // Check if human review is required
    const avgConfidence = this.calculateOverallConfidence(result);

    if (avgConfidence < 0.7) return true;

    const highRiskAnomalies = result.cross_document_insights.anomalies.filter(
      a => a.severity === 'HIGH'
    );

    if (highRiskAnomalies.length > 0) return true;

    const complianceIssues = result.business_intelligence.compliance_status.filter(
      c => c.status === 'NON_COMPLIANT'
    );

    if (complianceIssues.length > 0) return true;

    return false;
  }

  private getReviewReasons(result: IntelligentDocumentResult): string[] {
    const reasons = [];

    const avgConfidence = this.calculateOverallConfidence(result);
    if (avgConfidence < 0.7) {
      reasons.push('Low confidence in processing results');
    }

    const highRiskAnomalies = result.cross_document_insights.anomalies.filter(
      a => a.severity === 'HIGH'
    );
    if (highRiskAnomalies.length > 0) {
      reasons.push('High-risk anomalies detected');
    }

    const complianceIssues = result.business_intelligence.compliance_status.filter(
      c => c.status === 'NON_COMPLIANT'
    );
    if (complianceIssues.length > 0) {
      reasons.push('Compliance issues identified');
    }

    return reasons;
  }

  private generateNextSteps(result: IntelligentDocumentResult, request: IntelligentDocumentRequest): string[] {
    const steps = [];

    // Based on business context
    if (request.business_context.product_area === 'compliance') {
      steps.push('Review compliance recommendations');
      steps.push('Update compliance documentation');
    }

    // Based on findings
    if (result.cross_document_insights.recommendations.length > 0) {
      steps.push('Address cross-document recommendations');
    }

    // Based on opportunities
    if (result.business_intelligence.opportunities.length > 0) {
      steps.push('Evaluate business opportunities');
    }

    // Based on risks
    if (result.business_intelligence.risk_assessment.length > 0) {
      steps.push('Implement risk mitigation strategies');
    }

    return steps;
  }

  private async detectLearningPatterns(result: IntelligentDocumentResult, request: IntelligentDocumentRequest): Promise<string[]> {
    // Detect learning patterns from the processing results
    const patterns = [];

    // Pattern: Document type distribution
    const typeDistribution = result.documents.reduce((acc, doc) => {
      acc[doc.analysis.classification.type] = (acc[doc.analysis.classification.type] || 0) + 1;
      return acc;
    }, {});

    const dominantType = Object.entries(typeDistribution)
      .sort(([,a], [,b]) => b - a)[0];

    if (dominantType && dominantType[1] > result.documents.length * 0.5) {
      patterns.push(`Predominant document type: ${dominantType[0]}`);
    }

    // Pattern: Quality issues
    const qualityIssues = result.documents.filter(doc =>
      doc.analysis.quality_assessment.overall_score < 0.6
    );

    if (qualityIssues.length > 0) {
      patterns.push(`Quality issues detected in ${qualityIssues.length} documents`);
    }

    return patterns;
  }

  private async updateUserLearningPreferences(result: IntelligentDocumentResult, request: IntelligentDocumentRequest): Promise<string[]> {
    // Update user learning preferences based on processing results
    const updated = [];

    // Learning: Response style preference
    const userResponseStyles = result.documents.map(doc => doc.personalization?.response_style);
    const preferredStyle = userResponseStyles[0]; // Use first as preference

    if (preferredStyle) {
      updated.push(`Response style preference: ${preferredStyle}`);
    }

    // Learning: Risk tolerance
    const riskTolerances = result.documents.map(doc => doc.personalization?.risk_tolerance);
    const preferredRiskTolerance = riskTolerances[0];

    if (preferredRiskTolerance) {
      updated.push(`Risk tolerance preference: ${preferredRiskTolerance}`);
    }

    return updated;
  }

  private async identifyModelImprovements(result: IntelligentDocumentResult): Promise<string[]> {
    // Identify model improvement opportunities
    const improvements = [];

    // Check classification confidence
    const lowConfidenceDocs = result.documents.filter(doc =>
      doc.analysis.processing_metadata.confidence_scores?.classification < 0.7
    );

    if (lowConfidenceDocs.length > 0) {
      improvements.push('Classification model improvement needed');
    }

    // Check extraction quality
    const poorExtractionDocs = result.documents.filter(doc =>
      doc.analysis.quality_assessment.accuracy_score < 0.6
    );

    if (poorExtractionDocs.length > 0) {
      improvements.push('Extraction model enhancement required');
    }

    return improvements;
  }

  private async generateFeedbackOpportunities(result: IntelligentDocumentResult): Promise<string[]> {
    // Generate feedback collection opportunities
    const opportunities = [];

    // Classification feedback
    const variedClassifications = new Set(result.documents.map(doc => doc.analysis.classification.type));
    if (variedClassifications.size > 1) {
      opportunities.push('Collect classification accuracy feedback');
    }

    // Business intelligence feedback
    if (result.business_intelligence.key_findings.length > 0) {
      opportunities.push('Request feedback on business insights relevance');
    }

    // Compliance feedback
    const complianceIssues = result.business_intelligence.compliance_status.filter(c => c.status !== 'COMPLIANT');
    if (complianceIssues.length > 0) {
      opportunities.push('Gather compliance assessment feedback');
    }

    return opportunities;
  }

  private async updateRequestStatus(requestId: string, status: string, progress?: number): Promise<void> {
    const updates = ['status = ?', 'updated_at = ?'];
    const params = [status, new Date().toISOString()];

    if (progress !== undefined) {
      updates.push('progress = ?');
      params.unshift(progress);
    }

    params.push(requestId);

    await this.dbService.query(`
      UPDATE intelligent_document_requests
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);
  }

  private async completeRequest(requestId: string, result: IntelligentDocumentResult): Promise<void> {
    await this.dbService.query(`
      UPDATE intelligent_document_requests
      SET status = 'completed', progress = 100, results = ?,
          processing_time = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `, [
      JSON.stringify(result),
      result.metadata.processing_time,
      new Date().toISOString(),
      new Date().toISOString(),
      requestId
    ]);
  }

  private async failRequest(requestId: string, errorMessage: string): Promise<void> {
    await this.dbService.query(`
      UPDATE intelligent_document_requests
      SET status = 'failed', results = ?, updated_at = ?
      WHERE id = ?
    `, [
      JSON.stringify({ error: errorMessage }),
      new Date().toISOString(),
      requestId
    ]);
  }

  private async triggerWorkflows(request: IntelligentDocumentRequest, result: IntelligentDocumentResult): Promise<void> {
    // Trigger relevant workflows based on request and results
    for (const [workflowId, workflow] of this.activeWorkflows) {
      const shouldTrigger = await this.shouldTriggerWorkflow(workflow, request, result);

      if (shouldTrigger) {
        await this.executeWorkflow(workflowId, request.id);
      }
    }
  }

  private async shouldTriggerWorkflow(workflow: DocumentWorkflow, request: IntelligentDocumentRequest, result: IntelligentDocumentResult): Promise<boolean> {
    // Check if workflow should be triggered based on triggers
    for (const trigger of workflow.triggers) {
      if (trigger.event_type === 'document_processing_completed' && trigger.auto_start) {
        // Check conditions
        if (trigger.conditions.priority && trigger.conditions.priority !== request.business_context.priority) {
          continue;
        }

        if (trigger.conditions.product_area && trigger.conditions.product_area !== request.business_context.product_area) {
          continue;
        }

        if (trigger.conditions.min_documents && result.documents.length < trigger.conditions.min_documents) {
          continue;
        }

        return true;
      }
    }

    return false;
  }

  private async executeWorkflow(workflowId: string, requestId: string): Promise<void> {
    const executionId = crypto.randomUUID();

    await this.dbService.query(`
      INSERT INTO workflow_executions (
        id, workflow_id, request_id, status, current_step, started_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [executionId, workflowId, requestId, 'pending', 0, new Date().toISOString()]);

    this.logger.info('Workflow triggered', { workflowId, requestId, executionId });
  }

  private async processQueue(): Promise<void> {
    // Process any pending items in the queue
    if (this.processingQueue.size === 0) return;

    this.logger.debug('Processing queue', { queueSize: this.processingQueue.size });
  }

  private async monitorWorkflowExecutions(): Promise<void> {
    // Monitor and update workflow executions
    const executionsResult = await this.dbService.query(`
      SELECT * FROM workflow_executions
      WHERE status IN ('pending', 'in_progress')
      AND started_at > datetime('now', '-1 hour')
    `);

    for (const execution of executionsResult.results) {
      // Check execution status and update accordingly
      await this.updateWorkflowExecution(execution.id);
    }
  }

  private async updateWorkflowExecution(executionId: string): Promise<void> {
    // Update workflow execution status
    // Implementation would depend on workflow execution logic
  }

  private async cleanupExpiredCache(): Promise<void> {
    // Clean up expired business intelligence cache
    await this.dbService.query(`
      DELETE FROM business_intelligence_cache
      WHERE expires_at < datetime('now')
    `);
  }

  private async calculateDataHash(request: IntelligentDocumentRequest): Promise<string> {
    const data = JSON.stringify(request);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async getDocument(documentId: string): Promise<any> {
    // Get document from document AI service
    return await this.documentAI.getDocument?.(documentId);
  }

  private generateRiskMitigation(risks: any[], businessContext: any): string {
    // Generate risk mitigation strategy
    const highRiskCount = risks.filter(r => r.level === 'HIGH').length;

    if (highRiskCount > 0) {
      return 'Immediate attention required - implement comprehensive risk mitigation strategy';
    } else if (risks.length > 0) {
      return 'Monitor and implement standard risk mitigation procedures';
    }

    return 'Continue standard monitoring procedures';
  }

  private estimateOpportunityValue(count: number, businessContext: any): string {
    // Estimate potential value of opportunity
    if (count >= 5) return 'HIGH';
    if (count >= 3) return 'MEDIUM';
    return 'LOW';
  }

  private identifyOpportunityRequirements(examples: string[], request: IntelligentDocumentRequest): string[] {
    // Identify requirements to pursue opportunity
    return [
      'Additional analysis recommended',
      'Stakeholder consultation required',
      'Resource allocation assessment needed'
    ];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get request status
   */
  public async getRequestStatus(requestId: string): Promise<IntelligentDocumentResult | null> {
    try {
      const result = await this.dbService.query(
        'SELECT * FROM intelligent_document_requests WHERE id = ?',
        [requestId]
      );

      if (result.results.length === 0) return null;

      const row = result.results[0];
      return {
        request_id: row.id,
        status: row.status,
        progress: row.progress,
        documents: row.results ? JSON.parse(row.results).documents || [] : [],
        cross_document_insights: row.results ? JSON.parse(row.results).cross_document_insights || {
          relationships: [],
          themes: [],
          anomalies: [],
          recommendations: []
        } : {
          relationships: [],
          themes: [],
          anomalies: [],
          recommendations: []
        },
        business_intelligence: row.results ? JSON.parse(row.results).business_intelligence || {
          summary: '',
          key_findings: [],
          risk_assessment: [],
          opportunities: [],
          compliance_status: []
        } : {
          summary: '',
          key_findings: [],
          risk_assessment: [],
          opportunities: [],
          compliance_status: []
        },
        learning_data: row.results ? JSON.parse(row.results).learning_data || {
          patterns_detected: [],
          user_preferences_updated: [],
          model_improvements: [],
          feedback_opportunities: []
        } : {
          patterns_detected: [],
          user_preferences_updated: [],
          model_improvements: [],
          feedback_opportunities: []
        },
        metadata: row.results ? JSON.parse(row.results).metadata || {
          processing_time: 0,
          models_used: [],
          confidence_score: 0,
          human_review_required: false,
          review_reasons: [],
          next_steps: []
        } : {
          processing_time: 0,
          models_used: [],
          confidence_score: 0,
          human_review_required: false,
          review_reasons: [],
          next_steps: []
        }
      };
    } catch (error) {
      this.logger.error('Failed to get request status', {
        requestId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get system statistics
   */
  public async getStatistics(): Promise<{
    total_requests: number;
    completed_requests: number;
    failed_requests: number;
    average_processing_time: number;
    document_types_processed: Record<string, number>;
    business_intelligence_generated: number;
    workflows_triggered: number;
    learning_patterns_discovered: number;
  }> {
    try {
      // Request statistics
      const requestStats = await this.dbService.query(`
        SELECT
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_requests,
          AVG(processing_time) as avg_processing_time
        FROM intelligent_document_requests
        WHERE created_at > datetime('now', '-7 days')
      `);

      // Document type statistics
      const docTypeStats = await this.dbService.query(`
        SELECT JSON_EXTRACT(results, '$.documents[*].analysis.classification.type') as doc_types
        FROM intelligent_document_requests
        WHERE status = 'completed' AND created_at > datetime('now', '-7 days')
      `);

      const documentTypes: Record<string, number> = {};
      for (const row of docTypeStats.results) {
        if (row.doc_types) {
          const types = JSON.parse(row.doc_types);
          for (const type of types) {
            documentTypes[type] = (documentTypes[type] || 0) + 1;
          }
        }
      }

      // Business intelligence statistics
      const biStats = await this.dbService.query(`
        SELECT COUNT(*) as bi_count
        FROM intelligent_document_requests
        WHERE status = 'completed'
        AND JSON_EXTRACT(results, '$.business_intelligence.summary') IS NOT NULL
        AND created_at > datetime('now', '-7 days')
      `);

      // Workflow statistics
      const workflowStats = await this.dbService.query(`
        SELECT COUNT(*) as workflow_count
        FROM workflow_executions
        WHERE started_at > datetime('now', '-7 days')
      `);

      // Learning statistics
      const learningStats = await this.learningEngine.getStatistics?.() || {
        patterns_discovered: 0
      };

      const stats = requestStats.results[0];

      return {
        total_requests: stats.total_requests || 0,
        completed_requests: stats.completed_requests || 0,
        failed_requests: stats.failed_requests || 0,
        average_processing_time: stats.avg_processing_time || 0,
        document_types_processed: documentTypes,
        business_intelligence_generated: biStats.results[0]?.bi_count || 0,
        workflows_triggered: workflowStats.results[0]?.workflow_count || 0,
        learning_patterns_discovered: learningStats.patterns_discovered || 0
      };
    } catch (error) {
      this.logger.error('Failed to get system statistics', { error: error.message });
      throw error;
    }
  }
}