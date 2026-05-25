/**
 * FinSavvy AI Suite - Knowledge Base Management
 *
 * Revolutionary knowledge base system with AI-powered document indexing,
 * intelligent categorization, and automated regulatory compliance tracking.
 */

import { VectorEmbeddingService, DocumentMetadata } from './vector-service';
import { Logger } from '../utils/logger';
import { DatabaseService } from '../services/database-service';

export interface KnowledgeCategory {
  id: string;
  name: string;
  description: string;
  parent_id?: string;
  level: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  document_count: number;
  tags: string[];
}

export interface RegulationRule {
  id: string;
  title: string;
  description: string;
  regulation_type: 'KYC' | 'AML' | 'GDPR' | 'SOX' | 'PCI_DSS' | 'HIPAA' | 'OTHER';
  jurisdiction: string;
  effective_date: string;
  last_updated: string;
  compliance_level: 'mandatory' | 'recommended' | 'optional';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requirements: string[];
  penalties: string[];
  document_references: string[];
  tags: string[];
  status: 'active' | 'deprecated' | 'draft';
}

export interface ComplianceMapping {
  id: string;
  document_id: string;
  regulation_id: string;
  compliance_score: number;
  relevant_sections: Array<{
    section: string;
    relevance_score: number;
    excerpt: string;
  }>;
  assessment_date: string;
  assessor: string;
  notes: string;
  next_review_date: string;
}

export interface KnowledgeQuery {
  query: string;
  filters?: {
    categories?: string[];
    regulations?: string[];
    jurisdictions?: string[];
    compliance_levels?: string[];
    risk_levels?: string[];
    date_range?: { start: string; end: string };
  };
  include_regulations?: boolean;
  include_compliance_assessments?: boolean;
  limit?: number;
}

export interface KnowledgeResponse {
  query: string;
  results: Array<{
    type: 'document' | 'regulation' | 'compliance_mapping';
    item: any;
    relevance_score: number;
    excerpts: string[];
  }>;
  total_found: number;
  search_time: number;
  categories: Array<{
    name: string;
    count: number;
  }>;
  regulations: Array<{
    type: string;
    jurisdiction: string;
    count: number;
  }>;
  summary: string;
  recommendations: string[];
}

export class KnowledgeBaseService {
  private logger: Logger;
  private dbService: DatabaseService;
  private vectorService: VectorEmbeddingService;
  private aiService: any;

  constructor(env: any) {
    this.logger = new Logger(env, 'KnowledgeBase');
    this.dbService = new DatabaseService(env);
    this.vectorService = new VectorEmbeddingService(env);
    this.aiService = env.AI;
  }

  /**
   * Initialize knowledge base with default categories and regulations
   */
  public async initializeKnowledgeBase(): Promise<void> {
    this.logger.info('Initializing knowledge base...');

    try {
      // Create knowledge base tables
      await this.createKnowledgeBaseTables();

      // Load default categories
      await this.loadDefaultCategories();

      // Load financial regulations
      await this.loadFinancialRegulations();

      // Create indexes
      await this.createKnowledgeBaseIndexes();

      this.logger.info('Knowledge base initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize knowledge base', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create knowledge base database tables
   */
  private async createKnowledgeBaseTables(): Promise<void> {
    const tables = [
      // Knowledge categories
      `CREATE TABLE IF NOT EXISTS knowledge_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_id TEXT,
        level INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        document_count INTEGER DEFAULT 0,
        tags TEXT,
        FOREIGN KEY (parent_id) REFERENCES knowledge_categories(id)
      )`,

      // Financial regulations
      `CREATE TABLE IF NOT EXISTS financial_regulations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        regulation_type TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        compliance_level TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        requirements TEXT,
        penalties TEXT,
        document_references TEXT,
        tags TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // Compliance mappings
      `CREATE TABLE IF NOT EXISTS compliance_mappings (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        regulation_id TEXT NOT NULL,
        compliance_score REAL NOT NULL,
        relevant_sections TEXT,
        assessment_date TEXT NOT NULL,
        assessor TEXT,
        notes TEXT,
        next_review_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id),
        FOREIGN KEY (regulation_id) REFERENCES financial_regulations(id)
      )`,

      // Knowledge graph relationships
      `CREATE TABLE IF NOT EXISTS knowledge_relationships (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        strength REAL DEFAULT 1.0,
        metadata TEXT,
        created_at TEXT NOT NULL
      )`,

      // Learning data for AI improvements
      `CREATE TABLE IF NOT EXISTS knowledge_learning (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        clicked_documents TEXT,
        user_feedback INTEGER,
        session_id TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT
      )`
    ];

    for (const tableSql of tables) {
      await this.dbService.query(tableSql);
    }
  }

  /**
   * Load default knowledge categories
   */
  private async loadDefaultCategories(): Promise<void> {
    const defaultCategories = [
      {
        name: 'Banking & Payments',
        description: 'Banking regulations, payment processing, and financial transaction rules',
        level: 0,
        tags: ['banking', 'payments', 'transactions']
      },
      {
        name: 'KYC & Identity Verification',
        description: 'Know Your Customer procedures and identity verification requirements',
        level: 1,
        tags: ['kyc', 'identity', 'verification']
      },
      {
        name: 'AML & Financial Crime',
        description: 'Anti-Money Laundering regulations and financial crime prevention',
        level: 1,
        tags: ['aml', 'financial-crime', 'prevention']
      },
      {
        name: 'Data Privacy & Security',
        description: 'Data protection regulations and cybersecurity requirements',
        level: 0,
        tags: ['privacy', 'security', 'data-protection']
      },
      {
        name: 'Consumer Protection',
        description: 'Consumer rights and protection regulations',
        level: 0,
        tags: ['consumer', 'protection', 'rights']
      },
      {
        name: 'Reporting & Compliance',
        description: 'Regulatory reporting requirements and compliance procedures',
        level: 0,
        tags: ['reporting', 'compliance', 'procedures']
      }
    ];

    for (const category of defaultCategories) {
      const categoryId = crypto.randomUUID();
      const now = new Date().toISOString();

      await this.dbService.query(`
        INSERT OR REPLACE INTO knowledge_categories (
          id, name, description, level, metadata, created_at, updated_at, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        categoryId,
        category.name,
        category.description,
        category.level,
        JSON.stringify({ source: 'system', auto_generated: true }),
        now,
        now,
        JSON.stringify(category.tags)
      ]);
    }

    this.logger.info('Default categories loaded', { count: defaultCategories.length });
  }

  /**
   * Load essential financial regulations
   */
  private async loadFinancialRegulations(): Promise<void> {
    const regulations = [
      // KYC/AML Regulations
      {
        title: 'Bank Secrecy Act (BSA)',
        description: 'U.S. law requiring financial institutions to assist government agencies in detecting and preventing money laundering',
        regulation_type: 'AML',
        jurisdiction: 'US',
        effective_date: '1970-10-26',
        last_updated: '2024-01-15',
        compliance_level: 'mandatory',
        risk_level: 'HIGH',
        requirements: [
          'Customer Identification Program (CIP)',
          'Customer Due Diligence (CDD)',
          'Suspicious Activity Reporting (SAR)',
          'Currency Transaction Reporting (CTR)'
        ],
        penalties: [
          'Civil penalties up to $1 million per violation',
          'Criminal penalties including imprisonment',
          'Loss of banking charter'
        ],
        tags: ['bsa', 'aml', 'customer-identification', 'suspicious-activity']
      },
      {
        title: 'USA PATRIOT Act',
        description: 'Uniting and Strengthening America by Providing Appropriate Tools Required to Intercept and Obstruct Terrorism',
        regulation_type: 'AML',
        jurisdiction: 'US',
        effective_date: '2001-10-26',
        last_updated: '2024-01-15',
        compliance_level: 'mandatory',
        risk_level: 'CRITICAL',
        requirements: [
          'Enhanced due diligence for high-risk customers',
          'Information sharing between financial institutions',
          'Customer identification procedures'
        ],
        penalties: [
          'Severe civil and criminal penalties',
          'Regulatory enforcement actions',
          'Reputational damage'
        ],
        tags: ['patriot-act', 'terrorism', 'enhanced-due-diligence']
      },
      {
        title: 'EU Fourth Anti-Money Laundering Directive',
        description: 'European Union directive on prevention of money laundering and terrorist financing',
        regulation_type: 'AML',
        jurisdiction: 'EU',
        effective_date: '2017-06-26',
        last_updated: '2024-01-15',
        compliance_level: 'mandatory',
        risk_level: 'HIGH',
        requirements: [
          'Risk-based approach to AML/CFT',
          'Ultimate beneficial owner transparency',
          'Politically exposed persons (PEP) screening'
        ],
        penalties: [
          'Fines up to €5 million or 10% of annual turnover',
          'Criminal liability for individuals',
          'Loss of operating license'
        ],
        tags: ['eu-aml4', 'beneficial-owner', 'pep-screening']
      },
      {
        title: 'GDPR',
        description: 'General Data Protection Regulation - EU data protection and privacy law',
        regulation_type: 'GDPR',
        jurisdiction: 'EU',
        effective_date: '2018-05-25',
        last_updated: '2024-01-15',
        compliance_level: 'mandatory',
        risk_level: 'CRITICAL',
        requirements: [
          'Lawful basis for data processing',
          'Data subject rights',
          'Data protection impact assessments',
          'Breach notification within 72 hours'
        ],
        penalties: [
          'Fines up to €20 million or 4% of global annual turnover',
          'Compensation claims from data subjects',
          'Regulatory investigations'
        ],
        tags: ['gdpr', 'data-protection', 'privacy', 'eu']
      },
      {
        title: 'PCI DSS',
        description: 'Payment Card Industry Data Security Standard',
        regulation_type: 'PCI_DSS',
        jurisdiction: 'Global',
        effective_date: '2006-01-01',
        last_updated: '2024-01-15',
        compliance_level: 'mandatory',
        risk_level: 'HIGH',
        requirements: [
          'Install and maintain firewall configuration',
          'Do not use vendor-supplied defaults',
          'Protect stored cardholder data',
          'Encrypt transmission of cardholder data'
        ],
        penalties: [
          'Monthly fines from card brands',
          'Increased transaction fees',
          'Loss of ability to process card payments'
        ],
        tags: ['pci-dss', 'payment-security', 'cardholder-data']
      }
    ];

    for (const regulation of regulations) {
      const regulationId = crypto.randomUUID();
      const now = new Date().toISOString();

      await this.dbService.query(`
        INSERT OR REPLACE INTO financial_regulations (
          id, title, description, regulation_type, jurisdiction,
          effective_date, last_updated, compliance_level, risk_level,
          requirements, penalties, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        regulationId,
        regulation.title,
        regulation.description,
        regulation.regulation_type,
        regulation.jurisdiction,
        regulation.effective_date,
        regulation.last_updated,
        regulation.compliance_level,
        regulation.risk_level,
        JSON.stringify(regulation.requirements),
        JSON.stringify(regulation.penalties),
        JSON.stringify(regulation.tags),
        now,
        now
      ]);
    }

    this.logger.info('Financial regulations loaded', { count: regulations.length });
  }

  /**
   * Create indexes for knowledge base
   */
  private async createKnowledgeBaseIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_categories_parent ON knowledge_categories(parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_regulations_type ON financial_regulations(regulation_type)',
      'CREATE INDEX IF NOT EXISTS idx_regulations_jurisdiction ON financial_regulations(jurisdiction)',
      'CREATE INDEX IF NOT EXISTS idx_compliance_document ON compliance_mappings(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_compliance_regulation ON compliance_mappings(regulation_id)',
      'CREATE INDEX IF NOT EXISTS idx_relationships_source ON knowledge_relationships(source_id)',
      'CREATE INDEX IF NOT EXISTS idx_relationships_target ON knowledge_relationships(target_id)',
      'CREATE INDEX IF NOT EXISTS idx_learning_timestamp ON knowledge_learning(timestamp)'
    ];

    for (const indexSql of indexes) {
      await this.dbService.query(indexSql);
    }
  }

  /**
   * Add document to knowledge base with automatic categorization
   */
  public async addDocument(
    content: string,
    metadata: Partial<DocumentMetadata>
  ): Promise<{ documentId: string; categoryId?: string; regulationIds: string[] }> {
    this.logger.info('Adding document to knowledge base', {
      title: metadata.title,
      type: metadata.type
    });

    try {
      // Store document in vector service
      const documentId = await this.vectorService.storeDocument(content, metadata);

      // Auto-categorize document using AI
      const categoryId = await this.autoCategorizeDocument(documentId, content, metadata);

      // Identify relevant regulations
      const regulationIds = await this.identifyRelevantRegulations(documentId, content, metadata);

      // Create compliance mappings
      for (const regulationId of regulationIds) {
        await this.createComplianceMapping(documentId, regulationId, content);
      }

      // Update category document count
      if (categoryId) {
        await this.updateCategoryDocumentCount(categoryId);
      }

      this.logger.info('Document added to knowledge base successfully', {
        documentId,
        categoryId,
        regulationCount: regulationIds.length
      });

      return {
        documentId,
        categoryId,
        regulationIds
      };
    } catch (error) {
      this.logger.error('Failed to add document to knowledge base', {
        error: error.message,
        title: metadata.title
      });
      throw error;
    }
  }

  /**
   * Automatically categorize document using AI
   */
  private async autoCategorizeDocument(
    documentId: string,
    content: string,
    metadata: Partial<DocumentMetadata>
  ): Promise<string | undefined> {
    try {
      // Get available categories
      const categoriesResult = await this.dbService.query(
        'SELECT * FROM knowledge_categories ORDER BY level, name'
      );
      const categories = categoriesResult.results;

      if (categories.length === 0) return undefined;

      // Prepare AI prompt for categorization
      const categoryList = categories.map(cat =>
        `${cat.name}: ${cat.description}`
      ).join('\n');

      const prompt = `
Analyze the following document and assign it to the most appropriate category:

Document Title: ${metadata.title || 'Untitled'}
Document Type: ${metadata.type || 'Unknown'}
Content Preview: ${content.substring(0, 1000)}...

Available Categories:
${categoryList}

Return only the category name that best matches this document content.
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 50,
        temperature: 0.3
      });

      const suggestedCategory = response.response.trim();

      // Find matching category
      const matchedCategory = categories.find(cat =>
        cat.name.toLowerCase().includes(suggestedCategory.toLowerCase()) ||
        suggestedCategory.toLowerCase().includes(cat.name.toLowerCase())
      );

      if (matchedCategory) {
        // Create relationship between document and category
        await this.dbService.query(`
          INSERT INTO knowledge_relationships (
            id, source_id, target_id, relationship_type, strength, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(),
          documentId,
          matchedCategory.id,
          'belongs_to_category',
          1.0,
          new Date().toISOString()
        ]);

        this.logger.info('Document auto-categorized', {
          documentId,
          category: matchedCategory.name,
          categoryId: matchedCategory.id
        });

        return matchedCategory.id;
      }

      return undefined;
    } catch (error) {
      this.logger.warn('Auto-categorization failed', {
        documentId,
        error: error.message
      });
      return undefined;
    }
  }

  /**
   * Identify relevant regulations for a document
   */
  private async identifyRelevantRegulations(
    documentId: string,
    content: string,
    metadata: Partial<DocumentMetadata>
  ): Promise<string[]> {
    try {
      // Get all regulations
      const regulationsResult = await this.dbService.query(
        'SELECT * FROM financial_regulations WHERE status = "active"'
      );
      const regulations = regulationsResult.results;

      if (regulations.length === 0) return [];

      // Use vector search to find similar regulations
      const relevantRegulations = [];
      const contentPreview = content.substring(0, 2000);

      for (const regulation of regulations) {
        const regulationText = `
          ${regulation.title}
          ${regulation.description}
          Requirements: ${regulation.requirements}
        `;

        // Simple similarity check (can be enhanced with embeddings)
        const similarity = this.calculateTextSimilarity(contentPreview, regulationText);

        if (similarity > 0.3) { // Threshold for relevance
          relevantRegulations.push({
            regulationId: regulation.id,
            score: similarity
          });
        }
      }

      // Sort by relevance score and return top IDs
      const regulationIds = relevantRegulations
        .sort((a, b) => b.score - a.score)
        .slice(0, 5) // Top 5 regulations
        .map(r => r.regulationId);

      this.logger.info('Relevant regulations identified', {
        documentId,
        regulationCount: regulationIds.length
      });

      return regulationIds;
    } catch (error) {
      this.logger.warn('Failed to identify relevant regulations', {
        documentId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Create compliance mapping between document and regulation
   */
  private async createComplianceMapping(
    documentId: string,
    regulationId: string,
    content: string
  ): Promise<void> {
    try {
      // Calculate compliance score using AI
      const complianceScore = await this.calculateComplianceScore(content, regulationId);

      // Identify relevant sections
      const relevantSections = await this.identifyRelevantSections(content, regulationId);

      const mappingId = crypto.randomUUID();
      const now = new Date().toISOString();
      const nextReview = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

      await this.dbService.query(`
        INSERT INTO compliance_mappings (
          id, document_id, regulation_id, compliance_score,
          relevant_sections, assessment_date, assessor,
          notes, next_review_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        mappingId,
        documentId,
        regulationId,
        complianceScore,
        JSON.stringify(relevantSections),
        now,
        'AI-Assistant',
        `Automatically generated compliance assessment with score ${complianceScore}`,
        nextReview,
        now,
        now
      ]);

      this.logger.debug('Compliance mapping created', {
        documentId,
        regulationId,
        complianceScore
      });
    } catch (error) {
      this.logger.warn('Failed to create compliance mapping', {
        documentId,
        regulationId,
        error: error.message
      });
    }
  }

  /**
   * Calculate compliance score using AI
   */
  private async calculateComplianceScore(content: string, regulationId: string): Promise<number> {
    try {
      // Get regulation details
      const regulationResult = await this.dbService.query(
        'SELECT * FROM financial_regulations WHERE id = ?',
        [regulationId]
      );

      if (regulationResult.results.length === 0) return 0.5; // Default score

      const regulation = regulationResult.results[0];

      const prompt = `
Analyze the following document content against the regulation requirements and provide a compliance score from 0.0 to 1.0:

Regulation: ${regulation.title}
Requirements: ${regulation.requirements}

Document Content:
${content.substring(0, 1500)}...

Provide only a numerical score between 0.0 and 1.0 where:
- 0.0 = Not compliant at all
- 0.5 = Partially compliant
- 1.0 = Fully compliant

Score:
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 10,
        temperature: 0.1
      });

      const score = parseFloat(response.response.trim());
      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    } catch (error) {
      this.logger.warn('Failed to calculate compliance score', {
        regulationId,
        error: error.message
      });
      return 0.5; // Default score
    }
  }

  /**
   * Identify relevant sections of document for regulation
   */
  private async identifyRelevantSections(content: string, regulationId: string): Promise<Array<{
    section: string;
    relevance_score: number;
    excerpt: string
  }>> {
    try {
      // Get regulation details
      const regulationResult = await this.dbService.query(
        'SELECT * FROM financial_regulations WHERE id = ?',
        [regulationId]
      );

      if (regulationResult.results.length === 0) return [];

      const regulation = regulationResult.results[0];
      const requirements = regulation.requirements;

      const relevantSections = [];

      // Split content into paragraphs
      const paragraphs = content.split(/\n\s*\n/);

      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        if (paragraph.length < 50) continue; // Skip short paragraphs

        // Calculate relevance score for this paragraph
        let relevanceScore = 0;
        for (const requirement of requirements) {
          const keywords = requirement.toLowerCase().split(/\s+/);
          const paragraphLower = paragraph.toLowerCase();
          const matches = keywords.filter(keyword => paragraphLower.includes(keyword));
          relevanceScore += matches.length / keywords.length;
        }

        relevanceScore = relevanceScore / requirements.length;

        if (relevanceScore > 0.3) {
          relevantSections.push({
            section: `Paragraph ${i + 1}`,
            relevance_score: Math.min(relevanceScore, 1.0),
            excerpt: paragraph.substring(0, 200) + (paragraph.length > 200 ? '...' : '')
          });
        }
      }

      // Sort by relevance score and return top sections
      return relevantSections
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, 5);
    } catch (error) {
      this.logger.warn('Failed to identify relevant sections', {
        regulationId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Search knowledge base with AI-enhanced results
   */
  public async searchKnowledgeBase(query: KnowledgeQuery): Promise<KnowledgeResponse> {
    const startTime = Date.now();
    this.logger.info('Searching knowledge base', {
      query: query.query.substring(0, 100),
      includeRegulations: query.include_regulations,
      includeCompliance: query.include_compliance_assessments
    });

    try {
      const allResults: Array<{
        type: 'document' | 'regulation' | 'compliance_mapping';
        item: any;
        relevance_score: number;
        excerpts: string[];
      }> = [];

      // Search documents using vector service
      if (!query.filters?.categories || query.filters.categories.length > 0) {
        const ragQuery = {
          query: query.query,
          filters: query.filters,
          limit: query.limit || 20,
          include_highlights: true,
          include_metadata: true
        };

        const documentResults = await this.vectorService.searchSimilar(ragQuery);

        for (const result of documentResults.results) {
          allResults.push({
            type: 'document',
            item: result.document,
            relevance_score: result.score,
            excerpts: result.highlights
          });
        }
      }

      // Search regulations
      if (query.include_regulations !== false) {
        const regulationResults = await this.searchRegulations(query);

        for (const result of regulationResults) {
          allResults.push({
            type: 'regulation',
            item: result.regulation,
            relevance_score: result.score,
            excerpts: result.excerpts
          });
        }
      }

      // Search compliance mappings
      if (query.include_compliance_assessments === true) {
        const complianceResults = await this.searchComplianceMappings(query);

        for (const result of complianceResults) {
          allResults.push({
            type: 'compliance_mapping',
            item: result.mapping,
            relevance_score: result.score,
            excerpts: result.excerpts
          });
        }
      }

      // Sort all results by relevance score
      allResults.sort((a, b) => b.relevance_score - a.relevance_score);

      // Limit results
      const limitedResults = allResults.slice(0, query.limit || 20);

      // Generate analytics
      const categories = this.analyzeCategories(limitedResults);
      const regulations = this.analyzeRegulations(limitedResults);

      // Generate AI summary
      const summary = await this.generateSearchSummary(query.query, limitedResults);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(query.query, limitedResults);

      const searchTime = Date.now() - startTime;

      const response: KnowledgeResponse = {
        query: query.query,
        results: limitedResults,
        total_found: allResults.length,
        search_time: searchTime,
        categories,
        regulations,
        summary,
        recommendations
      };

      this.logger.info('Knowledge base search completed', {
        query: query.query.substring(0, 100),
        resultsCount: limitedResults.length,
        searchTime
      });

      // Log search for learning
      await this.logSearchQuery(query, limitedResults);

      return response;
    } catch (error) {
      this.logger.error('Knowledge base search failed', {
        query: query.query.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search regulations
   */
  private async searchRegulations(query: KnowledgeQuery): Promise<Array<{
    regulation: any;
    score: number;
    excerpts: string[];
  }>> {
    try {
      let sql = `
        SELECT * FROM financial_regulations
        WHERE status = 'active'
      `;
      const params: any[] = [];

      // Add filters
      if (query.filters?.regulations?.length) {
        sql += ` AND regulation_type IN (${query.filters.regulations.map(() => '?').join(',')})`;
        params.push(...query.filters.regulations);
      }

      if (query.filters?.jurisdictions?.length) {
        sql += ` AND jurisdiction IN (${query.filters.jurisdictions.map(() => '?').join(',')})`;
        params.push(...query.filters.jurisdictions);
      }

      if (query.filters?.compliance_levels?.length) {
        sql += ` AND compliance_level IN (${query.filters.compliance_levels.map(() => '?').join(',')})`;
        params.push(...query.filters.compliance_levels);
      }

      const regulationsResult = await this.dbService.query(sql, params);
      const regulations = regulationsResult.results;

      const results = [];
      const queryLower = query.query.toLowerCase();

      for (const regulation of regulations) {
        // Calculate relevance score
        let score = 0;
        const searchText = `
          ${regulation.title} ${regulation.description} ${regulation.requirements}
        `.toLowerCase();

        // Simple keyword matching
        const queryWords = queryLower.split(/\s+/);
        const matches = queryWords.filter(word => searchText.includes(word));
        score = matches.length / queryWords.length;

        if (score > 0.2) {
          // Generate excerpts
          const excerpts = this.generateRegulationExcerpts(regulation, queryWords);

          results.push({
            regulation,
            score: Math.min(score, 1.0),
            excerpts
          });
        }
      }

      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.warn('Failed to search regulations', { error: error.message });
      return [];
    }
  }

  /**
   * Search compliance mappings
   */
  private async searchComplianceMappings(query: KnowledgeQuery): Promise<Array<{
    mapping: any;
    score: number;
    excerpts: string[];
  }>> {
    try {
      const sql = `
        SELECT cm.*, d.title as document_title, fr.title as regulation_title
        FROM compliance_mappings cm
        JOIN documents d ON cm.document_id = d.id
        JOIN financial_regulations fr ON cm.regulation_id = fr.id
        WHERE cm.compliance_score >= 0.5
      `;

      const mappingsResult = await this.dbService.query(sql);
      const mappings = mappingsResult.results;

      const results = [];
      const queryLower = query.query.toLowerCase();

      for (const mapping of mappings) {
        // Calculate relevance score based on notes and document/regulation titles
        let score = 0;
        const searchText = `
          ${mapping.document_title} ${mapping.regulation_title} ${mapping.notes}
        `.toLowerCase();

        const queryWords = queryLower.split(/\s+/);
        const matches = queryWords.filter(word => searchText.includes(word));
        score = matches.length / queryWords.length;

        if (score > 0.1) {
          const excerpts = [
            mapping.notes || '',
            `Compliance Score: ${mapping.compliance_score}`,
            `Document: ${mapping.document_title}`,
            `Regulation: ${mapping.regulation_title}`
          ].filter(excerpt => excerpt.length > 0);

          results.push({
            mapping,
            score: Math.min(score, 1.0),
            excerpts
          });
        }
      }

      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.warn('Failed to search compliance mappings', { error: error.message });
      return [];
    }
  }

  /**
   * Generate regulation excerpts
   */
  private generateRegulationExcerpts(regulation: any, queryWords: string[]): string[] {
    const excerpts = [];
    const maxExcerpts = 3;

    // Check title
    const titleLower = regulation.title.toLowerCase();
    if (queryWords.some(word => titleLower.includes(word))) {
      excerpts.push(regulation.title);
    }

    // Check description
    const descLower = regulation.description.toLowerCase();
    if (excerpts.length < maxExcerpts && queryWords.some(word => descLower.includes(word))) {
      excerpts.push(regulation.description.substring(0, 200) + '...');
    }

    // Check requirements
    if (excerpts.length < maxExcerpts && regulation.requirements) {
      for (const requirement of regulation.requirements) {
        if (excerpts.length >= maxExcerpts) break;
        const reqLower = requirement.toLowerCase();
        if (queryWords.some(word => reqLower.includes(word))) {
          excerpts.push(requirement);
        }
      }
    }

    return excerpts;
  }

  /**
   * Analyze categories in search results
   */
  private analyzeCategories(results: any[]): Array<{ name: string; count: number }> {
    const categoryCount: Record<string, number> = {};

    for (const result of results) {
      if (result.type === 'document' && result.item.metadata?.document_category) {
        const category = result.item.metadata.document_category;
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      }
    }

    return Object.entries(categoryCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Analyze regulations in search results
   */
  private analyzeRegulations(results: any[]): Array<{
    type: string;
    jurisdiction: string;
    count: number;
  }> {
    const regulationCount: Record<string, { type: string; jurisdiction: string; count: number }> = {};

    for (const result of results) {
      if (result.type === 'regulation') {
        const key = `${result.item.regulation_type}-${result.item.jurisdiction}`;
        if (!regulationCount[key]) {
          regulationCount[key] = {
            type: result.item.regulation_type,
            jurisdiction: result.item.jurisdiction,
            count: 0
          };
        }
        regulationCount[key].count++;
      }
    }

    return Object.values(regulationCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Generate AI search summary
   */
  private async generateSearchSummary(
    query: string,
    results: any[]
  ): Promise<string> {
    if (results.length === 0) {
      return 'No relevant information found in the knowledge base.';
    }

    try {
      const topResults = results.slice(0, 5);
      const summaryText = topResults.map(result => {
        if (result.type === 'document') {
          return result.item.content.substring(0, 200);
        } else if (result.type === 'regulation') {
          return `${result.item.title}: ${result.item.description}`;
        } else {
          return result.item.notes || '';
        }
      }).join('\n\n');

      const prompt = `
Based on the following search results, provide a brief summary that answers the user's query: "${query}"

Search Results:
${summaryText}

Provide a concise summary that directly addresses the query.
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 150,
        temperature: 0.3
      });

      return response.response.trim();
    } catch (error) {
      this.logger.warn('Failed to generate search summary', { error: error.message });
      return 'Summary generation failed.';
    }
  }

  /**
   * Generate AI recommendations
   */
  private async generateRecommendations(
    query: string,
    results: any[]
  ): Promise<string[]> {
    try {
      const topResults = results.slice(0, 3);
      const contextText = topResults.map(result => {
        if (result.type === 'document') {
          return result.item.content.substring(0, 300);
        } else if (result.type === 'regulation') {
          return `${result.item.title}: ${result.item.description}`;
        } else {
          return result.item.notes || '';
        }
      }).join('\n\n');

      const prompt = `
Based on the query "${query}" and the following context, suggest 3 actionable recommendations or next steps:

Context:
${contextText}

Provide 3 recommendations, one per line, without numbering.
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 150,
        temperature: 0.5
      });

      return response.response
        .split('\n')
        .map(rec => rec.trim())
        .filter(rec => rec.length > 0)
        .slice(0, 3);
    } catch (error) {
      this.logger.warn('Failed to generate recommendations', { error: error.message });
      return [];
    }
  }

  /**
   * Log search query for learning
   */
  private async logSearchQuery(query: KnowledgeQuery, results: any[]): Promise<void> {
    try {
      const sessionId = crypto.randomUUID(); // In real implementation, this would come from user session

      await this.dbService.query(`
        INSERT INTO knowledge_learning (
          id, query, clicked_documents, user_feedback, session_id, timestamp, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(),
        query.query,
        JSON.stringify(results.slice(0, 5).map(r => r.item.id)),
        null, // User feedback to be collected later
        sessionId,
        new Date().toISOString(),
        JSON.stringify({ filters: query.filters, resultCount: results.length })
      ]);
    } catch (error) {
      this.logger.warn('Failed to log search query', { error: error.message });
    }
  }

  /**
   * Update category document count
   */
  private async updateCategoryDocumentCount(categoryId: string): Promise<void> {
    try {
      // Count documents in this category
      const countResult = await this.dbService.query(`
        SELECT COUNT(*) as count
        FROM knowledge_relationships kr
        JOIN document_chunks dc ON kr.source_id = dc.id
        WHERE kr.target_id = ? AND kr.relationship_type = 'belongs_to_category'
      `, [categoryId]);

      const count = countResult.results[0]?.count || 0;

      await this.dbService.query(`
        UPDATE knowledge_categories
        SET document_count = ?, updated_at = ?
        WHERE id = ?
      `, [count, new Date().toISOString(), categoryId]);
    } catch (error) {
      this.logger.warn('Failed to update category document count', {
        categoryId,
        error: error.message
      });
    }
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
  }

  /**
   * Get knowledge base statistics
   */
  public async getStatistics(): Promise<{
    totalDocuments: number;
    totalRegulations: number;
    totalComplianceMappings: number;
    categoryBreakdown: Record<string, number>;
    regulationBreakdown: Record<string, number>;
    jurisdictionBreakdown: Record<string, number>;
  }> {
    try {
      // Document stats from vector service
      const vectorStats = await this.vectorService.getStatistics();

      // Regulation stats
      const regulationStats = await this.dbService.query(`
        SELECT regulation_type, COUNT(*) as count
        FROM financial_regulations
        WHERE status = 'active'
        GROUP BY regulation_type
      `);

      // Jurisdiction stats
      const jurisdictionStats = await this.dbService.query(`
        SELECT jurisdiction, COUNT(*) as count
        FROM financial_regulations
        WHERE status = 'active'
        GROUP BY jurisdiction
      `);

      // Compliance mapping stats
      const complianceStats = await this.dbService.query(`
        SELECT COUNT(*) as total_mappings
        FROM compliance_mappings
      `);

      // Category stats
      const categoryStats = await this.dbService.query(`
        SELECT name, document_count
        FROM knowledge_categories
        WHERE document_count > 0
        ORDER BY document_count DESC
      `);

      return {
        totalDocuments: vectorStats.totalDocuments,
        totalRegulations: regulationStats.results.reduce((sum, row) => sum + row.count, 0),
        totalComplianceMappings: complianceStats.results[0]?.total_mappings || 0,
        categoryBreakdown: categoryStats.results.reduce((acc, row) => {
          acc[row.name] = row.document_count;
          return acc;
        }, {}),
        regulationBreakdown: regulationStats.results.reduce((acc, row) => {
          acc[row.regulation_type] = row.count;
          return acc;
        }, {}),
        jurisdictionBreakdown: jurisdictionStats.results.reduce((acc, row) => {
          acc[row.jurisdiction] = row.count;
          return acc;
        }, {})
      };
    } catch (error) {
      this.logger.error('Failed to get knowledge base statistics', {
        error: error.message
      });
      throw error;
    }
  }
}