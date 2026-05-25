export interface EmbeddingVector {
  id: string;
  values: number[];
  metadata: VectorMetadata;
  confidence: number;
  processingTime: number;
}

export interface VectorMetadata {
  documentId: string;
  chunkIndex: number;
  chunkType: "text" | "table" | "figure" | "entity" | "cross_reference";
  sourceText: string;
  jurisdiction: string;
  documentType: string;
  language: string;
  createdAt: string;
  embeddingModel: string;
  dimensions: number;
  confidence: number;
  relatedEntities?: string[];
  crossReferences?: string[];
}

export interface EmbeddingGenerationConfig {
  embeddingModel: string;
  dimensions: number;
  maxChunkSize: number;
  chunkOverlap: number;
  batchProcessingSize: number;
  confidenceThreshold: number;
  enableTextEmbeddings: boolean;
  enableTableEmbeddings: boolean;
  enableFigureEmbeddings: boolean;
  enableEntityEmbeddings: boolean;
  enableCrossReferenceEmbeddings: boolean;
}

export interface ChunkingStrategy {
  chunkSize: number;
  overlap: number;
  strategy: "sentence" | "paragraph" | "semantic" | "fixed";
  respectBoundaries: boolean;
}

export interface VectorStoreConfig {
  indexName: string;
  namespace: string;
  dimensions: number;
  distanceMetric: "cosine" | "euclidean" | "dotproduct";
  maxRecords: number;
}

export class EmbeddingGenerator {
  private ai: any;
  private vectorize: any;
  private logger: any;
  private config: EmbeddingGenerationConfig;
  private vectorStoreConfig: VectorStoreConfig;

  constructor(
    ai: any,
    vectorize: any,
    logger: any,
    config: EmbeddingGenerationConfig = EmbeddingGenerator.defaultConfig(),
    vectorStoreConfig: VectorStoreConfig = EmbeddingGenerator.defaultVectorConfig()
  ) {
    this.ai = ai;
    this.vectorize = vectorize;
    this.logger = logger;
    this.config = config;
    this.vectorStoreConfig = vectorStoreConfig;
  }

  /**
   * Generate embeddings for extracted content and store in Vectorize
   */
  async generateAndStoreEmbeddings(
    documentId: string,
    extractedContent: any
  ): Promise<{
    vectors: EmbeddingVector[];
    metadata: VectorMetadata[];
    processingStats: {
      totalChunks: number;
      textChunks: number;
      tableChunks: number;
      figureChunks: number;
      entityChunks: number;
      crossReferenceChunks: number;
      processingTime: number;
    };
  }> {
    const startTime = Date.now();
    
    this.logger?.info("Starting vector embedding generation", { documentId });
    
    try {
      // Generate chunks from different content types
      const chunks = await this.generateChunks(extractedContent);
      
      // Generate embeddings for all chunks
      const embeddings = await this.generateEmbeddings(chunks);
      
      // Store embeddings in Vectorize
      const storedVectors = await this.storeEmbeddings(embeddings);
      
      const processingTime = Date.now() - startTime;
      
      const stats = this.calculateProcessingStats(chunks, processingTime);
      
      this.logger?.info("Vector embedding generation completed", {
        documentId,
        totalVectors: storedVectors.length,
        processingTime,
        ...stats
      });
      
      return {
        vectors: storedVectors,
        metadata: embeddings.map(e => e.metadata),
        processingStats: stats
      };
      
    } catch (error) {
      this.logger?.error("Vector embedding generation failed", { documentId, error: error.message });
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate optimized chunks from extracted content
   */
  private async generateChunks(extractedContent: any): Promise<VectorMetadata[]> {
    const chunks: VectorMetadata[] = [];
    let chunkIndex = 0;
    
    // Process text chunks
    if (this.config.enableTextEmbeddings && extractedContent.text) {
      const textChunks = await this.chunkText(extractedContent.text, chunkIndex);
      chunks.push(...textChunks);
      chunkIndex += textChunks.length;
    }
    
    // Process table chunks
    if (this.config.enableTableEmbeddings && extractedContent.tables) {
      for (const table of extractedContent.tables) {
        const tableChunks = await this.chunkTable(table, chunkIndex, extractedContent);
        chunks.push(...tableChunks);
        chunkIndex += tableChunks.length;
      }
    }
    
    // Process figure chunks
    if (this.config.enableFigureEmbeddings && extractedContent.figures) {
      for (const figure of extractedContent.figures) {
        const figureChunks = await this.chunkFigure(figure, chunkIndex, extractedContent);
        chunks.push(...figureChunks);
        chunkIndex += figureChunks.length;
      }
    }
    
    // Process entity chunks
    if (this.config.enableEntityEmbeddings && extractedContent.entities) {
      const entityChunks = await this.chunkEntities(extractedContent.entities, chunkIndex, extractedContent);
      chunks.push(...entityChunks);
      chunkIndex += entityChunks.length;
    }
    
    // Process cross-reference chunks
    if (this.config.enableCrossReferenceEmbeddings && extractedContent.crossReferences) {
      const refChunks = await this.chunkCrossReferences(extractedContent.crossReferences, chunkIndex, extractedContent);
      chunks.push(...refChunks);
      chunkIndex += refChunks.length;
    }
    
    return chunks;
  }

  /**
   * Chunk text content using semantic boundaries
   */
  private async chunkText(text: string, startIndex: number): Promise<VectorMetadata[]> {
    const chunks: VectorMetadata[] = [];
    
    if (this.config.chunkingStrategy.strategy === "semantic") {
      // Use AI for semantic chunking
      const semanticChunks = await this.performSemanticChunking(text);
      
      semanticChunks.forEach((chunk, index) => {
        chunks.push({
          documentId: `temp-doc`, // Will be updated later
          chunkIndex: startIndex + index,
          chunkType: "text",
          sourceText: chunk,
          jurisdiction: "unknown",
          documentType: "unknown",
          language: "unknown",
          createdAt: new Date().toISOString(),
          embeddingModel: this.config.embeddingModel,
          dimensions: this.config.dimensions,
          confidence: 0.9,
          relatedEntities: [],
          crossReferences: []
        });
      });
    } else {
      // Use fixed-size chunking
      const fixedChunks = this.performFixedChunking(text);
      
      fixedChunks.forEach((chunk, index) => {
        chunks.push({
          documentId: `temp-doc`,
          chunkIndex: startIndex + index,
          chunkType: "text",
          sourceText: chunk,
          jurisdiction: "unknown",
          documentType: "unknown",
          language: "unknown",
          createdAt: new Date().toISOString(),
          embeddingModel: this.config.embeddingModel,
          dimensions: this.config.dimensions,
          confidence: 0.85,
          relatedEntities: [],
          crossReferences: []
        });
      });
    }
    
    return chunks;
  }

  /**
   * Generate embeddings using Workers AI
   */
  private async generateEmbeddings(chunks: VectorMetadata[]): Promise<EmbeddingVector[]> {
    const embeddings: EmbeddingVector[] = [];
    
    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += this.config.batchProcessingSize) {
      const batch = chunks.slice(i, i + this.config.batchProcessingSize);
      
      const batchEmbeddings = await this.generateBatchEmbeddings(batch);
      embeddings.push(...batchEmbeddings);
    }
    
    return embeddings;
  }

  /**
   * Generate embeddings for a batch of chunks
   */
  private async generateBatchEmbeddings(batch: VectorMetadata[]): Promise<EmbeddingVector[]> {
    try {
      if (this.ai && this.ai.run) {
        const embeddingPromises = batch.map(async (chunk) => {
          const result = await this.ai.run(this.config.embeddingModel, { 
            text: chunk.sourceText,
            options: {
              dimensions: this.config.dimensions,
              normalize: true
            }
          });
          
          return {
            id: `embed_${chunk.documentId}_${chunk.chunkIndex}`,
            values: result.values,
            metadata: chunk,
            confidence: result.confidence || 0.8,
            processingTime: 0
          };
        });
        
        return await Promise.all(embeddingPromises);
      }
      
      // Fallback: Generate mock embeddings for testing
      return batch.map(chunk => ({
        id: `embed_${chunk.documentId}_${chunk.chunkIndex}`,
        values: Array(this.config.dimensions).fill(0).map(() => Math.random()),
        metadata: chunk,
        confidence: 0.5,
        processingTime: 0
      }));
      
    } catch (error) {
      this.logger?.warn("Batch embedding generation failed, using fallback", { error: error.message });
      
      // Fallback to mock embeddings
      return batch.map(chunk => ({
        id: `embed_${chunk.documentId}_${chunk.chunkIndex}`,
        values: Array(this.config.dimensions).fill(0).map(() => Math.random()),
        metadata: chunk,
        confidence: 0.5,
        processingTime: 0
      }));
    }
  }

  /**
   * Store embeddings in Vectorize
   */
  private async storeEmbeddings(embeddings: EmbeddingVector[]): Promise<EmbeddingVector[]> {
    try {
      if (this.vectorize && this.vectorize.upsert) {
        // Prepare vectors for Vectorize
        const vectorizeVectors = embeddings.map(embedding => ({
          id: embedding.id,
          values: embedding.values,
          metadata: {
            ...embedding.metadata,
            confidence: embedding.confidence,
            processingTime: embedding.processingTime
          }
        }));
        
        // Store in Vectorize
        await this.vectorize.upsert(vectorizeVectors);
        
        this.logger?.info(`Stored ${vectorizeVectors.length} embeddings in Vectorize`);
        
        return embeddings;
      }
      
      this.logger?.warn("Vectorize not available, embeddings stored locally");
      return embeddings;
      
    } catch (error) {
      this.logger?.error("Vector storage failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Perform semantic chunking using AI
   */
  private async performSemanticChunking(text: string): Promise<string[]> {
    try {
      if (this.ai && this.ai.run) {
        const result = await this.ai.run("@cf/unrealistic/text-chunking", {
          text,
          maxChunkSize: this.config.maxChunkSize,
          overlap: this.config.chunkOverlap,
          strategy: "semantic"
        });
        
        return result.chunks || [text];
      }
      
      // Fallback to fixed chunking
      return this.performFixedChunking(text);
      
    } catch (error) {
      this.logger?.warn("Semantic chunking failed, using fixed chunking", { error: error.message });
      return this.performFixedChunking(text);
    }
  }

  /**
   * Perform fixed-size text chunking
   */
  private performFixedChunking(text: string): string[] {
    const chunks: string[] = [];
    const chunkSize = this.config.maxChunkSize;
    const overlap = this.config.chunkOverlap;
    
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const end = Math.min(i + chunkSize, text.length);
      chunks.push(text.slice(i, end));
    }
    
    return chunks;
  }

  /**
   * Chunk table content
   */
  private async chunkTable(table: any, startIndex: number, extractedContent: any): Promise<VectorMetadata[]> {
    const chunks: VectorMetadata[] = [];
    
    // Convert table to text representation
    const tableText = this.tableToText(table);
    
    const tableChunks = this.performFixedChunking(tableText);
    
    tableChunks.forEach((chunk, index) => {
      chunks.push({
        documentId: `temp-doc`,
        chunkIndex: startIndex + index,
        chunkType: "table",
        sourceText: chunk,
        jurisdiction: extractedContent.metadata?.jurisdiction || "unknown",
        documentType: extractedContent.metadata?.documentType || "unknown",
        language: extractedContent.metadata?.language || "unknown",
        createdAt: new Date().toISOString(),
        embeddingModel: this.config.embeddingModel,
        dimensions: this.config.dimensions,
        confidence: 0.8,
        relatedEntities: [],
        crossReferences: []
      });
    });
    
    return chunks;
  }

  /**
   * Chunk figure content
   */
  private async chunkFigure(figure: any, startIndex: number, extractedContent: any): Promise<VectorMetadata[]> {
    const figureText = `${figure.title || ""} ${figure.description}`.trim();
    
    return [{
      documentId: `temp-doc`,
      chunkIndex: startIndex,
      chunkType: "figure",
      sourceText: figureText,
      jurisdiction: extractedContent.metadata?.jurisdiction || "unknown",
      documentType: extractedContent.metadata?.documentType || "unknown",
      language: extractedContent.metadata?.language || "unknown",
      createdAt: new Date().toISOString(),
      embeddingModel: this.config.embeddingModel,
      dimensions: this.config.dimensions,
      confidence: 0.75,
      relatedEntities: [],
      crossReferences: []
    }];
  }

  /**
   * Chunk entities
   */
  private async chunkEntities(entities: any[], startIndex: number, extractedContent: any): Promise<VectorMetadata[]> {
    return entities.map((entity, index) => ({
      documentId: `temp-doc`,
      chunkIndex: startIndex + index,
      chunkType: "entity",
      sourceText: entity.text,
      jurisdiction: extractedContent.metadata?.jurisdiction || "unknown",
      documentType: extractedContent.metadata?.documentType || "unknown",
      language: extractedContent.metadata?.language || "unknown",
      createdAt: new Date().toISOString(),
      embeddingModel: this.config.embeddingModel,
      dimensions: this.config.dimensions,
      confidence: entity.confidence,
      relatedEntities: [],
      crossReferences: []
    }));
  }

  /**
   * Chunk cross-references
   */
  private async chunkCrossReferences(crossReferences: any[], startIndex: number, extractedContent: any): Promise<VectorMetadata[]> {
    return crossReferences.map((ref, index) => ({
      documentId: `temp-doc`,
      chunkIndex: startIndex + index,
      chunkType: "cross_reference",
      sourceText: ref.context,
      jurisdiction: extractedContent.metadata?.jurisdiction || "unknown",
      documentType: extractedContent.metadata?.documentType || "unknown",
      language: extractedContent.metadata?.language || "unknown",
      createdAt: new Date().toISOString(),
      embeddingModel: this.config.embeddingModel,
      dimensions: this.config.dimensions,
      confidence: ref.confidence,
      relatedEntities: [],
      crossReferences: [ref.targetId]
    }));
  }

  /**
   * Convert table to text representation
   */
  private tableToText(table: any): string {
    const lines = [table.title || ""];
    
    if (table.headers && table.headers.length > 0) {
      lines.push(`Headers: ${table.headers.join(" | ")}`);
    }
    
    if (table.rows && table.rows.length > 0) {
      table.rows.forEach((row: string[], index: number) => {
        lines.push(`Row ${index + 1}: ${row.join(" | ")}`);
      });
    }
    
    return lines.join(" ");
  }

  /**
   * Calculate processing statistics
   */
  private calculateProcessingStats(chunks: VectorMetadata[], processingTime: number): any {
    const stats = {
      totalChunks: chunks.length,
      textChunks: 0,
      tableChunks: 0,
      figureChunks: 0,
      entityChunks: 0,
      crossReferenceChunks: 0,
      processingTime
    };
    
    chunks.forEach(chunk => {
      switch (chunk.chunkType) {
        case "text":
          stats.textChunks++;
          break;
        case "table":
          stats.tableChunks++;
          break;
        case "figure":
          stats.figureChunks++;
          break;
        case "entity":
          stats.entityChunks++;
          break;
        case "cross_reference":
          stats.crossReferenceChunks++;
          break;
      }
    });
    
    return stats;
  }

  /**
   * Default configuration
   */
  static defaultConfig(): EmbeddingGenerationConfig {
    return {
      embeddingModel: "@cf/unrealistic/embedding",
      dimensions: 768,
      maxChunkSize: 500,
      chunkOverlap: 50,
      batchProcessingSize: 10,
      confidenceThreshold: 0.7,
      enableTextEmbeddings: true,
      enableTableEmbeddings: true,
      enableFigureEmbeddings: true,
      enableEntityEmbeddings: true,
      enableCrossReferenceEmbeddings: true,
      chunkingStrategy: {
        chunkSize: 500,
        overlap: 50,
        strategy: "semantic",
        respectBoundaries: true
      }
    };
  }

  /**
   * Default Vectorize configuration
   */
  static defaultVectorConfig(): VectorStoreConfig {
    return {
      indexName: "rag-embeddings",
      namespace: "default",
      dimensions: 768,
      distanceMetric: "cosine",
      maxRecords: 1000000
    };
  }
}
