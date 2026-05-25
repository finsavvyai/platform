/**
 * FinSavvy AI Suite - Vector Embedding Service
 *
 * Revolutionary RAG (Retrieval-Augmented Generation) system with AI-powered
 * vector embeddings, similarity search, and intelligent knowledge management.
 */

import { VectorizeIndex, WorkersAI } from '@cloudflare/workers-types';
import { Logger } from '../utils/logger';
import { DatabaseService } from '../services/database-service';

export interface VectorEmbedding {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  document_id?: string;
  chunk_id?: string;
  category?: string;
  source?: string;
  confidence?: number;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  type: 'pdf' | 'text' | 'json' | 'csv' | 'xml' | 'html' | 'markdown';
  source: string;
  author?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  category: string;
  compliance_level: 'public' | 'internal' | 'confidential' | 'restricted';
  language: string;
  size: number;
  checksum: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  chunks_count: number;
  embeddings_count: number;
}

export interface SearchResult {
  document: VectorEmbedding;
  score: number;
  metadata: Record<string, any>;
  highlights: string[];
}

export interface RAGQuery {
  query: string;
  filters?: {
    categories?: string[];
    sources?: string[];
    date_range?: { start: string; end: string };
    compliance_levels?: string[];
    tags?: string[];
  };
  limit?: number;
  threshold?: number;
  include_highlights?: boolean;
  include_metadata?: boolean;
}

export interface RAGResponse {
  query: string;
  results: SearchResult[];
  total_found: number;
  search_time: number;
  embeddings_used: number;
  sources: Array<{
    id: string;
    title: string;
    relevance_score: number;
    excerpts: string[];
  }>;
  context_summary: string;
  related_queries: string[];
}

export class VectorEmbeddingService {
  private logger: Logger;
  private dbService: DatabaseService;
  private vectorize: VectorizeIndex;
  private ai: WorkersAI;
  private embeddingModel: string;
  private embeddingDimension: number;

  constructor(
    env: any,
    options: {
      embeddingModel?: string;
      embeddingDimension?: number;
    } = {}
  ) {
    this.logger = new Logger(env, 'VectorEmbedding');
    this.dbService = new DatabaseService(env);
    this.vectorize = env.VECTORIZE_INDEX;
    this.ai = env.AI;
    this.embeddingModel = options.embeddingModel || '@cf/baai/bge-base-en-v1.5';
    this.embeddingDimension = options.embeddingDimension || 768;
  }

  /**
   * Generate vector embeddings for text content
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      this.logger.debug('Generating embedding', { textLength: text.length });

      const response = await this.ai.run(this.embeddingModel, {
        text: text.trim(),
        normalize: true
      });

      const embedding = response.data as number[];

      if (embedding.length !== this.embeddingDimension) {
        throw new Error(`Embedding dimension mismatch: expected ${this.embeddingDimension}, got ${embedding.length}`);
      }

      this.logger.debug('Embedding generated successfully', {
        dimension: embedding.length,
        sample: embedding.slice(0, 3)
      });

      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', {
        error: error.message,
        textLength: text.length
      });
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  public async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const batchSize = 10; // Process in batches to avoid rate limits

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.generateEmbedding(text));

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        this.logger.debug('Batch embeddings completed', {
          batchIndex: Math.floor(i / batchSize),
          batchSize: batch.length,
          totalProcessed: results.length
        });

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < texts.length) {
          await this.delay(100);
        }
      } catch (error) {
        this.logger.error('Batch embedding failed', {
          batchIndex: Math.floor(i / batchSize),
          error: error.message
        });
        throw error;
      }
    }

    return results;
  }

  /**
   * Store document and its embeddings in the system
   */
  public async storeDocument(
    content: string,
    metadata: Partial<DocumentMetadata>
  ): Promise<string> {
    const documentId = metadata.id || this.generateId();
    const now = new Date().toISOString();

    // Create document metadata
    const document: DocumentMetadata = {
      id: documentId,
      title: metadata.title || 'Untitled Document',
      type: metadata.type || 'text',
      source: metadata.source || 'manual',
      author: metadata.author,
      created_at: metadata.created_at || now,
      updated_at: now,
      tags: metadata.tags || [],
      category: metadata.category || 'general',
      compliance_level: metadata.compliance_level || 'internal',
      language: metadata.language || 'en',
      size: content.length,
      checksum: await this.calculateChecksum(content),
      processing_status: 'processing',
      chunks_count: 0,
      embeddings_count: 0
    };

    // Store document metadata
    await this.dbService.query(`
      INSERT OR REPLACE INTO documents (
        id, title, type, source, author, created_at, updated_at,
        tags, category, compliance_level, language, size, checksum,
        processing_status, chunks_count, embeddings_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      document.id,
      document.title,
      document.type,
      document.source,
      document.author,
      document.created_at,
      document.updated_at,
      JSON.stringify(document.tags),
      document.category,
      document.compliance_level,
      document.language,
      document.size,
      document.checksum,
      document.processing_status,
      document.chunks_count,
      document.embeddings_count
    ]);

    // Process content and create embeddings
    await this.processDocumentContent(documentId, content, document);

    return documentId;
  }

  /**
   * Process document content by chunking and creating embeddings
   */
  private async processDocumentContent(
    documentId: string,
    content: string,
    metadata: DocumentMetadata
  ): Promise<void> {
    try {
      // Split content into chunks
      const chunks = await this.chunkContent(content, metadata.type);
      this.logger.info('Document chunked', {
        documentId,
        chunksCount: chunks.length,
        contentLength: content.length
      });

      // Generate embeddings for chunks
      const chunkTexts = chunks.map(chunk => chunk.text);
      const embeddings = await this.generateBatchEmbeddings(chunkTexts);

      // Store chunks and embeddings
      const vectorRecords = [];
      let chunkIndex = 0;

      for (const chunk of chunks) {
        const chunkId = this.generateId();
        const embedding = embeddings[chunkIndex];

        // Store chunk in database
        await this.dbService.query(`
          INSERT INTO document_chunks (
            id, document_id, chunk_index, text, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          chunkId,
          documentId,
          chunkIndex,
          chunk.text,
          JSON.stringify(chunk.metadata || {}),
          new Date().toISOString()
        ]);

        // Prepare vector record for Vectorize
        const vectorRecord: VectorEmbedding = {
          id: chunkId,
          content: chunk.text,
          embedding,
          metadata: {
            document_id: documentId,
            chunk_index: chunkIndex,
            document_title: metadata.title,
            document_category: metadata.category,
            document_source: metadata.source,
            compliance_level: metadata.compliance_level,
            tags: metadata.tags,
            language: metadata.language,
            ...chunk.metadata
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          document_id,
          chunk_id: chunkId,
          category: metadata.category,
          source: metadata.source
        };

        vectorRecords.push(vectorRecord);
        chunkIndex++;
      }

      // Insert vectors into Vectorize in batches
      await this.insertVectors(vectorRecords);

      // Update document status
      await this.dbService.query(`
        UPDATE documents
        SET processing_status = 'completed',
            chunks_count = ?,
            embeddings_count = ?,
            updated_at = ?
        WHERE id = ?
      `, [chunks.length, embeddings.length, new Date().toISOString(), documentId]);

      this.logger.info('Document processing completed', {
        documentId,
        chunksCount: chunks.length,
        embeddingsCount: embeddings.length
      });

    } catch (error) {
      // Update document status to failed
      await this.dbService.query(`
        UPDATE documents
        SET processing_status = 'failed', updated_at = ?
        WHERE id = ?
      `, [new Date().toISOString(), documentId]);

      this.logger.error('Document processing failed', {
        documentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Split content into intelligent chunks
   */
  private async chunkContent(
    content: string,
    type: string
  ): Promise<Array<{ text: string; metadata?: any }>> {
    const maxChunkSize = 1000; // Maximum characters per chunk
    const overlap = 200; // Overlap between chunks to maintain context

    if (type === 'pdf' || type === 'text') {
      // Semantic chunking for text documents
      return this.semanticChunking(content, maxChunkSize, overlap);
    } else if (type === 'json' || type === 'csv') {
      // Structured data chunking
      return this.structuredChunking(content, type);
    } else {
      // Default paragraph-based chunking
      return this.paragraphChunking(content, maxChunkSize, overlap);
    }
  }

  /**
   * Semantic chunking based on sentences and paragraphs
   */
  private semanticChunking(
    content: string,
    maxSize: number,
    overlap: number
  ): Array<{ text: string; metadata?: any }> {
    const chunks: Array<{ text: string; metadata?: any }> = [];

    // Split into paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    let currentChunk = '';
    let currentParagraphs: string[] = [];

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      // If adding this paragraph exceeds max size, create a new chunk
      if (currentChunk.length + trimmedParagraph.length > maxSize && currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: {
            paragraphs_count: currentParagraphs.length,
            chunk_type: 'semantic'
          }
        });

        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + trimmedParagraph;
        currentParagraphs = [trimmedParagraph];
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
        currentParagraphs.push(trimmedParagraph);
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        metadata: {
          paragraphs_count: currentParagraphs.length,
          chunk_type: 'semantic'
        }
      });
    }

    return chunks;
  }

  /**
   * Structured data chunking for JSON/CSV
   */
  private structuredChunking(
    content: string,
    type: string
  ): Array<{ text: string; metadata?: any }> {
    const chunks: Array<{ text: string; metadata?: any }> = [];

    try {
      if (type === 'json') {
        const data = JSON.parse(content);
        const flatData = this.flattenJson(data);

        for (const [key, value] of Object.entries(flatData)) {
          chunks.push({
            text: `${key}: ${JSON.stringify(value)}`,
            metadata: {
              data_type: 'json_field',
              field_path: key,
              chunk_type: 'structured'
            }
          });
        }
      } else if (type === 'csv') {
        const lines = content.split('\n');
        const headers = lines[0]?.split(',') || [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i]?.split(',');
          if (values && values.length === headers.length) {
            const record = headers.map((header, index) =>
              `${header.trim()}: ${values[index]?.trim()}`
            ).join(', ');

            chunks.push({
              text: record,
              metadata: {
                data_type: 'csv_row',
                row_number: i,
                chunk_type: 'structured'
              }
            });
          }
        }
      }
    } catch (error) {
      // Fallback to paragraph chunking
      return this.paragraphChunking(content, 1000, 200);
    }

    return chunks;
  }

  /**
   * Paragraph-based chunking
   */
  private paragraphChunking(
    content: string,
    maxSize: number,
    overlap: number
  ): Array<{ text: string; metadata?: any }> {
    const chunks: Array<{ text: string; metadata?: any }> = [];
    const sentences = content.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if (currentChunk.length + trimmedSentence.length > maxSize && currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: { chunk_type: 'paragraph' }
        });

        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '. ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        metadata: { chunk_type: 'paragraph' }
      });
    }

    return chunks;
  }

  /**
   * Perform semantic search for similar content
   */
  public async searchSimilar(query: RAGQuery): Promise<RAGResponse> {
    const startTime = Date.now();
    this.logger.info('Performing semantic search', {
      query: query.query.substring(0, 100),
      filters: query.filters,
      limit: query.limit || 10
    });

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query.query);

      // Build vector search query with filters
      const vectorQuery = this.buildVectorQuery(queryEmbedding, query);

      // Execute vector search
      const vectorResults = await this.vectorize.query(vectorQuery);

      // Process results and fetch additional data
      const searchResults: SearchResult[] = [];
      const sources = new Map();

      for (let i = 0; i < vectorResults.matches.length; i++) {
        const match = vectorResults.matches[i];
        const vectorId = match.id;

        // Fetch full document data from database
        const documentData = await this.fetchDocumentData(vectorId);

        if (documentData) {
          const searchResult: SearchResult = {
            document: {
              id: vectorId,
              content: documentData.content,
              embedding: [], // Don't return embedding in search results
              metadata: documentData.metadata,
              created_at: documentData.created_at,
              updated_at: documentData.updated_at,
              document_id: documentData.document_id,
              chunk_id: documentData.chunk_id,
              category: documentData.category,
              source: documentData.source,
              confidence: match.score
            },
            score: match.score,
            metadata: documentData.metadata,
            highlights: query.include_highlights
              ? this.generateHighlights(documentData.content, query.query)
              : []
          };

          searchResults.push(searchResult);

          // Track sources for response summary
          if (documentData.document_id) {
            if (!sources.has(documentData.document_id)) {
              sources.set(documentData.document_id, {
                id: documentData.document_id,
                title: documentData.metadata?.document_title || 'Unknown Document',
                relevance_score: match.score,
                excerpts: []
              });
            }
            sources.get(documentData.document_id).excerpts.push(documentData.content);
          }
        }
      }

      // Generate context summary
      const contextSummary = await this.generateContextSummary(
        query.query,
        searchResults.slice(0, 5)
      );

      // Generate related queries
      const relatedQueries = await this.generateRelatedQueries(
        query.query,
        searchResults.slice(0, 3)
      );

      const searchTime = Date.now() - startTime;

      const response: RAGResponse = {
        query: query.query,
        results: searchResults,
        total_found: vectorResults.metadata?.count || searchResults.length,
        search_time: searchTime,
        embeddings_used: 1,
        sources: Array.from(sources.values()),
        context_summary,
        related_queries
      };

      this.logger.info('Semantic search completed', {
        query: query.query.substring(0, 100),
        resultsCount: searchResults.length,
        searchTime,
        averageScore: searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length
      });

      return response;

    } catch (error) {
      this.logger.error('Semantic search failed', {
        query: query.query.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Build vector query with filters
   */
  private buildVectorQuery(queryEmbedding: number[], ragQuery: RAGQuery): any {
    const vectorQuery: any = {
      vector: queryEmbedding,
      topK: ragQuery.limit || 10,
      returnValues: true,
      returnMetadata: true
    };

    // Add filters if provided
    if (ragQuery.filters) {
      const filterConditions: any[] = [];

      if (ragQuery.filters.categories?.length) {
        filterConditions.push({
          key: 'document_category',
          value: ragQuery.filters.categories
        });
      }

      if (ragQuery.filters.sources?.length) {
        filterConditions.push({
          key: 'document_source',
          value: ragQuery.filters.sources
        });
      }

      if (ragQuery.filters.compliance_levels?.length) {
        filterConditions.push({
          key: 'compliance_level',
          value: ragQuery.filters.compliance_levels
        });
      }

      if (ragQuery.filters.tags?.length) {
        filterConditions.push({
          key: 'tags',
          value: ragQuery.filters.tags
        });
      }

      if (filterConditions.length > 0) {
        vectorQuery.filter = {
          must: filterConditions
        };
      }
    }

    return vectorQuery;
  }

  /**
   * Fetch document data from database
   */
  private async fetchDocumentData(vectorId: string): Promise<any> {
    try {
      const result = await this.dbService.query(`
        SELECT
          dc.id,
          dc.text as content,
          dc.metadata,
          dc.created_at,
          dc.updated_at,
          dc.document_id,
          d.title as document_title,
          d.category,
          d.source,
          d.compliance_level
        FROM document_chunks dc
        LEFT JOIN documents d ON dc.document_id = d.id
        WHERE dc.id = ?
      `, [vectorId]);

      return result.results[0] || null;
    } catch (error) {
      this.logger.warn('Failed to fetch document data', {
        vectorId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Generate highlights for search results
   */
  private generateHighlights(content: string, query: string): string[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);
    const highlights: string[] = [];

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const matchedTerms = queryTerms.filter(term => lowerSentence.includes(term));

      if (matchedTerms.length > 0) {
        highlights.push(sentence.trim());
      }

      if (highlights.length >= 3) break; // Limit highlights
    }

    return highlights;
  }

  /**
   * Generate context summary using AI
   */
  private async generateContextSummary(
    query: string,
    searchResults: SearchResult[]
  ): Promise<string> {
    if (searchResults.length === 0) {
      return 'No relevant information found.';
    }

    try {
      const contextTexts = searchResults.map(r => r.document.content).join('\n\n');

      const prompt = `
Based on the following context, provide a brief summary that answers the user's query: "${query}"

Context:
${contextTexts.substring(0, 2000)}...

Provide a concise summary that directly addresses the query.
`;

      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 150,
        temperature: 0.3
      });

      return response.response.trim();
    } catch (error) {
      this.logger.warn('Failed to generate context summary', {
        error: error.message
      });
      return 'Summary generation failed.';
    }
  }

  /**
   * Generate related queries using AI
   */
  private async generateRelatedQueries(
    query: string,
    searchResults: SearchResult[]
  ): Promise<string[]> {
    try {
      const contextTexts = searchResults.map(r => r.document.content).join('\n\n');

      const prompt = `
Based on the query "${query}" and the following context, suggest 3 related questions that the user might find helpful:

Context:
${contextTexts.substring(0, 1000)}...

Provide 3 related questions, one per line, without numbering.
`;

      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 100,
        temperature: 0.5
      });

      return response.response
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0)
        .slice(0, 3);
    } catch (error) {
      this.logger.warn('Failed to generate related queries', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Insert vectors into Vectorize
   */
  private async insertVectors(vectors: VectorEmbedding[]): Promise<void> {
    const batchSize = 100; // Vectorize batch limit

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);

      try {
        const vectorRecords = batch.map(vector => ({
          id: vector.id,
          values: vector.embedding,
          metadata: vector.metadata
        }));

        await this.vectorize.upsert(vectorRecords);

        this.logger.debug('Vector batch inserted', {
          batchIndex: Math.floor(i / batchSize),
          batchSize: batch.length,
          totalProcessed: Math.min(i + batchSize, vectors.length)
        });

      } catch (error) {
        this.logger.error('Vector batch insertion failed', {
          batchIndex: Math.floor(i / batchSize),
          error: error.message
        });
        throw error;
      }
    }
  }

  /**
   * Calculate checksum for content
   */
  private async calculateChecksum(content: string): Promise<string> {
    // Simple checksum implementation
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Flatten nested JSON object
   */
  private flattenJson(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(flattened, this.flattenJson(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }

    return flattened;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Delete document and all its embeddings
   */
  public async deleteDocument(documentId: string): Promise<void> {
    try {
      // Get all chunk IDs for the document
      const chunksResult = await this.dbService.query(
        'SELECT id FROM document_chunks WHERE document_id = ?',
        [documentId]
      );

      const chunkIds = chunksResult.results.map(row => row.id);

      // Delete vectors from Vectorize
      if (chunkIds.length > 0) {
        await this.vectorize.deleteByIds(chunkIds);
      }

      // Delete chunks from database
      await this.dbService.query(
        'DELETE FROM document_chunks WHERE document_id = ?',
        [documentId]
      );

      // Delete document metadata
      await this.dbService.query(
        'DELETE FROM documents WHERE id = ?',
        [documentId]
      );

      this.logger.info('Document deleted successfully', {
        documentId,
        chunksDeleted: chunkIds.length
      });

    } catch (error) {
      this.logger.error('Failed to delete document', {
        documentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  public async getStatistics(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalEmbeddings: number;
    categoryBreakdown: Record<string, number>;
    sourceBreakdown: Record<string, number>;
  }> {
    try {
      // Document stats
      const docStats = await this.dbService.query(`
        SELECT
          COUNT(*) as total_documents,
          SUM(chunks_count) as total_chunks,
          SUM(embeddings_count) as total_embeddings
        FROM documents
        WHERE processing_status = 'completed'
      `);

      // Category breakdown
      const categoryStats = await this.dbService.query(`
        SELECT category, COUNT(*) as count
        FROM documents
        WHERE processing_status = 'completed'
        GROUP BY category
      `);

      // Source breakdown
      const sourceStats = await this.dbService.query(`
        SELECT source, COUNT(*) as count
        FROM documents
        WHERE processing_status = 'completed'
        GROUP BY source
      `);

      return {
        totalDocuments: docStats.results[0]?.total_documents || 0,
        totalChunks: docStats.results[0]?.total_chunks || 0,
        totalEmbeddings: docStats.results[0]?.total_embeddings || 0,
        categoryBreakdown: categoryStats.results.reduce((acc, row) => {
          acc[row.category] = row.count;
          return acc;
        }, {}),
        sourceBreakdown: sourceStats.results.reduce((acc, row) => {
          acc[row.source] = row.count;
          return acc;
        }, {})
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', { error: error.message });
      throw error;
    }
  }
}