/**
 * Vector Database Service
 * Abstraction layer for multiple vector database providers
 */

import {
  VectorDatabase,
  Document,
  VectorQuery,
  SearchResult,
  IndexOptions,
  SearchOptions,
  IndexStats,
  IndexInfo,
  FilterExpression
} from '../interfaces';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export class VectorDatabaseService extends EventEmitter implements VectorDatabase {
  private provider: VectorDatabase;
  private config: any;
  private isConnected = false;
  private connectionRetries = 0;
  private maxRetries = 3;
  private reconnectDelay = 1000;

  constructor(provider: VectorDatabase, config: any) {
    super();
    this.provider = provider;
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      logger.info('Connecting to vector database...', { provider: this.config.provider });
      await this.provider.connect();
      this.isConnected = true;
      this.connectionRetries = 0;
      this.emit('connected');
      logger.info('Successfully connected to vector database');
    } catch (error) {
      this.connectionRetries++;
      logger.error(`Failed to connect to vector database (attempt ${this.connectionRetries}/${this.maxRetries}):`, error);

      if (this.connectionRetries < this.maxRetries) {
        logger.info(`Retrying connection in ${this.reconnectDelay}ms...`);
        await this.delay(this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Exponential backoff, max 30s
        return this.connect();
      } else {
        this.emit('error', error);
        throw new Error(`Failed to connect to vector database after ${this.maxRetries} attempts: ${error}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      logger.info('Disconnecting from vector database...');
      await this.provider.disconnect();
      this.isConnected = false;
      this.emit('disconnected');
      logger.info('Successfully disconnected from vector database');
    } catch (error) {
      logger.error('Error disconnecting from vector database:', error);
      throw error;
    }
  }

  async createIndex(indexName: string, dimension: number, options: IndexOptions = {}): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      logger.info('Creating vector index...', { indexName, dimension, options });
      await this.provider.createIndex(indexName, dimension, options);
      this.emit('indexCreated', { indexName, dimension, options });
      logger.info(`Successfully created index: ${indexName}`);
    } catch (error) {
      logger.error(`Failed to create index ${indexName}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async indexDocuments(indexName: string, documents: Document[]): Promise<string[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      logger.info(`Indexing ${documents.length} documents in index: ${indexName}`);

      // Validate documents
      this.validateDocuments(documents);

      // Add timestamps if not present
      const enrichedDocuments = documents.map(doc => ({
        ...doc,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }));

      const documentIds = await this.provider.indexDocuments(indexName, enrichedDocuments);

      this.emit('documentsIndexed', {
        indexName,
        count: documents.length,
        documentIds
      });

      logger.info(`Successfully indexed ${documents.length} documents in index: ${indexName}`);
      return documentIds;
    } catch (error) {
      logger.error(`Failed to index documents in index ${indexName}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async search(indexName: string, query: VectorQuery, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const startTime = Date.now();
      logger.debug('Performing vector search...', { indexName, query, options });

      // Validate query
      this.validateQuery(query);

      let results = await this.provider.search(indexName, query, options);

      // Apply reranking if requested
      if (options.rerank && results.length > 1) {
        results = await this.rerankResults(query, results);
      }

      // Apply result expansion if requested
      if (options.expandResults && results.length > 0) {
        results = await this.expandResults(indexName, query, results);
      }

      // Add scores and ranking
      results = results.map((result, index) => ({
        ...result,
        rank: index + 1,
        relevanceScore: this.calculateRelevanceScore(result, query),
      }));

      const searchTime = Date.now() - startTime;

      this.emit('searchCompleted', {
        indexName,
        query,
        resultCount: results.length,
        searchTime
      });

      logger.debug(`Search completed in ${searchTime}ms, found ${results.length} results`);
      return results;
    } catch (error: any) {
      logger.error(`Failed to search in index ${indexName}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async get(indexName: string, documentId: string): Promise<Document | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      return await this.provider.get(indexName, documentId);
    } catch (error) {
      logger.error(`Failed to get document ${documentId} from index ${indexName}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      logger.info(`Deleting document from index ${indexName}: ${documentId}`);
      await this.provider.deleteDocument(indexName, documentId);
      this.emit('documentDeleted', { indexName, documentId });
      logger.info(`Successfully deleted document: ${documentId}`);
    } catch (error) {
      logger.error(`Failed to delete document ${documentId} from index ${indexName}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async updateDocument(indexName: string, document: Document): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      logger.info(`Updating document in index ${indexName}: ${document.id}`);

      // Validate document
      this.validateDocuments([document]);

      // Add updated timestamp
      const updatedDocument = {
        ...document,
        updatedAt: new Date(),
      };

      await this.provider.updateDocument(indexName, updatedDocument);
      this.emit('documentUpdated', { indexName, documentId: document.id });
      logger.info(`Successfully updated document: ${document.id}`);
    } catch (error) {
      logger.error(`Failed to update document ${document.id} in index ${indexName}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async getIndexStats(indexName: string): Promise<IndexStats> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      return await this.provider.getIndexStats(indexName);
    } catch (error) {
      logger.error(`Failed to get stats for index ${indexName}:`, error);
      throw error;
    }
  }

  async listIndices(): Promise<IndexInfo[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      return await this.provider.listIndices();
    } catch (error) {
      logger.error('Failed to list indices:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      if (!this.isConnected) {
        return { status: 'unhealthy', details: { reason: 'Not connected' } };
      }

      // Try to list indices as a basic health check
      const indices = await this.listIndices();
      const stats = await Promise.all(
        indices.map(index => this.getIndexStats(index.name))
      );

      const totalDocuments = stats.reduce((sum, stat) => sum + stat.documentCount, 0);

      return {
        status: 'healthy',
        details: {
          indicesCount: indices.length,
          totalDocuments,
          provider: this.config.provider,
          connectionRetries: this.connectionRetries,
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: { error: error.message || String(error) }
      };
    }
  }

  private validateDocuments(documents: Document[]): void {
    for (const doc of documents) {
      if (!doc.id) {
        throw new Error('Document must have an ID');
      }
      if (!doc.content || typeof doc.content !== 'string') {
        throw new Error('Document must have valid content');
      }
      if (!doc.metadata || !doc.metadata.source) {
        throw new Error('Document must have metadata with source');
      }
    }
  }

  private validateQuery(query: VectorQuery): void {
    if (!query.vector && !query.text) {
      throw new Error('Query must have either vector or text');
    }
    if (query.vector && !Array.isArray(query.vector)) {
      throw new Error('Query vector must be an array');
    }
    if (query.topK && (typeof query.topK !== 'number' || query.topK <= 0)) {
      throw new Error('topK must be a positive number');
    }
  }

  private async rerankResults(query: VectorQuery, results: SearchResult[]): Promise<SearchResult[]> {
    // Simple reranking based on multiple factors
    return results
      .map(result => ({
        ...result,
        combinedScore: this.calculateCombinedScore(result, query),
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .map(result => ({
        ...result,
        score: result.combinedScore,
      }));
  }

  private calculateCombinedScore(result: SearchResult, query: VectorQuery): number {
    let score = result.score || 0;

    // Boost recent documents
    const daysSinceCreation = (Date.now() - new Date(result.document.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 1 - daysSinceCreation / 365); // Decay over a year
    score *= (1 + recencyBoost * 0.2);

    // Boost frequently accessed documents
    if (result.document.metadata.accessCount) {
      const accessBoost = Math.min(result.document.metadata.accessCount / 100, 1);
      score *= (1 + accessBoost * 0.1);
    }

    // Boost based on source preference (if configured)
    const preferredSources = this.config.preferredSources || [];
    if (preferredSources.includes(result.document.metadata.source)) {
      score *= 1.2;
    }

    return score;
  }

  private async expandResults(
    indexName: string,
    query: VectorQuery,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // Find similar documents to top results
    const topResults = results.slice(0, 3);
    const expandedResults: SearchResult[] = [...results];

    for (const result of topResults) {
      try {
        const similarQuery: VectorQuery = {
          vector: result.document.embedding,
          topK: 5,
          filter: {
            operator: 'NOT',
            conditions: [{
              field: 'id',
              operator: 'eq',
              value: result.document.id,
            }],
          },
        };

        const similarDocs = await this.provider.search(indexName, similarQuery, {
          includeMetadata: true,
        });

        // Add new results that aren't already in our results
        for (const similarDoc of similarDocs) {
          if (!expandedResults.find(r => r.document.id === similarDoc.document.id)) {
            expandedResults.push({
              ...similarDoc,
              score: similarDoc.score * 0.5, // Lower score for expanded results
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to expand results:', error);
      }
    }

    // Sort and limit final results
    return expandedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, (query.topK || 10) * 2);
  }

  private calculateRelevanceScore(result: SearchResult, query: VectorQuery): number {
    // Normalize score to 0-1 range
    const normalizedScore = Math.max(0, Math.min(1, (result.score || 0) / 100));

    // Apply additional relevance factors
    let relevanceScore = normalizedScore;

    // Content length relevance
    const contentLength = result.document.content.length;
    if (contentLength > 0) {
      // Optimal content length between 100-1000 characters
      const lengthScore = Math.max(0, Math.min(1, 1 - Math.abs(contentLength - 500) / 500));
      relevanceScore = relevanceScore * 0.9 + lengthScore * 0.1;
    }

    return relevanceScore;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
