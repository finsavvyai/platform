/**
 * Pinecone Vector Database Provider
 * Implementation for Pinecone vector database service
 */

import { VectorDatabase, Document, VectorQuery, SearchResult, IndexOptions, SearchOptions, IndexStats, IndexInfo, FilterExpression } from '../interfaces';
import { Pinecone, Index } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger';

export class PineconeProvider implements VectorDatabase {
  private client: Pinecone | null = null;
  private indexes: Map<string, Index> = new Map();
  private apiKey: string;
  private environment: string;

  constructor(apiKey: string, environment: string) {
    this.apiKey = apiKey;
    this.environment = environment;
  }

  async connect(): Promise<void> {
    try {
      this.client = new Pinecone({
        apiKey: this.apiKey,
        // environment is no longer used in new SDK, but keeping prop for compat
      } as any);

      // Test connection by listing indexes
      await this.client.listIndexes();

      logger.info('Successfully connected to Pinecone');
    } catch (error) {
      logger.error('Failed to connect to Pinecone:', error);
      throw new Error(`Pinecone connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.indexes.clear();
    this.client = null;
    logger.info('Disconnected from Pinecone');
  }

  async createIndex(indexName: string, dimension: number, options: IndexOptions = {}): Promise<void> {
    if (!this.client) {
      throw new Error('Pinecone client not connected');
    }

    try {
      await this.client.createIndex({
        name: indexName,
        dimension,
        metric: options.metric || 'cosine',
        spec: {
          pod: {
            pods: options.pods || 1,
            replicas: options.replicas || 1,
            podType: options.podType || 'p1.x1',
            metadataConfig: options.metadataConfig ? {
              indexed: Object.keys(options.metadataConfig),
            } : undefined,
          }
        }
      } as any);

      // Wait for index to be ready
      await this.waitForIndexReady(indexName);

      // Cache the index reference
      const index = this.client.Index(indexName);
      this.indexes.set(indexName, index);

      logger.info(`Successfully created Pinecone index: ${indexName}`);
    } catch (error) {
      logger.error(`Failed to create Pinecone index ${indexName}:`, error);
      throw error;
    }
  }

  async indexDocuments(indexName: string, documents: Document[]): Promise<string[]> {
    const index = this.getIndex(indexName);

    try {
      const pineconeDocs = documents.map(doc => ({
        id: doc.id,
        values: doc.embedding || [],
        metadata: {
          content: doc.content,
          title: doc.metadata.title,
          author: doc.metadata.author,
          source: doc.metadata.source,
          type: doc.metadata.type,
          url: doc.metadata.url,
          tags: doc.metadata.tags || [],
          language: doc.metadata.language,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
          chunkIndex: doc.chunkIndex,
          totalChunks: (doc as any).totalChunks,
          parentDocumentId: doc.parentDocumentId,
          wordCount: doc.metadata.wordCount,
          readingTime: doc.metadata.readingTime,
          difficulty: doc.metadata.difficulty,
          accessCount: doc.metadata.accessCount || 0,
          lastAccessed: doc.metadata.lastAccessed?.toISOString(),
          ...doc.metadata.custom,
        },
      }));

      // Adjust for newer SDK which might expect array or object
      try {
        await index.upsert(pineconeDocs as any);
      } catch (e) {
        // Fallback if SDK expects object with vectors property
        await index.upsert({ vectors: pineconeDocs } as any);
      }

      const documentIds = documents.map(doc => doc.id);
      logger.info(`Successfully indexed ${documents.length} documents in Pinecone index: ${indexName}`);

      return documentIds;
    } catch (error) {
      logger.error(`Failed to index documents in Pinecone index ${indexName}:`, error);
      throw error;
    }
  }

  async search(indexName: string, query: VectorQuery, options: SearchOptions = {}): Promise<SearchResult[]> {
    const index = this.getIndex(indexName);

    try {
      const searchRequest: any = {
        vector: query.vector,
        topK: query.topK || 10,
        includeMetadata: options.includeMetadata !== false,
        includeValues: options.includeValues !== false,
      };

      // Add filter if provided
      if (options.filter || query.filter) {
        searchRequest.filter = this.buildPineconeFilter((options.filter || query.filter)!);
      }

      // Add namespace if needed
      if (options.namespace) {
        searchRequest.namespace = options.namespace;
      }

      const response = await index.query(searchRequest);

      const results: SearchResult[] = response.matches.map((match: any, index: number) => ({
        document: {
          id: match.id,
          content: match.metadata?.content || '',
          metadata: this.extractMetadata(match.metadata),
          embedding: match.values,
          source: match.metadata?.source || 'unknown',
          createdAt: new Date(match.metadata?.createdAt || Date.now()),
          updatedAt: new Date(match.metadata?.updatedAt || Date.now()),
        },
        score: match.score || 0,
        rank: index + 1,
        metadata: match.metadata,
        // Flattened properties
        id: match.id,
        content: match.metadata?.content,
        documentId: match.id,
      }));

      return results;
    } catch (error) {
      logger.error(`Failed to search Pinecone index ${indexName}:`, error);
      throw error;
    }
  }

  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    const index = this.getIndex(indexName);

    try {
      await index.deleteOne(documentId as any);
      logger.info(`Successfully deleted document ${documentId} from Pinecone index: ${indexName}`);
    } catch (error) {
      logger.error(`Failed to delete document ${documentId} from Pinecone index ${indexName}:`, error);
      throw error;
    }
  }

  async updateDocument(indexName: string, document: Document): Promise<void> {
    // Pinecone doesn't have a direct update operation, so we upsert
    await this.indexDocuments(indexName, [document]);
  }

  async get(indexName: string, documentId: string): Promise<Document | null> {
    const index = this.getIndex(indexName);

    try {
      // Correct usage for fetch in new SDK might be ids: []
      const response = await index.fetch([documentId] as any);
      const records = (response as any).records || (response as any).vectors;
      const record = records?.[documentId];

      if (!record) {
        return null;
      }

      return {
        id: record.id,
        content: record.metadata?.content as string || '',
        metadata: this.extractMetadata(record.metadata),
        embedding: record.values,
        source: record.metadata?.source as any || 'unknown',
        createdAt: new Date(record.metadata?.createdAt as string || Date.now()),
        updatedAt: new Date(record.metadata?.updatedAt as string || Date.now()),
      };
    } catch (error) {
      logger.error(`Failed to get document ${documentId} from Pinecone index ${indexName}:`, error);
      return null;
    }
  }

  async getIndexStats(indexName: string): Promise<IndexStats> {
    const index = this.getIndex(indexName);

    try {
      const description = await index.describeIndexStats();

      return {
        documentCount: (description as any).totalRecordCount || (description as any).totalVectorCount || 0,
        vectorCount: (description as any).totalRecordCount || (description as any).totalVectorCount || 0,
        indexSize: (description.dimension || 0) * ((description as any).totalRecordCount || 0) * 4, // Rough estimate
        status: 'ready',
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error(`Failed to get stats for Pinecone index ${indexName}:`, error);
      throw error;
    }
  }

  async listIndices(): Promise<IndexInfo[]> {
    if (!this.client) {
      throw new Error('Pinecone client not connected');
    }

    try {
      const response = await this.client.listIndexes();

      return (response as any).indexes.map((index: any) => ({
        name: index.name,
        dimension: (index as any).dimension || 1536,
        documentCount: (index as any).totalRecordCount || (index as any).vectorCount || 0,
        status: (index.status as any)?.state || index.status || 'ready',
        createdAt: new Date(), // Pinecone doesn't provide creation time
        updatedAt: new Date(),
      }));
    } catch (error) {
      logger.error('Failed to list Pinecone indexes:', error);
      throw error;
    }
  }

  private getIndex(indexName: string): Index {
    let index = this.indexes.get(indexName);

    if (!index) {
      if (!this.client) {
        throw new Error('Pinecone client not connected');
      }

      index = this.client.Index(indexName);
      this.indexes.set(indexName, index);
    }

    return index;
  }

  private async waitForIndexReady(indexName: string, maxWaitTime = 300000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const indexList = await this.client!.listIndexes();
        const index = (indexList as any).indexes?.find((idx: any) => idx.name === indexName);

        if (index && ((index.status as any)?.state === 'Ready' || index.status === 'Ready')) {
          logger.info(`Pinecone index ${indexName} is ready`);
          return;
        }

        await this.delay(5000); // Wait 5 seconds
      } catch (error) {
        logger.warn(`Error checking index status for ${indexName}:`, error);
        await this.delay(5000);
      }
    }

    throw new Error(`Index ${indexName} did not become ready within ${maxWaitTime}ms`);
  }

  private buildPineconeFilter(filter: FilterExpression): any {
    if (!filter) return undefined;

    switch (filter.operator) {
      case 'AND':
        return {
          $and: [
            ...filter.conditions.map(condition => this.buildConditionFilter(condition)),
            ...filter.filters?.map(f => this.buildPineconeFilter(f)) || [],
          ],
        };

      case 'OR':
        return {
          $or: [
            ...filter.conditions.map(condition => this.buildConditionFilter(condition)),
            ...filter.filters?.map(f => this.buildPineconeFilter(f)) || [],
          ],
        };

      case 'NOT':
        return {
          $not: {
            $or: [
              ...filter.conditions.map(condition => this.buildConditionFilter(condition)),
              ...filter.filters?.map(f => this.buildPineconeFilter(f)) || [],
            ],
          },
        };

      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`);
    }
  }

  private buildConditionFilter(condition: any): any {
    const filter: any = {};

    switch (condition.operator) {
      case 'eq':
        filter[condition.field] = condition.value;
        break;
      case 'ne':
        filter[condition.field] = { $ne: condition.value };
        break;
      case 'gt':
        filter[condition.field] = { $gt: condition.value };
        break;
      case 'gte':
        filter[condition.field] = { $gte: condition.value };
        break;
      case 'lt':
        filter[condition.field] = { $lt: condition.value };
        break;
      case 'lte':
        filter[condition.field] = { $lte: condition.value };
        break;
      case 'in':
        filter[condition.field] = { $in: Array.isArray(condition.value) ? condition.value : [condition.value] };
        break;
      case 'nin':
        filter[condition.field] = { $nin: Array.isArray(condition.value) ? condition.value : [condition.value] };
        break;
      case 'contains':
        filter[condition.field] = { $contains: condition.value };
        break;
      case 'regex':
        filter[condition.field] = { $regex: condition.value };
        break;
      default:
        throw new Error(`Unsupported condition operator: ${condition.operator}`);
    }

    return filter;
  }

  private extractMetadata(metadata: any): any {
    if (!metadata) return {};

    return {
      title: metadata.title,
      author: metadata.author,
      source: metadata.source,
      type: metadata.type,
      url: metadata.url,
      tags: metadata.tags,
      language: metadata.language,
      wordCount: metadata.wordCount,
      readingTime: metadata.readingTime,
      difficulty: metadata.difficulty,
      lastAccessed: metadata.lastAccessed ? new Date(metadata.lastAccessed) : undefined,
      custom: this.extractCustomMetadata(metadata),
    };
  }

  private extractCustomMetadata(metadata: any): Record<string, any> {
    const custom: Record<string, any> = {};

    const standardFields = [
      'content', 'title', 'author', 'source', 'type', 'url', 'tags', 'language',
      'wordCount', 'readingTime', 'difficulty', 'createdAt', 'updatedAt', 'chunkIndex',
      'totalChunks', 'parentDocumentId', 'accessCount', 'lastAccessed'
    ];

    for (const [key, value] of Object.entries(metadata)) {
      if (!standardFields.includes(key)) {
        custom[key] = value;
      }
    }

    return custom;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
