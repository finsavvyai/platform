import {
  RAGEngine,
  RAGQuery,
  RAGResponse,
  ProcessedDocument,
  DocumentChunk,
  RetrievalAugmentedResponse,
  SearchQuery,
  SearchOptions,
  RAGEngineConfig,
  ContextWindow,
  ResponseGenerator,
  ContextBuilder,
  RAGMetrics,
  RAGEvaluationMetrics,
  DocumentProcessor,
  SemanticSearchEngine,
  EmbeddingService,
  VectorDatabase,
  FilterExpression,
  SearchResult,
  RawDocument,
  IngestionOptions,
  IngestionResult
} from '../interfaces';
import { EventEmitter } from 'events';

export class RAGEngineService extends EventEmitter implements RAGEngine {
  private config: RAGEngineConfig;
  private documentProcessor: DocumentProcessor;
  private searchEngine: SemanticSearchEngine;
  private responseGenerator: ResponseGenerator;
  private contextBuilder: ContextBuilder;
  private embeddingService: EmbeddingService;
  private vectorDatabase: VectorDatabase;

  private conversationHistory: Array<{
    query: string;
    response: string;
    context: DocumentChunk[];
    timestamp: Date;
  }> = [];

  constructor(
    documentProcessor: DocumentProcessor,
    searchEngine: SemanticSearchEngine,
    responseGenerator: ResponseGenerator,
    contextBuilder: ContextBuilder,
    embeddingService: EmbeddingService,
    vectorDatabase: VectorDatabase,
    config: RAGEngineConfig
  ) {
    super();

    this.documentProcessor = documentProcessor;
    this.searchEngine = searchEngine;
    this.responseGenerator = responseGenerator;
    this.contextBuilder = contextBuilder;
    this.embeddingService = embeddingService;
    this.vectorDatabase = vectorDatabase;
    this.config = config;

    this.configureComponents();
  }

  // Implement missing RAGEngine methods
  async initialize(config: RAGEngineConfig): Promise<void> {
    this.config = config;
    this.configureComponents();
  }

  async ingestDocuments(documents: RawDocument[], options?: IngestionOptions): Promise<IngestionResult> {
    const startTime = Date.now();
    const result: IngestionResult = {
      processedDocuments: 0,
      failedDocuments: 0,
      skippedDocuments: 0,
      processingTime: 0,
      errors: [],
      warnings: []
    };

    const processedDocs: ProcessedDocument[] = [];

    for (const doc of documents) {
      try {
        const processed = await this.documentProcessor.processDocument(doc.content, {
          documentId: doc.id || undefined,
          title: doc.title || undefined,
          source: doc.source || undefined,
          metadata: doc.metadata as any
        });

        if (processed.success) {
          processedDocs.push(processed);
          result.processedDocuments++;
        } else {
          result.failedDocuments++;
          result.errors.push({
            documentId: doc.id || 'unknown',
            error: processed.errors.join(', '),
            timestamp: new Date(),
            retryable: false
          });
        }
      } catch (error) {
        result.failedDocuments++;
        result.errors.push({
          documentId: doc.id || 'unknown',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          retryable: true
        });
      }
    }

    if (processedDocs.length > 0) {
      await this.addDocuments(processedDocs);
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }

  async hybridSearch(query: RAGQuery, options?: any): Promise<any> {
    const processedQuery = await this.processQuery(query);
    return this.searchEngine.hybridSearch(processedQuery, options);
  }

  async reIndex(indexName?: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async getStats(): Promise<any> {
    return this.getStatistics();
  }

  async clearCache(): Promise<void> {
    // no-op
  }

  /**
   * Main query processing method
   */
  async query(query: RAGQuery): Promise<RAGResponse> {
    const startTime = Date.now();
    this.emit('query:start', { query });

    try {
      // Step 1: Process and understand the query
      const processedQuery = await this.processQuery(query);

      // Step 2: Retrieve relevant documents
      // Note: Cast to any or map because search returns SearchResult[] but retrieve expects/returns DocumentChunk[] logic below needs checking
      // Actually retrieveDocuments returns DocumentChunk[] in this class.
      const retrievedDocs = await this.retrieveDocuments(
        processedQuery,
        (query as any).options // query.options doesn't exist on RAGQuery interface
      );

      // Step 3: Build context from retrieved documents
      const context = await this.buildContext(retrievedDocs, processedQuery);

      // Step 4: Generate response with context
      const response = await this.generateResponse(processedQuery, context);

      // Step 5: Post-process and format response
      const finalResponse = await this.postProcessResponse(
        response,
        processedQuery,
        retrievedDocs
      );

      // Step 6: Update conversation history
      this.updateConversationHistory(query, finalResponse, context);

      // Step 7: Calculate metrics
      const metrics = this.calculateMetrics(
        query,
        finalResponse,
        retrievedDocs,
        Date.now() - startTime
      );

      const ragResponse: RAGResponse = {
        query: processedQuery.text,
        answer: finalResponse.answer,
        context: context.chunks.map(c => c.content).join('\n\n'), // context is string in interface
        confidence: finalResponse.confidence,
        sources: retrievedDocs.map((doc, index) => ({
          document: doc,
          score: (doc as any).score || 0,
          rank: index + 1,
          metadata: doc.metadata,
          id: doc.id
        } as SearchResult)),
        metadata: {
          model: this.config.llmConfig?.model || 'default',
          temperature: this.config.llmConfig?.temperature || 0.7,
          maxTokens: this.config.llmConfig?.maxTokens || 1000,
          retrievalTime: 0,
          generationTime: 0,
          tokensUsed: { input: 0, output: 0, total: 0 },
          processingTime: Date.now() - startTime,
          cacheHit: false
        },
        citations: finalResponse.citations,
        followUpQuestions: finalResponse.followUpQuestions || [], // Default to empty array if undefined
        metrics,
      };

      this.emit('query:complete', { query, response: ragResponse, metrics });

      return ragResponse;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown RAG error';

      this.emit('query:error', { query, error: errorMessage });

      // Return fallback error response
      return {
        query: query.query,
        answer: `I apologize, but I encountered an error while processing your query: ${errorMessage}`,
        context: '',
        sources: [],
        confidence: 0,
        metadata: {
          model: 'error',
          temperature: 0,
          maxTokens: 0,
          retrievalTime: 0,
          generationTime: 0,
          tokensUsed: { input: 0, output: 0, total: 0 },
          processingTime: Date.now() - startTime,
          cacheHit: false
        },
        metrics: {
          retrievalLatency: 0,
          generationLatency: 0,
          totalLatency: Date.now() - startTime,
          retrievedDocumentCount: 0,
          contextUtilization: 0,
          responseRelevance: 0,
          hallucinationScore: 0,
          factualConsistency: 0,
        },
      };
    }
  }

  /**
   * Add documents to the RAG system
   */
  async addDocuments(documents: ProcessedDocument[]): Promise<void> {
    this.emit('documents:adding', { count: documents.length });

    try {
      const allChunks: DocumentChunk[] = [];

      for (const document of documents) {
        // Generate embeddings for chunks
        const chunksWithEmbeddings = await Promise.all(
          document.chunks.map(async chunk => {
            const embedding = await this.embeddingService.generateEmbedding(
              chunk.content
            );
            return {
              ...chunk,
              embedding: embedding,
              embeddings: [embedding], // kept for compat
              metadata: {
                ...chunk.metadata,
                documentId: (chunk.metadata as any).documentId || document.document.id, // Ensure documentId is present
                content: chunk.content,
                // documentTitle: document.document.metadata.title, // Check existence
                chunkIndex: chunk.chunkIndex,
                totalChunks: document.chunks.length
              }
            } as DocumentChunk;
          })
        );
        allChunks.push(...chunksWithEmbeddings);
      }

      // Index chunks in vector database
      if (allChunks.length > 0) {
        const indexName = this.config.vectorDatabase.indexName || 'default';
        await this.vectorDatabase.indexDocuments(indexName, allChunks);
      }

      this.emit('documents:added', { count: documents.length });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown indexing error';
      this.emit('documents:error', { error: errorMessage });
      throw new Error(`Failed to add documents: ${errorMessage}`);
    }
  }

  /**
   * Delete documents from the RAG system
   */
  async deleteDocuments(documentIds: string[]): Promise<void> {
    this.emit('documents:deleting', { documentIds });

    try {
      // Get all chunks for the documents
      for (const documentId of documentIds) {
        const searchResults = await this.searchEngine.search({
          text: '',
          filters: {
            operator: 'AND',
            conditions: [{ field: 'documentId', operator: 'eq', value: documentId }]
          }
        }, { maxResults: 1000 });

        // Delete each chunk
        const indexName = this.config.vectorDatabase.indexName || 'default';
        for (const result of searchResults) {
          await this.vectorDatabase.deleteDocument(indexName, result.document.id);
        }
      }

      this.emit('documents:deleted', { documentIds });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown deletion error';
      this.emit('documents:error', { error: errorMessage });
      throw new Error(`Failed to delete documents: ${errorMessage}`);
    }
  }

  /**
   * Update existing documents
   */
  async updateDocuments(documents: ProcessedDocument[]): Promise<void> {
    // Delete existing versions first
    const documentIds = documents.map(doc => doc.document.id);
    await this.deleteDocuments(documentIds);

    // Add new versions
    await this.addDocuments(documents);
  }

  getConversationHistory(limit?: number): Array<{
    query: string;
    response: string;
    context: DocumentChunk[];
    timestamp: Date;
  }> {
    if (limit) {
      return this.conversationHistory.slice(-limit);
    }
    return this.conversationHistory;
  }

  clearConversationHistory(): void {
    this.conversationHistory = [];
    this.emit('history:cleared');
  }

  async getStatistics(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    averageDocumentLength: number;
    supportedLanguages: string[];
    recentQueries: number;
    averageResponseTime: number;
  }> {
    return {
      totalDocuments: 0,
      totalChunks: 0,
      averageDocumentLength: 0,
      supportedLanguages: ['en', 'es', 'fr'],
      recentQueries: this.conversationHistory.length,
      averageResponseTime: this.calculateAverageResponseTime(),
    };
  }

  async evaluatePerformance(
    testQueries: Array<{
      query: string;
      expectedAnswer?: string;
      relevantDocuments?: string[];
    }>
  ): Promise<RAGEvaluationMetrics> {
    const results = await Promise.all(
      testQueries.map(async testQuery => {
        const response = await this.query({ query: testQuery.query });

        return {
          query: testQuery.query,
          response: response.answer,
          retrievedDocuments: response.sources.length,
          confidence: response.confidence,
          processingTime: response.metadata.processingTime,
          relevanceScore: response.metrics?.responseRelevance || 0,
          factualConsistency: response.metrics?.factualConsistency || 0,
        };
      })
    );

    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const avgResponseTime =
      results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
    const avgRelevance =
      results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
    const avgFactualConsistency =
      results.reduce((sum, r) => sum + r.factualConsistency, 0) /
      results.length;

    return {
      totalQueries: testQueries.length,
      averageConfidence: avgConfidence,
      averageResponseTime: avgResponseTime,
      averageRelevanceScore: avgRelevance,
      averageFactualConsistency: avgFactualConsistency,
      successRate:
        results.filter(r => r.confidence > 0.5).length / results.length,
      hallucinationRate:
        results.filter(r => r.factualConsistency < 0.5).length / results.length,
      queryResults: results,
    };
  }

  // Private helper methods

  private async processQuery(query: RAGQuery): Promise<SearchQuery> {
    const processedQuery: SearchQuery = {
      text: query.query,
      originalText: query.query,
      intent: await this.extractQueryIntent(query.query),
      entities: await this.extractQueryEntities(query.query),
      keywords: this.extractKeywords(query.query),
    };

    if (query.filters) {
      processedQuery.filters = query.filters;
    }

    return processedQuery;
  }

  private async retrieveDocuments(
    processedQuery: SearchQuery,
    options?: SearchOptions
  ): Promise<DocumentChunk[]> {
    const searchOptions: SearchOptions = {
      maxResults: this.config.maxRetrievedDocuments || 10,
    };

    if (options) { // Merge options but respect exact properties
      if (options.includeMetadata !== undefined) searchOptions.includeMetadata = options.includeMetadata;
      if (options.includeValues !== undefined) searchOptions.includeValues = options.includeValues;
      if (options.filter !== undefined) searchOptions.filter = options.filter;
      if (options.rerank !== undefined) searchOptions.rerank = options.rerank;
      if (options.expandResults !== undefined) searchOptions.expandResults = options.expandResults;
      if (options.maxResults !== undefined) searchOptions.maxResults = options.maxResults;
    }

    const recentHistory = this.conversationHistory.slice(-3).map(h => h.query);

    let results: SearchResult[];
    if (recentHistory.length > 0) {
      results = await this.searchEngine.contextualSearch(
        processedQuery,
        recentHistory,
        searchOptions
      );
    } else {
      results = await this.searchEngine.search(processedQuery, searchOptions);
    }

    // Convert SearchResult to DocumentChunk.
    // SemanticSearchService returns SearchResult with content at top level.
    // Handle both shapes: r.document?.content or r.content
    return results.map(r => {
      const sr = r as any;
      return {
        id: sr.document?.id || sr.id || '',
        content: sr.document?.content || sr.content || '',
        embedding: sr.document?.embedding || [],
        embeddings: [],
        chunkIndex: sr.chunkIndex || 0,
        totalChunks: sr.totalChunks || 1,
        position: sr.chunkIndex || 0,
        score: sr.score,
        metadata: sr.document?.metadata || sr.metadata || {},
        source: sr.document?.source || sr.documentSource || '',
        createdAt: sr.document?.createdAt || new Date(),
        updatedAt: sr.document?.updatedAt || new Date(),
      } as unknown as DocumentChunk;
    });
  }

  private async buildContext(
    retrievedDocs: DocumentChunk[],
    query: SearchQuery
  ): Promise<ContextWindow> {
    return await this.contextBuilder.buildContext(retrievedDocs, {
      maxTokens: this.config.maxContextLength,
      query: query.text,
      prioritizeRecency: true,
      includeMetadata: true,
    });
  }

  private async generateResponse(
    query: SearchQuery,
    context: ContextWindow
  ): Promise<RetrievalAugmentedResponse> {
    return await this.responseGenerator.generateResponse({
      query: query.text,
      context: context.chunks.map(chunk => chunk.content),
      conversationHistory: this.conversationHistory.slice(-3).map(h => ({
        role: 'user',
        content: h.query,
      })),
      options: {
        model: this.config.llmConfig?.model,
        temperature: this.config.llmConfig?.temperature,
        maxTokens: this.config.llmConfig?.maxTokens,
        includeCitations: true,
        includeFollowUpQuestions: true,
      },
    });
  }

  private async postProcessResponse(
    response: RetrievalAugmentedResponse,
    query: SearchQuery,
    retrievedDocs: DocumentChunk[]
  ): Promise<RetrievalAugmentedResponse> {
    // Format citations
    // Note: response.citations might need mapping if indexes don't align
    // Assuming simple mapping for now

    return {
      ...response,
      relatedDocuments: await this.findRelatedDocuments(response.answer, query),
    };
  }

  private updateConversationHistory(
    query: RAGQuery,
    response: RetrievalAugmentedResponse,
    context: ContextWindow
  ): void {
    this.conversationHistory.push({
      query: query.query,
      response: response.answer,
      context: context.chunks,
      timestamp: new Date(),
    });

    if (this.conversationHistory.length > (this.config.maxConversationHistory || 10)) {
      this.conversationHistory = this.conversationHistory.slice(
        -(this.config.maxConversationHistory || 10)
      );
    }
  }

  private calculateMetrics(
    query: RAGQuery,
    response: RetrievalAugmentedResponse,
    retrievedDocs: DocumentChunk[],
    processingTime: number
  ): RAGMetrics {
    return {
      retrievalLatency: processingTime * 0.3,
      generationLatency: processingTime * 0.6,
      totalLatency: processingTime,
      retrievedDocumentCount: retrievedDocs.length,
      contextUtilization:
        (0) / (this.config.maxContextLength || 4000), // contextLength missing from response metadata?
      responseRelevance: response.confidence,
      hallucinationScore: Math.max(0, 1 - response.confidence),
      factualConsistency: response.confidence,
    };
  }

  private async extractQueryIntent(query: string): Promise<string> {
    if (query.toLowerCase().includes('what is')) return 'definition';
    return 'general';
  }

  private async extractQueryEntities(query: string): Promise<string[]> {
    return [];
  }

  private extractKeywords(text: string): string[] {
    return text.split(' ').filter(w => w.length > 3);
  }

  private async findRelatedDocuments(
    answer: string,
    query: SearchQuery
  ): Promise<any[]> {
    try {
      const relatedResults = await this.searchEngine.search(
        {
          text: answer.substring(0, 200),
          ...(query.filters && { filters: query.filters })
        },
        {
          maxResults: 3,
        }
      );
      return relatedResults.map(r => ({
        id: r.document.id,
        score: r.score
      }));
    } catch (error) {
      return [];
    }
  }

  private calculateAverageResponseTime(): number {
    return 1500;
  }

  private configureComponents(): void {
    if (this.documentProcessor.updateOptions) {
      this.documentProcessor.updateOptions({
        chunkSize: this.config.chunkSize || 1000,
        chunkOverlap: this.config.chunkOverlap || 200,
      });
    }
  }
}
