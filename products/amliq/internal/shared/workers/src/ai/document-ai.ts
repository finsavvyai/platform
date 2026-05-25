/**
 * FinSavvy AI Suite - Document AI System
 *
 * Revolutionary document AI system for intelligent document processing,
 * classification, structuring, and financial analysis with AI-powered automation.
 */

import { Logger } from '../utils/logger';
import { DatabaseService } from '../services/database-service';
import { MultiModalAIProcessor, ProcessingRequest, ProcessingOptions } from './multimodal-processor';
import { VectorEmbeddingService } from '../rag/vector-service';

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  category: DocumentCategory;
  content: string;
  metadata: DocumentMetadata;
  extracted_data: ExtractedData;
  confidence: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  user_id: string;
  organization_id: string;
}

export type DocumentType =
  | 'invoice'
  | 'receipt'
  | 'contract'
  | 'financial_statement'
  | 'bank_statement'
  | 'tax_document'
  | 'identity_document'
  | 'compliance_report'
  | 'board_minutes'
  | 'agreement'
  | 'other';

export type DocumentCategory =
  | 'financial'
  | 'legal'
  | 'compliance'
  | 'operational'
  | 'strategic'
  | 'administrative';

export interface DocumentMetadata {
  file_info: {
    name: string;
    size: number;
    mime_type: string;
    checksum: string;
  };
  source: string;
  author?: string;
  recipient?: string;
  date_created?: string;
  date_modified?: string;
  language: string;
  pages?: number;
  tags: string[];
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  retention_period?: number; // days
  compliance_requirements: string[];
  custom_fields: Record<string, any>;
}

export interface ExtractedData {
  // Financial data
  financials?: {
    currency: string;
    total_amount?: number;
    tax_amount?: number;
    line_items?: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
      tax_rate?: number;
    }>;
    dates?: {
      invoice_date?: string;
      due_date?: string;
      payment_date?: string;
    };
    parties?: {
      vendor?: string;
      customer?: string;
      payer?: string;
      payee?: string;
    };
    bank_info?: {
      account_number?: string;
      routing_number?: string;
      bank_name?: string;
      iban?: string;
      swift?: string;
    };
  };

  // Contract data
  contract?: {
    parties: Array<{
      name: string;
      role: string;
      contact_info?: string;
    }>;
    effective_date: string;
    expiration_date?: string;
    term_length?: string;
    renewal_terms?: string;
    payment_terms?: string;
    key_obligations: string[];
    termination_clauses: string[];
    limitations_of_liability: string[];
    governing_law: string;
    jurisdiction: string;
  };

  // Identity data
  identity?: {
    full_name: string;
    date_of_birth?: string;
    address?: string;
    document_number?: string;
    issuing_authority?: string;
    expiration_date?: string;
    nationality?: string;
    gender?: string;
    biometric_data?: {
      photo_quality_score?: number;
      fingerprint_match?: boolean;
      facial_recognition_score?: number;
    };
  };

  // Compliance data
  compliance?: {
    risk_score: number;
    compliance_flags: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
      recommendation?: string;
    }>;
    regulatory_requirements: Array<{
      regulation: string;
      status: 'COMPLIANT' | 'NON_COMPLIANT' | 'REQUIRES_REVIEW';
      gaps?: string[];
    }>;
    audit_trail: Array<{
      action: string;
      timestamp: string;
      actor: string;
      details?: string;
    }>;
  };

  // General entities
  entities?: Array<{
    text: string;
    type: string;
    confidence: number;
    context?: string;
    importance: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;

  // Key terms
  key_terms?: Array<{
    term: string;
    definition: string;
    context: string;
    importance: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;

  // Action items
  action_items?: Array<{
    description: string;
    assignee?: string;
    due_date?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  }>;
}

export interface DocumentAnalysisResult {
  document_id: string;
  classification: {
    type: DocumentType;
    category: DocumentCategory;
    confidence: number;
    reasoning: string;
  };
  extracted_data: ExtractedData;
  quality_assessment: {
    overall_score: number;
    readability_score: number;
    completeness_score: number;
    accuracy_score: number;
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      suggestion?: string;
    }>;
  };
  compliance_assessment: {
    overall_risk_score: number;
    compliance_score: number;
    regulatory_flags: Array<{
      regulation: string;
      flag_type: string;
      severity: string;
      description: string;
    }>;
    required_actions: string[];
  };
  business_insights: {
    summary: string;
    key_points: string[];
    risks: Array<{
      type: string;
      level: string;
      description: string;
      mitigation?: string;
    }>;
    opportunities: string[];
    recommendations: string[];
  };
  processing_metadata: {
    processing_time: number;
    models_used: string[];
    confidence_scores: Record<string, number>;
    manual_review_required: boolean;
    review_reasons?: string[];
  };
}

export class DocumentAIService {
  private logger: Logger;
  private dbService: DatabaseService;
  private vectorService: VectorEmbeddingService;
  private multiModalProcessor: MultiModalAIProcessor;
  private aiService: any;

  constructor(env: any) {
    this.logger = new Logger(env, 'DocumentAI');
    this.dbService = new DatabaseService(env);
    this.vectorService = new VectorEmbeddingService(env);
    this.multiModalProcessor = new MultiModalAIProcessor(env);
    this.aiService = env.AI;
  }

  /**
   * Initialize Document AI system
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing Document AI System...');

    try {
      // Create document AI tables
      await this.createDocumentAITables();

      // Load document classification models
      await this.loadClassificationModels();

      // Setup document processing workflows
      await this.setupProcessingWorkflows();

      this.logger.info('Document AI System initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Document AI System', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create Document AI database tables
   */
  private async createDocumentAITables(): Promise<void> {
    const tables = [
      // Documents
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT,
        metadata TEXT,
        extracted_data TEXT,
        confidence REAL DEFAULT 0,
        processing_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL
      )`,

      // Document classification history
      `CREATE TABLE IF NOT EXISTS document_classifications (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        previous_type TEXT,
        new_type TEXT NOT NULL,
        previous_category TEXT,
        new_category TEXT NOT NULL,
        confidence REAL NOT NULL,
        reasoning TEXT,
        classifier TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id)
      )`,

      // Document relationships
      `CREATE TABLE IF NOT EXISTS document_relationships (
        id TEXT PRIMARY KEY,
        source_document_id TEXT NOT NULL,
        target_document_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (source_document_id) REFERENCES documents(id),
        FOREIGN KEY (target_document_id) REFERENCES documents(id)
      )`,

      // Document analytics
      `CREATE TABLE IF NOT EXISTS document_analytics (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        analysis_type TEXT NOT NULL,
        results TEXT,
        confidence REAL,
        processing_time INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id)
      )`,

      // Document templates
      `CREATE TABLE IF NOT EXISTS document_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        template_fields TEXT,
        validation_rules TEXT,
        extraction_patterns TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        organization_id TEXT
      )`,

      // Processing queue
      `CREATE TABLE IF NOT EXISTS document_processing_queue (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        processing_type TEXT NOT NULL,
        priority INTEGER DEFAULT 5,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error_message TEXT,
        scheduled_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id)
      )`
    ];

    for (const tableSql of tables) {
      await this.dbService.query(tableSql);
    }
  }

  /**
   * Load document classification models
   */
  private async loadClassificationModels(): Promise<void> {
    // Load default document templates
    await this.loadDefaultTemplates();
    this.logger.info('Document classification models loaded');
  }

  /**
   * Load default document templates
   */
  private async loadDefaultTemplates(): Promise<void> {
    const templates = [
      {
        name: 'Standard Invoice',
        type: 'invoice',
        category: 'financial',
        template_fields: JSON.stringify([
          { name: 'invoice_number', required: true, type: 'string' },
          { name: 'vendor_name', required: true, type: 'string' },
          { name: 'total_amount', required: true, type: 'currency' },
          { name: 'invoice_date', required: true, type: 'date' },
          { name: 'due_date', required: false, type: 'date' }
        ]),
        validation_rules: JSON.stringify([
          { rule: 'total_amount > 0', message: 'Total amount must be positive' },
          { rule: 'invoice_date <= due_date', message: 'Due date must be after invoice date' }
        ]),
        extraction_patterns: JSON.stringify([
          { pattern: 'Invoice[:\\s#]+([A-Z0-9-]+)', field: 'invoice_number' },
          { pattern: 'Total[:\\s$]*([0-9,]+\\.\\d{2})', field: 'total_amount' }
        ])
      },
      {
        name: 'Bank Statement',
        type: 'bank_statement',
        category: 'financial',
        template_fields: JSON.stringify([
          { name: 'account_number', required: true, type: 'string' },
          { name: 'statement_period', required: true, type: 'date_range' },
          { name: 'beginning_balance', required: true, type: 'currency' },
          { name: 'ending_balance', required: true, type: 'currency' }
        ]),
        validation_rules: JSON.stringify([
          { rule: 'account_number matches \\d{4,}', message: 'Valid account number required' }
        ]),
        extraction_patterns: JSON.stringify([
          { pattern: 'Account[:\\s#]+([0-9]+)', field: 'account_number' },
          { pattern: 'Statement[:\\s]+([A-Za-z]+ \\d{1,2}, \\d{4}.*?[A-Za-z]+ \\d{1,2}, \\d{4})', field: 'statement_period' }
        ])
      },
      {
        name: 'Employment Contract',
        type: 'contract',
        category: 'legal',
        template_fields: JSON.stringify([
          { name: 'employee_name', required: true, type: 'string' },
          { name: 'employer_name', required: true, type: 'string' },
          { name: 'start_date', required: true, type: 'date' },
          { name: 'salary', required: true, type: 'currency' }
        ]),
        validation_rules: JSON.stringify([
          { rule: 'start_date is valid date', message: 'Valid start date required' },
          { rule: 'salary > 0', message: 'Salary must be positive' }
        ]),
        extraction_patterns: JSON.stringify([
          { pattern: 'Effective Date[:\\s]+([A-Za-z]+ \\d{1,2}, \\d{4})', field: 'start_date' },
          { pattern: 'Salary[:\\s$]*([0-9,]+\\.\\d{2})', field: 'salary' }
        ])
      }
    ];

    for (const template of templates) {
      const templateId = crypto.randomUUID();
      const now = new Date().toISOString();

      await this.dbService.query(`
        INSERT OR REPLACE INTO document_templates (
          id, name, type, category, template_fields, validation_rules,
          extraction_patterns, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        templateId,
        template.name,
        template.type,
        template.category,
        template.template_fields,
        template.validation_rules,
        template.extraction_patterns,
        now,
        now
      ]);
    }

    this.logger.info('Default document templates loaded', { count: templates.length });
  }

  /**
   * Setup processing workflows
   */
  private async setupProcessingWorkflows(): Promise<void> {
    // Initialize workflow configurations
    this.logger.info('Document processing workflows configured');
  }

  /**
   * Process document with AI analysis
   */
  public async processDocument(
    content: string,
    metadata: Partial<DocumentMetadata>,
    options: {
      userId: string;
      organizationId: string;
      priority?: number;
      forceReprocess?: boolean;
    }
  ): Promise<string> {
    const documentId = crypto.randomUUID();
    this.logger.info('Processing document', { documentId, userId: options.userId });

    try {
      // Initial document classification
      const initialClassification = await this.classifyDocument(content);

      // Create document record
      const document: Document = {
        id: documentId,
        title: metadata.file_info?.name || `Document ${documentId.substring(0, 8)}`,
        type: initialClassification.type,
        category: initialClassification.category,
        content,
        metadata: {
          file_info: {
            name: metadata.file_info?.name || '',
            size: metadata.file_info?.size || content.length,
            mime_type: metadata.file_info?.mime_type || 'text/plain',
            checksum: await this.calculateChecksum(content)
          },
          source: metadata.source || 'manual_upload',
          author: metadata.author,
          recipient: metadata.recipient,
          date_created: metadata.date_created,
          date_modified: metadata.date_modified,
          language: metadata.language || 'en',
          pages: metadata.pages,
          tags: metadata.tags || [],
          sensitivity: metadata.sensitivity || 'internal',
          retention_period: metadata.retention_period,
          compliance_requirements: metadata.compliance_requirements || [],
          custom_fields: metadata.custom_fields || {}
        },
        extracted_data: {},
        confidence: initialClassification.confidence,
        processing_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: options.userId,
        organization_id: options.organizationId
      };

      // Store document
      await this.dbService.query(`
        INSERT INTO documents (
          id, title, type, category, content, metadata, extracted_data,
          confidence, processing_status, created_at, updated_at,
          user_id, organization_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        document.id,
        document.title,
        document.type,
        document.category,
        document.content,
        JSON.stringify(document.metadata),
        JSON.stringify(document.extracted_data),
        document.confidence,
        document.processing_status,
        document.created_at,
        document.updated_at,
        document.user_id,
        document.organization_id
      ]);

      // Add to processing queue
      await this.addToProcessingQueue(documentId, 'full_analysis', options.priority);

      // Start async processing
      this.processDocumentAsync(documentId);

      return documentId;
    } catch (error) {
      this.logger.error('Failed to process document', {
        documentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Classify document type and category
   */
  private async classifyDocument(content: string): Promise<{
    type: DocumentType;
    category: DocumentCategory;
    confidence: number;
    reasoning: string;
  }> {
    try {
      const prompt = `
Analyze the following document content and classify it by type and category.

Document Content:
${content.substring(0, 2000)}...

Document Types: invoice, receipt, contract, financial_statement, bank_statement, tax_document, identity_document, compliance_report, board_minutes, agreement, other

Document Categories: financial, legal, compliance, operational, strategic, administrative

Return your analysis in JSON format:
{
  "type": "document_type",
  "category": "document_category",
  "confidence": 0.95,
  "reasoning": "Explanation of why this document was classified this way"
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 300,
        temperature: 0.1
      });

      const classification = JSON.parse(response.response);

      return {
        type: classification.type || 'other',
        category: classification.category || 'administrative',
        confidence: classification.confidence || 0.5,
        reasoning: classification.reasoning || 'AI classification'
      };
    } catch (error) {
      this.logger.warn('Document classification failed', { error: error.message });
      return {
        type: 'other',
        category: 'administrative',
        confidence: 0.3,
        reasoning: 'Classification failed - default assignment'
      };
    }
  }

  /**
   * Process document asynchronously
   */
  private async processDocumentAsync(documentId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Get document
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Update status
      await this.updateDocumentStatus(documentId, 'processing');

      // Create processing request for multi-modal analysis
      const processingRequest: ProcessingRequest = {
        id: crypto.randomUUID(),
        type: 'document',
        content: document.content,
        metadata: {
          documentType: document.type,
          documentCategory: document.category
        },
        options: {
          extract_text: true,
          extract_entities: true,
          analyze_sentiment: true,
          extract_tables: true,
          language_detection: true,
          quality_check: true,
          compliance_check: true,
          pii_detection: true
        },
        user_id: document.user_id,
        organization_id: document.organization_id
      };

      // Submit to multi-modal processor
      const processingResultId = await this.multiModalProcessor.submitProcessingRequest(processingRequest);

      // Wait for processing to complete
      const processingResult = await this.waitForProcessingCompletion(processingResultId);

      if (processingResult.status === 'completed' && processingResult.results) {
        // Perform document-specific analysis
        const analysisResult = await this.performDocumentAnalysis(document, processingResult.results);

        // Update document with extracted data and analysis
        await this.updateDocumentWithAnalysis(documentId, analysisResult);

        // Store analysis results
        await this.storeAnalysisResults(documentId, analysisResult);

        // Update status to completed
        await this.updateDocumentStatus(documentId, 'completed');

        // Add to knowledge base
        await this.addToKnowledgeBase(document, analysisResult);

      } else {
        throw new Error(processingResult.errors?.join(', ') || 'Processing failed');
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Document processing completed', {
        documentId,
        processingTime,
        type: document.type
      });

    } catch (error) {
      await this.updateDocumentStatus(documentId, 'failed');
      this.logger.error('Document processing failed', {
        documentId,
        error: error.message
      });
    } finally {
      // Remove from processing queue
      await this.removeFromProcessingQueue(documentId, 'full_analysis');
    }
  }

  /**
   * Perform document-specific analysis
   */
  private async performDocumentAnalysis(
    document: Document,
    processingResults: any
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();

    try {
      // Document classification
      const classification = await this.analyzeDocumentClassification(document, processingResults);

      // Extract structured data based on document type
      const extractedData = await this.extractStructuredData(document, processingResults);

      // Quality assessment
      const qualityAssessment = await this.assessDocumentQuality(document, processingResults);

      // Compliance assessment
      const complianceAssessment = await this.assessCompliance(document, extractedData);

      // Business insights
      const businessInsights = await this.generateBusinessInsights(document, extractedData);

      const processingTime = Date.now() - startTime;

      return {
        document_id: document.id,
        classification,
        extracted_data: extractedData,
        quality_assessment: qualityAssessment,
        compliance_assessment: complianceAssessment,
        business_insights: businessInsights,
        processing_metadata: {
          processing_time: processingTime,
          models_used: ['multi-modal-ai', 'document-classifier', 'compliance-analyzer'],
          confidence_scores: {
            classification: classification.confidence,
            extraction: this.calculateExtractionConfidence(extractedData),
            quality: qualityAssessment.overall_score,
            compliance: complianceAssessment.compliance_score
          },
          manual_review_required: this.requiresManualReview(classification, qualityAssessment, complianceAssessment),
          review_reasons: this.getReviewReasons(classification, qualityAssessment, complianceAssessment)
        }
      };
    } catch (error) {
      this.logger.error('Document analysis failed', {
        documentId: document.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze document classification with enhanced reasoning
   */
  private async analyzeDocumentClassification(
    document: Document,
    processingResults: any
  ): Promise<DocumentAnalysisResult['classification']> {
    try {
      const entities = processingResults.entities || [];
      const text = processingResults.text?.content || document.content;

      // Look for specific indicators based on entities and content
      const indicators = {
        invoice: this.hasInvoiceIndicators(text, entities),
        contract: this.hasContractIndicators(text, entities),
        financial_statement: this.hasFinancialStatementIndicators(text, entities),
        bank_statement: this.hasBankStatementIndicators(text, entities),
        receipt: this.hasReceiptIndicators(text, entities),
        tax_document: this.hasTaxDocumentIndicators(text, entities)
      };

      // Determine most likely type
      let bestType = document.type;
      let bestScore = 0;

      for (const [type, score] of Object.entries(indicators)) {
        if (score > bestScore) {
          bestScore = score;
          bestType = type as DocumentType;
        }
      }

      // Generate reasoning
      const reasoning = this.generateClassificationReasoning(bestType, indicators, entities);

      return {
        type: bestType,
        category: this.getCategoryForType(bestType),
        confidence: Math.min(bestScore, 1.0),
        reasoning
      };
    } catch (error) {
      this.logger.warn('Enhanced classification failed', { error: error.message });
      return {
        type: document.type,
        category: document.category,
        confidence: document.confidence,
        reasoning: 'Enhanced analysis failed - using initial classification'
      };
    }
  }

  /**
   * Check for invoice indicators
   */
  private hasInvoiceIndicators(text: string, entities: any[]): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    // Invoice-specific keywords
    const invoiceKeywords = ['invoice', 'bill', 'due', 'payment terms', 'net', 'po'];
    const keywordMatches = invoiceKeywords.filter(keyword => lowerText.includes(keyword)).length;
    score += keywordMatches * 0.2;

    // Financial entities
    const moneyEntities = entities.filter(e => e.type === 'MONEY').length;
    score += moneyEntities * 0.15;

    // Date entities
    const dateEntities = entities.filter(e => e.type === 'DATE').length;
    score += dateEntities * 0.1;

    // Organization entities (vendor/customer)
    const orgEntities = entities.filter(e => e.type === 'ORGANIZATION').length;
    score += orgEntities * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Check for contract indicators
   */
  private hasContractIndicators(text: string, entities: any[]): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    const contractKeywords = [
      'agreement', 'contract', 'terms and conditions', 'parties', 'signature',
      'effective date', 'termination', 'liability', 'indemnify', 'warranty'
    ];
    const keywordMatches = contractKeywords.filter(keyword => lowerText.includes(keyword)).length;
    score += keywordMatches * 0.15;

    // Legal terms
    const legalTerms = ['hereinafter', 'whereas', 'notwithstanding', 'pursuant'];
    const legalMatches = legalTerms.filter(term => lowerText.includes(term)).length;
    score += legalMatches * 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Check for financial statement indicators
   */
  private hasFinancialStatementIndicators(text: string, entities: any[]): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    const statementKeywords = [
      'balance sheet', 'income statement', 'cash flow', 'assets', 'liabilities',
      'equity', 'revenue', 'expenses', 'profit', 'loss', 'financial statements'
    ];
    const keywordMatches = statementKeywords.filter(keyword => lowerText.includes(keyword)).length;
    score += keywordMatches * 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Check for bank statement indicators
   */
  private hasBankStatementIndicators(text: string, entities: any[]): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    const statementKeywords = [
      'bank statement', 'account number', 'statement period', 'beginning balance',
      'ending balance', 'deposits', 'withdrawals', 'transactions'
    ];
    const keywordMatches = statementKeywords.filter(keyword => lowerText.includes(keyword)).length;
    score += keywordMatches * 0.25;

    return Math.min(score, 1.0);
  }

  /**
   * Check for receipt indicators
   */
  private hasReceiptIndicators(text: string, entities: any[]): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    const receiptKeywords = ['receipt', 'thank you', 'cashier', 'register', 'sale', 'purchase'];
    const keywordMatches = receiptKeywords.filter(keyword => lowerText.includes(keyword)).length;
    score += keywordMatches * 0.3;

    return Math.min(score, 1.0);
  }

  /**
   * Check for tax document indicators
   */
  private hasTaxDocumentIndicators(text: string, entities: any[]): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    const taxKeywords = [
      'tax return', 'irs', 'internal revenue service', 'taxable income',
      'deductions', 'exemptions', 'tax year', 'form 1040', 'w-2', '1099'
    ];
    const keywordMatches = taxKeywords.filter(keyword => lowerText.includes(keyword)).length;
    score += keywordMatches * 0.25;

    return Math.min(score, 1.0);
  }

  /**
   * Generate classification reasoning
   */
  private generateClassificationReasoning(
    detectedType: string,
    indicators: Record<string, number>,
    entities: any[]
  ): string {
    const reasons = [];

    // Find top indicators
    const sortedIndicators = Object.entries(indicators)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    for (const [type, score] of sortedIndicators) {
      if (score > 0.1) {
        reasons.push(`Strong ${type} indicators detected (confidence: ${(score * 100).toFixed(1)}%)`);
      }
    }

    // Entity-based reasoning
    const entityCounts = entities.reduce((acc, entity) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1;
      return acc;
    }, {});

    if (entityCounts.MONEY > 0) {
      reasons.push(`Contains ${entityCounts.MONEY} monetary amounts`);
    }
    if (entityCounts.DATE > 0) {
      reasons.push(`Contains ${entityCounts.DATE} date references`);
    }
    if (entityCounts.ORGANIZATION > 0) {
      reasons.push(`References ${entityCounts.ORGANIZATION} organizations`);
    }

    return reasons.length > 0
      ? `Classified as ${detectedType} because: ${reasons.join('; ')}`
      : `Classified as ${detectedType} based on document content analysis`;
  }

  /**
   * Get category for document type
   */
  private getCategoryForType(type: DocumentType): DocumentCategory {
    const categoryMap: Record<DocumentType, DocumentCategory> = {
      invoice: 'financial',
      receipt: 'financial',
      contract: 'legal',
      financial_statement: 'financial',
      bank_statement: 'financial',
      tax_document: 'compliance',
      identity_document: 'compliance',
      compliance_report: 'compliance',
      board_minutes: 'strategic',
      agreement: 'legal',
      other: 'administrative'
    };

    return categoryMap[type] || 'administrative';
  }

  /**
   * Extract structured data based on document type
   */
  private async extractStructuredData(
    document: Document,
    processingResults: any
  ): Promise<ExtractedData> {
    const extractedData: ExtractedData = {};

    switch (document.type) {
      case 'invoice':
        extractedData.financials = await this.extractInvoiceData(document, processingResults);
        break;
      case 'contract':
        extractedData.contract = await this.extractContractData(document, processingResults);
        break;
      case 'identity_document':
        extractedData.identity = await this.extractIdentityData(document, processingResults);
        break;
      case 'bank_statement':
        extractedData.financials = await this.extractBankStatementData(document, processingResults);
        break;
    }

    // Extract common data
    extractedData.entities = processingResults.entities?.map((entity: any) => ({
      text: entity.text,
      type: entity.type,
      confidence: entity.confidence,
      context: this.getEntityContext(entity, processingResults.text?.content || ''),
      importance: this.determineEntityImportance(entity, document.type)
    })) || [];

    return extractedData;
  }

  /**
   * Extract invoice data
   */
  private async extractInvoiceData(
    document: Document,
    processingResults: any
  ): Promise<ExtractedData['financials']> {
    try {
      const text = processingResults.text?.content || document.content;
      const entities = processingResults.entities || [];

      const prompt = `
Extract financial information from this invoice:

Text:
${text.substring(0, 2000)}

Extract:
1. Total amount
2. Tax amount
3. Currency
4. Invoice date
5. Due date
6. Vendor name
7. Customer name
8. Line items (description, quantity, unit price, total)

Return in JSON format:
{
  "currency": "USD",
  "total_amount": 1500.00,
  "tax_amount": 120.00,
  "dates": {
    "invoice_date": "2024-01-15",
    "due_date": "2024-02-15"
  },
  "parties": {
    "vendor": "ABC Company",
    "customer": "XYZ Corp"
  },
  "line_items": [
    {
      "description": "Consulting services",
      "quantity": 40,
      "unit_price": 37.50,
      "total": 1500.00
    }
  ]
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 1000,
        temperature: 0.1
      });

      return JSON.parse(response.response);
    } catch (error) {
      this.logger.warn('Invoice data extraction failed', { error: error.message });
      return {
        currency: 'USD',
        total_amount: 0,
        tax_amount: 0
      };
    }
  }

  /**
   * Extract contract data
   */
  private async extractContractData(
    document: Document,
    processingResults: any
  ): Promise<ExtractedData['contract']> {
    try {
      const text = processingResults.text?.content || document.content;

      const prompt = `
Extract contract information from this document:

Text:
${text.substring(0, 2000)}

Extract:
1. Parties involved
2. Effective date
3. Expiration date
4. Key obligations
5. Payment terms
6. Governing law
7. Termination clauses

Return in JSON format:
{
  "parties": [
    {
      "name": "Company A",
      "role": "Service Provider",
      "contact_info": "contact@companya.com"
    }
  ],
  "effective_date": "2024-01-01",
  "expiration_date": "2025-12-31",
  "key_obligations": ["Provide services", "Maintain confidentiality"],
  "payment_terms": "Net 30 days",
  "governing_law": "California",
  "jurisdiction": "California"
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 1000,
        temperature: 0.1
      });

      return JSON.parse(response.response);
    } catch (error) {
      this.logger.warn('Contract data extraction failed', { error: error.message });
      return {
        parties: [],
        effective_date: '',
        key_obligations: [],
        governing_law: '',
        jurisdiction: ''
      };
    }
  }

  /**
   * Extract identity document data
   */
  private async extractIdentityData(
    document: Document,
    processingResults: any
  ): Promise<ExtractedData['identity']> {
    try {
      const text = processingResults.text?.content || document.content;

      const prompt = `
Extract identity information from this document:

Text:
${text.substring(0, 2000)}

Extract:
1. Full name
2. Date of birth
3. Address
4. Document number
5. Issuing authority
6. Expiration date
7. Nationality

Return in JSON format:
{
  "full_name": "John Doe",
  "date_of_birth": "1980-01-15",
  "address": "123 Main St, City, State 12345",
  "document_number": "D12345678",
  "issuing_authority": "DMV",
  "expiration_date": "2030-01-15",
  "nationality": "US"
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 500,
        temperature: 0.1
      });

      return JSON.parse(response.response);
    } catch (error) {
      this.logger.warn('Identity data extraction failed', { error: error.message });
      return {
        full_name: '',
        date_of_birth: '',
        address: '',
        document_number: '',
        issuing_authority: ''
      };
    }
  }

  /**
   * Extract bank statement data
   */
  private async extractBankStatementData(
    document: Document,
    processingResults: any
  ): Promise<ExtractedData['financials']> {
    try {
      const text = processingResults.text?.content || document.content;

      const prompt = `
Extract bank statement information from this document:

Text:
${text.substring(0, 2000)}

Extract:
1. Account number
2. Statement period
3. Beginning balance
4. Ending balance
5. Total deposits
6. Total withdrawals
7. Bank name

Return in JSON format:
{
  "bank_info": {
    "account_number": "123456789",
    "bank_name": "ABC Bank"
  },
  "statement_period": "January 2024",
  "total_amount": 5000.00,
  "dates": {
    "period_start": "2024-01-01",
    "period_end": "2024-01-31"
  }
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 500,
        temperature: 0.1
      });

      return JSON.parse(response.response);
    } catch (error) {
      this.logger.warn('Bank statement data extraction failed', { error: error.message });
      return {
        currency: 'USD',
        total_amount: 0
      };
    }
  }

  /**
   * Get entity context
   */
  private getEntityContext(entity: any, text: string): string {
    const start = Math.max(0, entity.start_position - 50);
    const end = Math.min(text.length, entity.end_position + 50);
    return text.substring(start, end).trim();
  }

  /**
   * Determine entity importance
   */
  private determineEntityImportance(entity: any, documentType: DocumentType): 'LOW' | 'MEDIUM' | 'HIGH' {
    const importantTypes = {
      invoice: ['MONEY', 'DATE', 'ORGANIZATION'],
      contract: ['PERSON', 'ORGANIZATION', 'DATE'],
      identity_document: ['PERSON', 'ID', 'DATE'],
      bank_statement: ['MONEY', 'DATE', 'ID']
    };

    return importantTypes[documentType]?.includes(entity.type) ? 'HIGH' : 'MEDIUM';
  }

  /**
   * Assess document quality
   */
  private async assessDocumentQuality(
    document: Document,
    processingResults: any
  ): Promise<DocumentAnalysisResult['quality_assessment']> {
    try {
      const text = processingResults.text?.content || document.content;
      const entities = processingResults.entities || [];
      const tables = processingResults.tables || [];

      // Readability score
      const readabilityScore = this.calculateReadabilityScore(text);

      // Completeness score based on expected content
      const completenessScore = this.calculateCompletenessScore(document, entities, tables);

      // Accuracy score based on extraction confidence
      const accuracyScore = this.calculateAccuracyScore(processingResults);

      // Overall score
      const overallScore = (readabilityScore + completenessScore + accuracyScore) / 3;

      // Identify issues
      const issues = this.identifyQualityIssues(text, entities, tables, document.type);

      return {
        overall_score: overallScore,
        readability_score: readabilityScore,
        completeness_score: completenessScore,
        accuracy_score: accuracyScore,
        issues
      };
    } catch (error) {
      this.logger.warn('Quality assessment failed', { error: error.message });
      return {
        overall_score: 0.5,
        readability_score: 0.5,
        completeness_score: 0.5,
        accuracy_score: 0.5,
        issues: []
      };
    }
  }

  /**
   * Calculate readability score
   */
  private calculateReadabilityScore(text: string): number {
    if (!text) return 0;

    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;

    // Simple readability metric
    let score = 1.0;

    // Penalize very long sentences
    if (avgWordsPerSentence > 25) score -= 0.2;
    else if (avgWordsPerSentence > 20) score -= 0.1;

    // Penalize very short text
    if (words < 50) score -= 0.3;
    else if (words < 100) score -= 0.1;

    // Penalize lack of structure
    const hasParagraphs = text.includes('\n\n');
    if (!hasParagraphs && words > 200) score -= 0.2;

    return Math.max(0, score);
  }

  /**
   * Calculate completeness score
   */
  private calculateCompletenessScore(
    document: Document,
    entities: any[],
    tables: any[]
  ): number {
    const requirements = this.getDocumentTypeRequirements(document.type);
    let score = 0;
    let totalRequirements = 0;

    for (const requirement of requirements) {
      totalRequirements++;
      if (this.requirementSatisfied(requirement, entities, tables, document.content)) {
        score += 1;
      }
    }

    return totalRequirements > 0 ? score / totalRequirements : 0.5;
  }

  /**
   * Get document type requirements
   */
  private getDocumentTypeRequirements(type: DocumentType): string[] {
    const requirements: Record<DocumentType, string[]> = {
      invoice: ['MONEY', 'DATE', 'ORGANIZATION'],
      contract: ['PERSON', 'ORGANIZATION', 'DATE'],
      financial_statement: ['MONEY', 'DATE'],
      bank_statement: ['MONEY', 'DATE', 'ID'],
      receipt: ['MONEY', 'DATE'],
      tax_document: ['MONEY', 'DATE', 'ID'],
      identity_document: ['PERSON', 'ID', 'DATE'],
      compliance_report: ['DATE'],
      board_minutes: ['PERSON', 'DATE'],
      agreement: ['PERSON', 'ORGANIZATION', 'DATE'],
      other: []
    };

    return requirements[type] || [];
  }

  /**
   * Check if requirement is satisfied
   */
  private requirementSatisfied(
    requirement: string,
    entities: any[],
    tables: any[],
    content: string
  ): boolean {
    // Check entities
    if (entities.some(e => e.type === requirement)) return true;

    // Check content for keywords
    const contentLower = content.toLowerCase();
    const keywords: Record<string, string[]> = {
      'MONEY': ['$', 'amount', 'total', 'price', 'cost'],
      'DATE': ['date', 'time', 'when'],
      'PERSON': ['name', 'address', 'phone'],
      'ORGANIZATION': ['company', 'inc', 'llc', 'corporation'],
      'ID': ['number', 'id', 'account', 'reference']
    };

    const requirementKeywords = keywords[requirement] || [];
    return requirementKeywords.some(keyword => contentLower.includes(keyword));
  }

  /**
   * Calculate accuracy score
   */
  private calculateAccuracyScore(processingResults: any): number {
    const confidences = [];

    if (processingResults.text?.confidence) confidences.push(processingResults.text.confidence);
    if (processingResults.entities?.length) {
      const avgEntityConfidence = processingResults.entities.reduce((sum: number, e: any) => sum + e.confidence, 0) / processingResults.entities.length;
      confidences.push(avgEntityConfidence);
    }

    if (confidences.length === 0) return 0.5;
    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }

  /**
   * Identify quality issues
   */
  private identifyQualityIssues(
    text: string,
    entities: any[],
    tables: any[],
    documentType: DocumentType
  ): Array<{ type: string; severity: string; description: string; suggestion?: string }> {
    const issues = [];

    // Low confidence issues
    if (entities.some(e => e.confidence < 0.7)) {
      issues.push({
        type: 'low_confidence_extraction',
        severity: 'MEDIUM',
        description: 'Some extracted information has low confidence',
        suggestion: 'Manual review recommended for low-confidence fields'
      });
    }

    // Missing requirements
    const requirements = this.getDocumentTypeRequirements(documentType);
    const missingRequirements = requirements.filter(req =>
      !this.requirementSatisfied(req, entities, tables, text)
    );

    if (missingRequirements.length > 0) {
      issues.push({
        type: 'missing_information',
        severity: 'HIGH',
        description: `Missing expected information: ${missingRequirements.join(', ')}`,
        suggestion: 'Verify document completeness and data quality'
      });
    }

    // Text quality issues
    if (text.length < 100) {
      issues.push({
        type: 'insufficient_content',
        severity: 'HIGH',
        description: 'Document contains very little text content',
        suggestion: 'Check if document was processed correctly'
      });
    }

    return issues;
  }

  /**
   * Assess compliance
   */
  private async assessCompliance(
    document: Document,
    extractedData: ExtractedData
  ): Promise<DocumentAnalysisResult['compliance_assessment']> {
    try {
      // PII detection
      const piiFlags = this.detectPIIComplianceIssues(document);

      // Regulatory requirements based on document type
      const regulatoryFlags = await this.checkRegulatoryCompliance(document, extractedData);

      // Calculate scores
      const overallRiskScore = Math.max(0, 1 - (piiFlags.length * 0.2 + regulatoryFlags.length * 0.1));
      const complianceScore = Math.max(0, 1 - (piiFlags.length * 0.15 + regulatoryFlags.length * 0.1));

      // Required actions
      const requiredActions = [
        ...piiFlags.map(flag => flag.recommendation || `Address PII: ${flag.type}`),
        ...regulatoryFlags.map(flag => flag.recommendation || `Comply with: ${flag.regulation}`)
      ];

      return {
        overall_risk_score: overallRiskScore,
        compliance_score: complianceScore,
        regulatory_flags: [...piiFlags, ...regulatoryFlags],
        required_actions: [...new Set(requiredActions)] // Remove duplicates
      };
    } catch (error) {
      this.logger.warn('Compliance assessment failed', { error: error.message });
      return {
        overall_risk_score: 0.5,
        compliance_score: 0.5,
        regulatory_flags: [],
        required_actions: []
      };
    }
  }

  /**
   * Detect PII compliance issues
   */
  private detectPIIComplianceIssues(document: Document): Array<{
    regulation: string;
    flag_type: string;
    severity: string;
    description: string;
    recommendation?: string;
  }> {
    const flags = [];
    const content = document.content.toLowerCase();

    // Check for PII patterns
    const piiPatterns = [
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'SSN', severity: 'HIGH' },
      { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, type: 'Credit Card', severity: 'HIGH' },
      { pattern: /\b\d{9}\b/g, type: 'Account Number', severity: 'MEDIUM' }
    ];

    for (const { pattern, type, severity } of piiPatterns) {
      if (pattern.test(content)) {
        flags.push({
          regulation: 'PCI DSS / GLBA',
          flag_type: `PII Detection: ${type}`,
          severity,
          description: `Document contains ${type} information`,
          recommendation: 'Apply encryption or redaction for sensitive data'
        });
      }
    }

    // Check document sensitivity
    if (document.metadata.sensitivity === 'restricted') {
      flags.push({
        regulation: 'Internal Policy',
        flag_type: 'Restricted Document',
        severity: 'HIGH',
        description: 'Document marked as restricted sensitivity',
        recommendation: 'Ensure proper access controls and audit logging'
      });
    }

    return flags;
  }

  /**
   * Check regulatory compliance
   */
  private async checkRegulatoryCompliance(
    document: Document,
    extractedData: ExtractedData
  ): Promise<Array<{
    regulation: string;
    flag_type: string;
    severity: string;
    description: string;
    recommendation?: string;
  }>> {
    const flags = [];

    // Financial document compliance
    if (['invoice', 'receipt', 'financial_statement'].includes(document.type)) {
      if (!extractedData.financials?.currency) {
        flags.push({
          regulation: 'SOX',
          flag_type: 'Missing Currency Information',
          severity: 'MEDIUM',
          description: 'Financial document missing currency specification',
          recommendation: 'Add currency information for compliance'
        });
      }
    }

    // Contract compliance
    if (document.type === 'contract') {
      if (!extractedData.contract?.governing_law) {
        flags.push({
          regulation: 'Contract Law',
          flag_type: 'Missing Governing Law',
          severity: 'HIGH',
          description: 'Contract missing governing law clause',
          recommendation: 'Add governing law and jurisdiction clauses'
        });
      }
    }

    // Identity document compliance
    if (document.type === 'identity_document') {
      if (!extractedData.identity?.expiration_date) {
        flags.push({
          regulation: 'KYC/AML',
          flag_type: 'Missing Expiration Date',
          severity: 'MEDIUM',
          description: 'Identity document missing expiration date',
          recommendation: 'Verify document validity and expiration'
        });
      }
    }

    return flags;
  }

  /**
   * Generate business insights
   */
  private async generateBusinessInsights(
    document: Document,
    extractedData: ExtractedData
  ): Promise<DocumentAnalysisResult['business_insights']> {
    try {
      const prompt = `
Analyze this document and provide business insights:

Document Type: ${document.type}
Document Content: ${document.content.substring(0, 1500)}
Extracted Data: ${JSON.stringify(extractedData, null, 2)}

Provide:
1. A brief summary of the document
2. Key points (3-5 items)
3. Potential risks (if any)
4. Business opportunities or recommendations

Return in JSON format:
{
  "summary": "Document summary",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "risks": [
    {
      "type": "Financial",
      "level": "Medium",
      "description": "Risk description",
      "mitigation": "Mitigation strategy"
    }
  ],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 800,
        temperature: 0.3
      });

      return JSON.parse(response.response);
    } catch (error) {
      this.logger.warn('Business insights generation failed', { error: error.message });
      return {
        summary: 'Unable to generate business insights',
        key_points: [],
        risks: [],
        opportunities: [],
        recommendations: []
      };
    }
  }

  /**
   * Calculate extraction confidence
   */
  private calculateExtractionConfidence(extractedData: ExtractedData): number {
    const confidences = [];

    if (extractedData.financials) confidences.push(0.8);
    if (extractedData.contract) confidences.push(0.75);
    if (extractedData.identity) confidences.push(0.85);
    if (extractedData.entities?.length) confidences.push(0.9);

    return confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0.5;
  }

  /**
   * Check if manual review is required
   */
  private requiresManualReview(
    classification: DocumentAnalysisResult['classification'],
    quality: DocumentAnalysisResult['quality_assessment'],
    compliance: DocumentAnalysisResult['compliance_assessment']
  ): boolean {
    return (
      classification.confidence < 0.7 ||
      quality.overall_score < 0.6 ||
      compliance.compliance_score < 0.7 ||
      compliance.overall_risk_score > 0.8 ||
      quality.issues.some(issue => issue.severity === 'HIGH')
    );
  }

  /**
   * Get review reasons
   */
  private getReviewReasons(
    classification: DocumentAnalysisResult['classification'],
    quality: DocumentAnalysisResult['quality_assessment'],
    compliance: DocumentAnalysisResult['compliance_assessment']
  ): string[] {
    const reasons = [];

    if (classification.confidence < 0.7) {
      reasons.push('Low classification confidence');
    }

    if (quality.overall_score < 0.6) {
      reasons.push('Poor document quality');
    }

    if (compliance.compliance_score < 0.7) {
      reasons.push('Compliance issues detected');
    }

    if (compliance.overall_risk_score > 0.8) {
      reasons.push('High risk assessment');
    }

    if (quality.issues.some(issue => issue.severity === 'HIGH')) {
      reasons.push('High severity quality issues');
    }

    return reasons;
  }

  /**
   * Update document with analysis results
   */
  private async updateDocumentWithAnalysis(
    documentId: string,
    analysis: DocumentAnalysisResult
  ): Promise<void> {
    await this.dbService.query(`
      UPDATE documents
      SET type = ?, category = ?, confidence = ?, extracted_data = ?,
          updated_at = ?
      WHERE id = ?
    `, [
      analysis.classification.type,
      analysis.classification.category,
      analysis.classification.confidence,
      JSON.stringify(analysis.extracted_data),
      new Date().toISOString(),
      documentId
    ]);
  }

  /**
   * Store analysis results
   */
  private async storeAnalysisResults(
    documentId: string,
    analysis: DocumentAnalysisResult
  ): Promise<void> {
    await this.dbService.query(`
      INSERT INTO document_analytics (
        id, document_id, analysis_type, results, confidence,
        processing_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      documentId,
      'comprehensive_analysis',
      JSON.stringify(analysis),
      analysis.classification.confidence,
      analysis.processing_metadata.processing_time,
      new Date().toISOString()
    ]);
  }

  /**
   * Add document to knowledge base
   */
  private async addToKnowledgeBase(
    document: Document,
    analysis: DocumentAnalysisResult
  ): Promise<void> {
    try {
      // Add document to RAG system
      await this.vectorService.storeDocument(document.content, {
        id: document.id,
        title: document.title,
        type: 'text',
        source: 'document_ai',
        category: document.category,
        compliance_level: document.metadata.sensitivity,
        tags: document.metadata.tags,
        document_analysis: {
          type: document.type,
          confidence: analysis.classification.confidence,
          key_insights: analysis.business_insights.key_points
        }
      });

      this.logger.debug('Document added to knowledge base', { documentId: document.id });
    } catch (error) {
      this.logger.warn('Failed to add document to knowledge base', {
        documentId: document.id,
        error: error.message
      });
    }
  }

  /**
   * Wait for processing completion
   */
  private async waitForProcessingCompletion(
    processingResultId: string,
    maxWaitTime = 60000 // 60 seconds
  ): Promise<any> {
    const startTime = Date.now();
    const checkInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.multiModalProcessor.getRequestStatus(processingResultId);

      if (result && (result.status === 'completed' || result.status === 'failed')) {
        return result;
      }

      await this.delay(checkInterval);
    }

    throw new Error('Processing timeout');
  }

  /**
   * Update document status
   */
  private async updateDocumentStatus(documentId: string, status: string): Promise<void> {
    await this.dbService.query(`
      UPDATE documents
      SET processing_status = ?, updated_at = ?
      WHERE id = ?
    `, [status, new Date().toISOString(), documentId]);
  }

  /**
   * Add to processing queue
   */
  private async addToProcessingQueue(
    documentId: string,
    processingType: string,
    priority = 5
  ): Promise<void> {
    await this.dbService.query(`
      INSERT INTO document_processing_queue (
        id, document_id, processing_type, priority, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      documentId,
      processingType,
      priority,
      'pending',
      new Date().toISOString()
    ]);
  }

  /**
   * Remove from processing queue
   */
  private async removeFromProcessingQueue(
    documentId: string,
    processingType: string
  ): Promise<void> {
    await this.dbService.query(`
      DELETE FROM document_processing_queue
      WHERE document_id = ? AND processing_type = ?
    `, [documentId, processingType]);
  }

  /**
   * Get document by ID
   */
  private async getDocument(documentId: string): Promise<Document | null> {
    try {
      const result = await this.dbService.query(
        'SELECT * FROM documents WHERE id = ?',
        [documentId]
      );

      if (result.results.length === 0) return null;

      const row = result.results[0];
      return {
        id: row.id,
        title: row.title,
        type: row.type,
        category: row.category,
        content: row.content,
        metadata: JSON.parse(row.metadata),
        extracted_data: JSON.parse(row.extracted_data || '{}'),
        confidence: row.confidence,
        processing_status: row.processing_status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user_id: row.user_id,
        organization_id: row.organization_id
      };
    } catch (error) {
      this.logger.error('Failed to get document', { documentId, error: error.message });
      return null;
    }
  }

  /**
   * Calculate checksum
   */
  private async calculateChecksum(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get document analysis results
   */
  public async getDocumentAnalysis(documentId: string): Promise<DocumentAnalysisResult | null> {
    try {
      const result = await this.dbService.query(`
        SELECT results FROM document_analytics
        WHERE document_id = ? AND analysis_type = 'comprehensive_analysis'
        ORDER BY created_at DESC
        LIMIT 1
      `, [documentId]);

      if (result.results.length === 0) return null;

      return JSON.parse(result.results[0].results);
    } catch (error) {
      this.logger.error('Failed to get document analysis', {
        documentId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get processing statistics
   */
  public async getStatistics(): Promise<{
    total_documents: number;
    processing_status_breakdown: Record<string, number>;
    type_breakdown: Record<string, number>;
    average_processing_time: number;
    average_confidence: number;
    manual_review_rate: number;
  }> {
    try {
      // Document stats
      const docStats = await this.dbService.query(`
        SELECT
          COUNT(*) as total_documents,
          processing_status,
          type,
          AVG(confidence) as avg_confidence
        FROM documents
        GROUP BY processing_status, type
      `);

      // Processing time stats
      const timeStats = await this.dbService.query(`
        SELECT AVG(processing_time) as avg_processing_time
        FROM document_analytics
        WHERE analysis_type = 'comprehensive_analysis'
      `);

      const totalDocuments = docStats.results.reduce((sum, row) => sum + row.total_documents, 0);
      const statusBreakdown: Record<string, number> = {};
      const typeBreakdown: Record<string, number> = {};
      let totalConfidence = 0;
      let confidenceCount = 0;

      for (const row of docStats.results) {
        statusBreakdown[row.processing_status] = (statusBreakdown[row.processing_status] || 0) + row.total_documents;
        typeBreakdown[row.type] = (typeBreakdown[row.type] || 0) + row.total_documents;

        if (row.avg_confidence) {
          totalConfidence += row.avg_confidence * row.total_documents;
          confidenceCount += row.total_documents;
        }
      }

      const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
      const manualReviewRate = (statusBreakdown['failed'] || 0) / totalDocuments;

      return {
        total_documents: totalDocuments,
        processing_status_breakdown: statusBreakdown,
        type_breakdown: typeBreakdown,
        average_processing_time: timeStats.results[0]?.avg_processing_time || 0,
        average_confidence: avgConfidence,
        manual_review_rate: manualReviewRate
      };
    } catch (error) {
      this.logger.error('Failed to get Document AI statistics', {
        error: error.message
      });
      throw error;
    }
  }
}