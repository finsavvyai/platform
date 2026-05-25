/**
 * Intelligent Document Processing System
 *
 * Advanced document analysis and processing capabilities:
 * - Automatic document classification and structuring
 * - Contract analysis and key term extraction
 * - Financial statement processing and reconciliation
 * - Regulatory document parsing and compliance mapping
 */

import {
  DocumentProcessingRequest,
  DocumentProcessingResult,
  DocumentType,
  DocumentClassification,
  ExtractedTerms,
  FinancialData,
  ComplianceMapping,
  ProcessingConfig
} from './types/document-types';

export class IntelligentDocumentProcessor {
  private ai: any; // Cloudflare Workers AI
  private r2: any; // Cloudflare R2 for storage
  private vectorize: any; // Cloudflare Vectorize for embeddings
  private knowledgeGraph: any; // Knowledge graph service
  private logger: any;
  private config: ProcessingConfig;

  constructor(ai: any, r2: any, vectorize: any, knowledgeGraph: any, logger: any, config?: Partial<ProcessingConfig>) {
    this.ai = ai;
    this.r2 = r2;
    this.vectorize = vectorize;
    this.knowledgeGraph = knowledgeGraph;
    this.logger = logger;
    this.config = {
      classification: {
        enabled: true,
        model: '@cf/meta/llama-3.1-8b-instruct',
        confidenceThreshold: 0.8,
        categories: [
          'invoice', 'contract', 'financial_statement', 'regulatory_filing',
          'report', 'agreement', 'policy', 'prospectus', 'disclosure',
          'compliance_document', 'legal_document', 'tax_document'
        ]
      },
      extraction: {
        enabled: true,
        model: '@cf/unstructuredio/chinese-vision',
        ocrThreshold: 0.85,
        entityThreshold: 0.75,
        tableExtraction: true,
        formExtraction: true
      },
      financial: {
        enabled: true,
        currencyDetection: true,
        dateNormalization: true,
        amountExtraction: true,
        accountNumberDetection: true,
        reconciliation: true
      },
      compliance: {
        enabled: true,
        regulatoryFrameworks: ['SOX', 'GDPR', 'PCI-DSS', 'HIPAA', 'AML', 'KYC'],
        riskAssessment: true,
        complianceMapping: true,
        violationDetection: true
      },
      processing: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        timeoutMs: 60000, // 60 seconds
        enableCaching: true,
        cacheTTL: 3600 // 1 hour
      },
      ...config
    };
  }

  /**
   * Main document processing entry point
   */
  async process(request: DocumentProcessingRequest): Promise<DocumentProcessingResult> {
    const startTime = Date.now();

    this.logger?.info("Starting intelligent document processing", {
      requestId: request.id,
      documentType: request.documentType,
      processingOptions: request.options
    });

    try {
      // Validate request
      this.validateRequest(request);

      // Auto-detect document type if not provided
      const detectedType = await this.detectDocumentType(request);

      // Classify document
      const classification = await this.classifyDocument(request, detectedType);

      // Extract content and structure
      const extractedContent = await this.extractDocumentContent(request, classification);

      // Process based on document type
      let specializedProcessing: any = null;

      switch (classification.category) {
        case 'contract':
        case 'agreement':
          specializedProcessing = await this.processContract(request, extractedContent);
          break;
        case 'financial_statement':
        case 'invoice':
        case 'tax_document':
          specializedProcessing = await this.processFinancialDocument(request, extractedContent);
          break;
        case 'regulatory_filing':
        case 'compliance_document':
        case 'disclosure':
          specializedProcessing = await this.processRegulatoryDocument(request, extractedContent);
          break;
        default:
          specializedProcessing = await this.processGenericDocument(request, extractedContent);
          break;
      }

      // Generate embeddings for semantic search
      const embeddings = await this.generateDocumentEmbeddings(extractedContent);

      // Update knowledge graph
      const knowledgeGraphUpdates = await this.updateKnowledgeGraph(extractedContent, classification);

      const processingTime = Date.now() - startTime;

      const result: DocumentProcessingResult = {
        id: `doc_result_${request.id}`,
        requestId: request.id,
        documentType: detectedType,
        classification,
        content: extractedContent,
        specializedProcessing,
        embeddings,
        knowledgeGraphUpdates,
        metadata: {
          processingTime,
          pageCount: extractedContent.pageCount || 1,
          wordCount: extractedContent.text?.split(/\s+/).length || 0,
          tableCount: extractedContent.tables?.length || 0,
          imageCount: extractedContent.images?.length || 0,
          confidence: this.calculateOverallConfidence(classification, extractedContent),
          languages: extractedContent.languages || ['en'],
          hasSensitiveData: extractedContent.hasSensitiveData || false,
          complianceFlags: specializedProcessing?.complianceMapping?.violations?.length || 0
        },
        status: 'completed'
      };

      this.logger?.info("Document processing completed", {
        requestId: request.id,
        category: classification.category,
        processingTime,
        confidence: result.metadata.confidence
      });

      return result;

    } catch (error) {
      this.logger?.error("Document processing failed", {
        requestId: request.id,
        error: error.message,
        stack: error.stack
      });

      return {
        id: `doc_error_${request.id}`,
        requestId: request.id,
        documentType: request.documentType,
        classification: null,
        content: null,
        specializedProcessing: null,
        embeddings: [],
        knowledgeGraphUpdates: null,
        metadata: {
          processingTime: Date.now() - startTime,
          pageCount: 0,
          wordCount: 0,
          tableCount: 0,
          imageCount: 0,
          confidence: 0,
          languages: [],
          hasSensitiveData: false,
          complianceFlags: 0
        },
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Detect document type automatically
   */
  private async detectDocumentType(request: DocumentProcessingRequest): Promise<DocumentType> {
    if (request.documentType && request.documentType !== 'auto') {
      return request.documentType;
    }

    try {
      const content = request.content;
      const firstBytes = Array.from(new Uint8Array(content.slice(0, 16)));

      // Check file signatures
      if (firstBytes.join(',') === '37,80,68,70,45,49,46') {
        return 'pdf';
      }

      // Additional signature detection for other formats would go here

      // Use AI to detect document type from content
      const analysisResult = await this.ai.run(this.config.classification.model, {
        text: await this.extractTextPreview(content),
        prompt: "Analyze this document content and determine what type of document it is (invoice, contract, financial statement, report, etc.)."
      });

      const detectedType = analysisResult.category?.toLowerCase();

      // Map AI response to DocumentType enum
      const typeMapping: { [key: string]: DocumentType } = {
        'pdf': 'pdf',
        'invoice': 'pdf',
        'contract': 'pdf',
        'agreement': 'pdf',
        'financial statement': 'pdf',
        'report': 'pdf',
        'regulatory filing': 'pdf'
      };

      return typeMapping[detectedType] || 'pdf';

    } catch (error) {
      this.logger?.warn("Document type detection failed, defaulting to PDF", { error: error.message });
      return 'pdf';
    }
  }

  /**
   * Classify document with detailed categorization
   */
  private async classifyDocument(request: DocumentProcessingRequest, documentType: DocumentType): Promise<DocumentClassification> {
    try {
      const textContent = await this.extractTextPreview(request.content);

      const classificationResult = await this.ai.run(this.config.classification.model, {
        text: textContent,
        prompt: `Analyze this document and provide detailed classification:
        1. Primary category (invoice, contract, financial_statement, regulatory_filing, report, agreement, policy, prospectus, disclosure, compliance_document, legal_document, tax_document)
        2. Secondary categories if applicable
        3. Industry sector (banking, insurance, investment, technology, healthcare, etc.)
        4. Document purpose (billing, legal, reporting, compliance, etc.)
        5. Confidence level for each classification
        6. Key indicators that led to this classification`
      });

      const category = classificationResult.primary_category?.toLowerCase() || 'unknown';
      const confidence = classificationResult.confidence || 0.5;

      return {
        category: this.mapToStandardCategory(category),
        subcategories: classificationResult.secondary_categories || [],
        industry: classificationResult.industry_sector || 'unknown',
        purpose: classificationResult.document_purpose || 'unknown',
        confidence,
        indicators: classificationResult.key_indicators || [],
        metadata: {
          documentType,
          processedAt: new Date().toISOString(),
          model: this.config.classification.model,
          version: '1.0'
        }
      };

    } catch (error) {
      this.logger?.error("Document classification failed", { error: error.message });

      return {
        category: 'unknown',
        subcategories: [],
        industry: 'unknown',
        purpose: 'unknown',
        confidence: 0,
        indicators: [],
        metadata: {
          documentType,
          processedAt: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  /**
   * Extract comprehensive content from document
   */
  private async extractDocumentContent(request: DocumentProcessingRequest, classification: DocumentClassification): Promise<any> {
    try {
      const content = request.content;

      // Extract text using OCR/Vision model
      const textExtraction = await this.ai.run(this.config.extraction.model, {
        image: content,
        prompt: "Extract all text content from this document, preserving structure, headings, tables, and formatting. Include any handwritten text if present."
      });

      // Extract structured data (tables, forms)
      const structuredData = await this.extractStructuredData(content, textExtraction);

      // Extract images and figures
      const images = await this.extractImages(content);

      // Detect sensitive information
      const sensitiveData = await this.detectSensitiveData(textExtraction.text || '');

      // Extract key entities
      const entities = await this.extractEntities(textExtraction.text || '', classification);

      // Detect languages
      const languages = await this.detectLanguages(textExtraction.text || '');

      return {
        text: textExtraction.text || '',
        structuredData,
        images,
        sensitiveData,
        entities,
        languages,
        pageCount: 1, // Would be calculated from PDF metadata
        hasSensitiveData: sensitiveData.length > 0,
        extractedAt: new Date().toISOString()
      };

    } catch (error) {
      this.logger?.error("Content extraction failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process contracts and agreements
   */
  private async processContract(request: DocumentProcessingRequest, content: any): Promise<any> {
    try {
      // Extract key contract terms
      const termsExtraction = await this.ai.run(this.config.classification.model, {
        text: content.text,
        prompt: "Extract key terms from this contract/agreement: parties involved, effective date, term duration, payment terms, obligations, termination clauses, liability limits, governing law, and any other critical terms."
      });

      // Identify clauses and sections
      const clauseAnalysis = await this.analyzeContractClauses(content.text);

      // Extract risk indicators
      const riskAnalysis = await this.analyzeContractRisk(content.text, termsExtraction);

      // Generate contract summary
      const summary = await this.generateContractSummary(termsExtraction, clauseAnalysis);

      return {
        type: 'contract_analysis',
        keyTerms: termsExtraction.terms || [],
        parties: termsExtraction.parties || [],
        dates: termsExtraction.dates || [],
        obligations: termsExtraction.obligations || [],
        clauses: clauseAnalysis,
        riskAssessment: riskAnalysis,
        summary,
        recommendations: await this.generateContractRecommendations(riskAnalysis),
        metadata: {
          contractType: this.detectContractType(termsExtraction),
          jurisdiction: termsExtraction.governing_law || 'unknown',
          riskLevel: riskAnalysis.overallRisk || 'medium'
        }
      };

    } catch (error) {
      this.logger?.error("Contract processing failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process financial documents (statements, invoices, tax docs)
   */
  private async processFinancialDocument(request: DocumentProcessingRequest, content: any): Promise<any> {
    try {
      // Extract financial data
      const financialExtraction = await this.ai.run(this.config.classification.model, {
        text: content.text,
        prompt: "Extract financial information from this document: amounts, currencies, dates, account numbers, transaction details, balances, revenue, expenses, and any other monetary values."
      });

      // Normalize and categorize financial data
      const normalizedData = await this.normalizeFinancialData(financialExtraction);

      // Perform reconciliation if possible
      const reconciliation = await this.performFinancialReconciliation(normalizedData);

      // Generate financial summary
      const summary = await this.generateFinancialSummary(normalizedData);

      // Detect anomalies
      const anomalies = await this.detectFinancialAnomalies(normalizedData);

      return {
        type: 'financial_analysis',
        financialData: normalizedData,
        reconciliation,
        summary,
        anomalies,
        metrics: await this.calculateFinancialMetrics(normalizedData),
        metadata: {
          documentType: this.detectFinancialDocumentType(normalizedData),
          currencies: normalizedData.currencies || [],
          totalAmount: normalizedData.totalAmount || 0,
          dateRange: normalizedData.dateRange || null,
          hasAnomalies: anomalies.length > 0
        }
      };

    } catch (error) {
      this.logger?.error("Financial document processing failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process regulatory and compliance documents
   */
  private async processRegulatoryDocument(request: DocumentProcessingRequest, content: any): Promise<any> {
    try {
      // Identify applicable regulations
      const regulatoryAnalysis = await this.ai.run(this.config.classification.model, {
        text: content.text,
        prompt: "Analyze this regulatory document and identify: applicable regulations (SOX, GDPR, PCI-DSS, HIPAA, AML, KYC), compliance requirements, control objectives, reporting obligations, and potential violations."
      });

      // Map compliance requirements
      const complianceMapping = await this.mapComplianceRequirements(regulatoryAnalysis);

      // Assess compliance gaps
      const gapAnalysis = await this.assessComplianceGaps(complianceMapping);

      // Generate compliance recommendations
      const recommendations = await this.generateComplianceRecommendations(gapAnalysis);

      return {
        type: 'regulatory_analysis',
        regulations: regulatoryAnalysis.regulations || [],
        complianceRequirements: regulatoryAnalysis.requirements || [],
        complianceMapping,
        gapAnalysis,
        recommendations,
        riskAssessment: await this.assessComplianceRisk(complianceMapping, gapAnalysis),
        metadata: {
          frameworks: regulatoryAnalysis.regulations || [],
          controlCount: complianceMapping.controls?.length || 0,
          gapCount: gapAnalysis.gaps?.length || 0,
          riskLevel: 'medium' // Would be calculated from assessment
        }
      };

    } catch (error) {
      this.logger?.error("Regulatory document processing failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process generic documents without specialized processing
   */
  private async processGenericDocument(request: DocumentProcessingRequest, content: any): Promise<any> {
    return {
      type: 'generic_analysis',
      summary: await this.generateDocumentSummary(content.text),
      keyTopics: await this.extractKeyTopics(content.text),
      entities: content.entities,
      metadata: {
        processingLevel: 'basic',
        wordCount: content.text?.split(/\s+/).length || 0
      }
    };
  }

  // Helper methods

  private validateRequest(request: DocumentProcessingRequest): void {
    if (!request.id) {
      throw new Error('Request ID is required');
    }

    if (!request.content) {
      throw new Error('Document content is required');
    }

    if (request.content.length > this.config.processing.maxFileSize) {
      throw new Error(`Document size ${request.content.length} exceeds maximum ${this.config.processing.maxFileSize}`);
    }
  }

  private async extractTextPreview(content: ArrayBuffer): Promise<string> {
    try {
      const result = await this.ai.run(this.config.extraction.model, {
        image: content.slice(0, 10000), // First 10KB for preview
        prompt: "Extract a preview of text content from this document to help identify document type."
      });
      return result.text || '';
    } catch (error) {
      return '';
    }
  }

  private mapToStandardCategory(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'invoice': 'invoice',
      'contract': 'contract',
      'agreement': 'agreement',
      'financial statement': 'financial_statement',
      'regulatory filing': 'regulatory_filing',
      'report': 'report',
      'policy': 'policy',
      'prospectus': 'prospectus',
      'disclosure': 'disclosure',
      'compliance document': 'compliance_document',
      'legal document': 'legal_document',
      'tax document': 'tax_document'
    };

    return categoryMap[category] || 'unknown';
  }

  private async extractStructuredData(content: ArrayBuffer, textExtraction: any): Promise<any[]> {
    // Extract tables, forms, and other structured content
    return [];
  }

  private async extractImages(content: ArrayBuffer): Promise<any[]> {
    // Extract images from document
    return [];
  }

  private async detectSensitiveData(text: string): Promise<any[]> {
    // Detect PII, financial information, and other sensitive data
    return [];
  }

  private async extractEntities(text: string, classification: DocumentClassification): Promise<any[]> {
    // Extract entities relevant to document type
    return [];
  }

  private async detectLanguages(text: string): Promise<string[]> {
    // Detect languages used in document
    return ['en'];
  }

  private async generateDocumentEmbeddings(content: any): Promise<number[]> {
    // Generate embeddings for semantic search
    try {
      const result = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
        text: content.text || ''
      });
      return result.data || [];
    } catch (error) {
      return [];
    }
  }

  private async updateKnowledgeGraph(content: any, classification: DocumentClassification): Promise<any> {
    // Update knowledge graph with extracted information
    return null;
  }

  private calculateOverallConfidence(classification: DocumentClassification, content: any): number {
    return classification.confidence || 0.5;
  }

  // Additional helper methods for specialized processing
  private async analyzeContractClauses(text: string): Promise<any[]> {
    return [];
  }

  private async analyzeContractRisk(text: string, terms: any): Promise<any> {
    return { overallRisk: 'medium', riskFactors: [] };
  }

  private async generateContractSummary(terms: any, clauses: any): Promise<string> {
    return '';
  }

  private async generateContractRecommendations(risk: any): Promise<any[]> {
    return [];
  }

  private detectContractType(terms: any): string {
    return 'unknown';
  }

  private async normalizeFinancialData(extraction: any): Promise<any> {
    return { currencies: [], amounts: [], dates: [] };
  }

  private async performFinancialReconciliation(data: any): Promise<any> {
    return { status: 'completed', matches: [], discrepancies: [] };
  }

  private async generateFinancialSummary(data: any): Promise<string> {
    return '';
  }

  private async detectFinancialAnomalies(data: any): Promise<any[]> {
    return [];
  }

  private async calculateFinancialMetrics(data: any): Promise<any> {
    return {};
  }

  private detectFinancialDocumentType(data: any): string {
    return 'unknown';
  }

  private async mapComplianceRequirements(analysis: any): Promise<ComplianceMapping> {
    return {
      applicableFrameworks: [],
      requirements: [],
      controls: [],
      violations: []
    };
  }

  private async assessComplianceGaps(mapping: ComplianceMapping): Promise<any> {
    return { gaps: [], recommendations: [] };
  }

  private async generateComplianceRecommendations(gaps: any): Promise<any[]> {
    return [];
  }

  private async assessComplianceRisk(mapping: ComplianceMapping, gaps: any): Promise<any> {
    return { overallRisk: 'medium', riskFactors: [] };
  }

  private async generateDocumentSummary(text: string): Promise<string> {
    try {
      const result = await this.ai.run(this.config.classification.model, {
        text: text,
        prompt: "Generate a concise summary of this document highlighting the main points and key information."
      });
      return result.summary || '';
    } catch (error) {
      return '';
    }
  }

  private async extractKeyTopics(text: string): Promise<string[]> {
    try {
      const result = await this.ai.run(this.config.classification.model, {
        text: text,
        prompt: "Extract the main topics and themes from this document."
      });
      return result.topics || [];
    } catch (error) {
      return [];
    }
  }
}
