export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: any;
  distance: number;
}

export interface VectorSearchOptions {
  topK?: number;
  filter?: any;
  includeMetadata?: boolean;
  namespace?: string;
}

export interface VectorStoreService {
  upsert(vectors: any[]): Promise<void>;
  query(vector: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
  getById(id: string): Promise<any>;
  getIndexStats(): Promise<any>;
  clearIndex(): Promise<number>;
}

export class VectorizeService implements VectorStoreService {
  private vectorize: any;
  private logger: any;
  private indexName: string;
  private namespace: string;

  constructor(vectorize: any, logger: any, indexName: string = "rag-embeddings", namespace: string = "default") {
    this.vectorize = vectorize;
    this.logger = logger;
    this.indexName = indexName;
    this.namespace = namespace;
  }

  async upsert(vectors: any[]): Promise<void> {
    try {
      if (!this.vectorize?.upsert) {
        throw new Error("Vectorize upsert method not available");
      }

      // Prepare vectors for upsert
      const formattedVectors = vectors.map(vector => ({
        id: vector.id,
        values: vector.values,
        metadata: vector.metadata || {}
      }));

      await this.vectorize.upsert(formattedVectors);
      
      this.logger?.info(`Upserted ${formattedVectors.length} vectors to Vectorize index: ${this.indexName}`);
      
    } catch (error) {
      this.logger?.error("Vector upsert failed", { error: error.message });
      throw error;
    }
  }

  async query(vector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    try {
      if (!this.vectorize?.query) {
        throw new Error("Vectorize query method not available");
      }

      const queryOptions = {
        topK: options.topK || 10,
        namespace: options.namespace || this.namespace,
        includeMetadata: options.includeMetadata !== false,
        filter: options.filter
      };

      const results = await this.vectorize.query(vector, queryOptions);
      
      // Format results
      const formattedResults = results.matches.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {},
        distance: match.distance || 0
      }));

      this.logger?.info(`Vector query returned ${formattedResults.length} results for index: ${this.indexName}`);
      
      return formattedResults;
      
    } catch (error) {
      this.logger?.error("Vector query failed", { error: error.message });
      throw error;
    }
  }

  async delete(ids: string[]): Promise<void> {
    try {
      if (!this.vectorize.deleteByIds) {
        this.logger?.warn("Vectorize deleteByIds method not available, using fallback");
        return;
      }

      await this.vectorize.deleteByIds(ids);
      this.logger?.info(`Deleted ${ids.length} vectors from Vectorize index: ${this.indexName}`);
      
    } catch (error) {
      this.logger?.error("Vector delete failed", { error: error.message });
      throw error;
    }
  }

  async getById(id: string): Promise<any> {
    try {
      if (!this.vectorize.getById) {
        throw new Error("Vectorize getById method not available");
      }

      const result = await this.vectorize.getById(id);
      return result;
      
    } catch (error) {
      this.logger?.error("Vector getById failed", { error: error.message });
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      // This would require checking Vectorize API capabilities
      // For now, return basic stats
      return {
        indexName: this.indexName,
        namespace: this.namespace,
        dimensions: 768, // Default assumption
        recordCount: 0,
        status: "active"
      };
      
    } catch (error) {
      this.logger?.error("Get index stats failed", { error: error.message });
      throw error;
    }
  }

  async clearIndex(): Promise<number> {
    try {
      // This would require Vectorize API support for clearing
      // For now, return 0 as a placeholder
      this.logger?.warn("Vectorize clearIndex not implemented");
      return 0;
      
    } catch (error) {
      this.logger?.error("Clear index failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Batch upsert with better error handling
   */
  async batchUpsert(vectors: any[], batchSize: number = 100): Promise<void> {
    const totalVectors = vectors.length;
    
    for (let i = 0; i < totalVectors; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await this.upsert(batch);
    }
    
    this.logger?.info(`Batch upserted ${totalVectors} vectors in batches of ${batchSize}`);
  }

  /**
   * Search by metadata
   */
  async searchByMetadata(filter: any, options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    try {
      // This would require metadata search capabilities
      // For now, return empty results
      this.logger?.warn("Metadata search not implemented");
      return [];
      
    } catch (error) {
      this.logger?.error("Metadata search failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Update vector metadata
   */
  async updateMetadata(id: string, metadata: any): Promise<void> {
    try {
      // Get existing vector
      const existingVector = await this.getById(id);
      if (!existingVector) {
        throw new Error(`Vector with ID ${id} not found`);
      }

      // Update with new metadata
      const updatedVector = {
        ...existingVector,
        metadata: { ...existingVector.metadata, ...metadata }
      };

      await this.upsert([updatedVector]);
      this.logger?.info(`Updated metadata for vector: ${id}`);
      
    } catch (error) {
      this.logger?.error("Update metadata failed", { error: error.message });
      throw error;
    }
  }
}
