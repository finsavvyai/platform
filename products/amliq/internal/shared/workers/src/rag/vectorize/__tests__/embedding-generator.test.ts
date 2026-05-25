import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingGenerator } from '../embedding-generator';
import { VectorStoreService } from '../services/vector-service';

// Mock dependencies
const mockVectorService = {
  upsert: vi.fn(),
  query: vi.fn(),
  delete: vi.fn(),
  updateMetadata: vi.fn(),
  queryByMetadata: vi.fn()
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

const mockAI = {
  run: vi.fn()
};

describe('EmbeddingGenerator', () => {
  let embeddingGenerator: EmbeddingGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    embeddingGenerator = new EmbeddingGenerator(
      mockVectorService as any,
      mockLogger,
      mockAI as any
    );
  });

  describe('generateAndStoreEmbeddings', () => {
    it('should generate and store embeddings for extracted content', async () => {
      const mockDocumentId = 'doc_123';
      const mockExtractedContent = {
        textContent: 'This is a sample financial regulation document.',
        sections: [
          {
            title: 'Introduction',
            content: 'This document outlines financial regulations.',
            position: { start: 0, end: 40 }
          }
        ],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: []
      };

      mockAI.run.mockResolvedValue({
        response: [[0.1, 0.2, 0.3, 0.4, 0.5]]
      });

      mockVectorService.upsert.mockResolvedValue({ success: true });

      const result = await embeddingGenerator.generateAndStoreEmbeddings(
        mockDocumentId,
        mockExtractedContent
      );

      expect(result.vectors).toHaveLength(1);
      expect(result.vectors[0].documentId).toBe(mockDocumentId);
      expect(result.vectors[0].values).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(result.processingStats.totalChunks).toBe(1);
      expect(mockVectorService.upsert).toHaveBeenCalled();
    });

    it('should handle AI fallback gracefully', async () => {
      const mockDocumentId = 'doc_123';
      const mockExtractedContent = {
        textContent: 'This is a sample document.',
        sections: [],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: []
      };

      // Simulate AI failure
      mockAI.run.mockRejectedValue(new Error('AI service unavailable'));

      const result = await embeddingGenerator.generateAndStoreEmbeddings(
        mockDocumentId,
        mockExtractedContent
      );

      expect(result.vectors).toHaveLength(1);
      expect(result.processingStats.aiFallbacks).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AI embedding generation failed, using fallback',
        expect.any(Object)
      );
    });

    it('should process batch requests efficiently', async () => {
      const mockDocumentId = 'doc_123';
      const mockExtractedContent = {
        textContent: 'A'.repeat(2000), // Force multiple chunks
        sections: [],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: []
      };

      mockAI.run.mockResolvedValue({
        response: [[0.1, 0.2, 0.3, 0.4, 0.5]]
      });

      mockVectorService.upsert.mockResolvedValue({ success: true });

      const result = await embeddingGenerator.generateAndStoreEmbeddings(
        mockDocumentId,
        mockExtractedContent,
        { chunkSize: 500, batchSize: 2 }
      );

      expect(result.processingStats.totalChunks).toBeGreaterThan(1);
      expect(result.processingStats.batchesProcessed).toBeGreaterThan(1);
    });

    it('should handle empty content gracefully', async () => {
      const mockDocumentId = 'doc_123';
      const mockExtractedContent = {
        textContent: '',
        sections: [],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: []
      };

      const result = await embeddingGenerator.generateAndStoreEmbeddings(
        mockDocumentId,
        mockExtractedContent
      );

      expect(result.vectors).toHaveLength(0);
      expect(result.processingStats.totalChunks).toBe(0);
    });
  });

  describe('semanticChunking', () => {
    it('should create chunks based on content boundaries', () => {
      const content = `
        Section 1: Introduction
        This is the first section with some content.

        Section 2: Details
        This section contains more detailed information.

        Section 3: Conclusion
        Final section with summary.
      `;

      const chunks = embeddingGenerator.createSemanticChunks(content, 100);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every(chunk => chunk.length <= 100)).toBe(true);
    });

    it('should handle very short content', () => {
      const content = 'Short text';
      const chunks = embeddingGenerator.createSemanticChunks(content, 100);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(content);
    });

    it('should preserve table content in chunks', () => {
      const content = `
        Introduction text before table.

        Table: Financial Data
        | Header 1 | Header 2 |
        |----------|----------|
        | Value 1  | Value 2  |
        | Value 3  | Value 4  |

        Text after table.
      `;

      const chunks = embeddingGenerator.createSemanticChunks(content, 50);

      // Table content should be kept together
      const tableChunks = chunks.filter(chunk => chunk.includes('Financial Data'));
      expect(tableChunks.length).toBe(1);
    });
  });

  describe('generateEmbeddingWithFallback', () => {
    it('should use AI when available', async () => {
      const text = 'Sample text for embedding';

      mockAI.run.mockResolvedValue({
        response: [[0.1, 0.2, 0.3, 0.4, 0.5]]
      });

      const embedding = await embeddingGenerator.generateEmbeddingWithFallback(text);

      expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(mockAI.run).toHaveBeenCalled();
    });

    it('should use fallback when AI is unavailable', async () => {
      const text = 'Sample text for embedding';

      // Mock AI as unavailable
      embeddingGenerator['ai'] = null;

      const embedding = await embeddingGenerator.generateEmbeddingWithFallback(text);

      // Fallback should generate deterministic pseudo-embeddings
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(384); // Standard embedding dimension
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AI unavailable, using fallback embedding generation',
        expect.any(Object)
      );
    });

    it('should handle AI errors gracefully', async () => {
      const text = 'Sample text for embedding';

      mockAI.run.mockRejectedValue(new Error('AI service error'));

      const embedding = await embeddingGenerator.generateEmbeddingWithFallback(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AI embedding generation failed, using fallback',
        expect.any(Object)
      );
    });
  });

  describe('generateFallbackEmbedding', () => {
    it('should generate deterministic embeddings for same text', () => {
      const text = 'Sample text';

      const embedding1 = embeddingGenerator['generateFallbackEmbedding'](text);
      const embedding2 = embeddingGenerator['generateFallbackEmbedding'](text);

      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different text', () => {
      const text1 = 'Sample text 1';
      const text2 = 'Sample text 2';

      const embedding1 = embeddingGenerator['generateFallbackEmbedding'](text1);
      const embedding2 = embeddingGenerator['generateFallbackEmbedding'](text2);

      expect(embedding1).not.toEqual(embedding2);
    });

    it('should generate embeddings with correct dimensions', () => {
      const text = 'Sample text';

      const embedding = embeddingGenerator['generateFallbackEmbedding'](text);

      expect(embedding.length).toBe(384);
      expect(embedding.every(val => typeof val === 'number' && val >= -1 && val <= 1)).toBe(true);
    });
  });

  describe('batchProcessing', () => {
    it('should process chunks in batches', async () => {
      const chunks = Array(25).fill(null).map((_, i) => `Chunk ${i}`);
      const embeddings = Array(25).fill(null).map(() => [0.1, 0.2, 0.3]);

      mockAI.run.mockResolvedValue({ response: embeddings });

      await embeddingGenerator['processBatch'](chunks, 0, 10);

      expect(mockAI.run).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.any(String) }],
        text_only: false,
        stream: false
      });
    });

    it('should handle batch errors gracefully', async () => {
      const chunks = Array(5).fill(null).map((_, i) => `Chunk ${i}`);

      mockAI.run.mockRejectedValue(new Error('Batch processing failed'));

      const result = await embeddingGenerator['processBatch'](chunks, 0, 5);

      expect(result).toHaveLength(5);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Batch processing failed',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle vector service errors', async () => {
      const mockDocumentId = 'doc_123';
      const mockExtractedContent = {
        textContent: 'Sample content',
        sections: [],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: []
      };

      mockAI.run.mockResolvedValue({
        response: [[0.1, 0.2, 0.3, 0.4, 0.5]]
      });

      mockVectorService.upsert.mockRejectedValue(new Error('Vector service unavailable'));

      await expect(
        embeddingGenerator.generateAndStoreEmbeddings(mockDocumentId, mockExtractedContent)
      ).rejects.toThrow('Vector service unavailable');
    });

    it('should validate required parameters', async () => {
      await expect(
        embeddingGenerator.generateAndStoreEmbeddings('', {})
      ).rejects.toThrow('Document ID is required');
    });
  });

  describe('metadata generation', () => {
    it('should generate appropriate metadata for different content types', () => {
      const text = 'Financial regulation about compliance';
      const chunkIndex = 0;
      const totalChunks = 1;

      const metadata = embeddingGenerator['generateMetadata'](
        text,
        chunkIndex,
        totalChunks,
        {}
      );

      expect(metadata.documentId).toBeDefined();
      expect(metadata.chunkIndex).toBe(chunkIndex);
      expect(metadata.totalChunks).toBe(totalChunks);
      expect(metadata.tokenCount).toBeGreaterThan(0);
      expect(metadata.contentCategory).toBeDefined();
    });

    it('should detect financial content types', () => {
      const regulationText = 'This regulation requires compliance with federal rules.';
      const marketText = 'Market prices fluctuated during trading hours.';
      const riskText = 'Risk assessment shows high volatility in this sector.';

      const regulationMeta = embeddingGenerator['generateMetadata'](regulationText, 0, 1, {});
      const marketMeta = embeddingGenerator['generateMetadata'](marketText, 0, 1, {});
      const riskMeta = embeddingGenerator['generateMetadata'](riskText, 0, 1, {});

      expect(regulationMeta.contentCategory).toContain('regulatory');
      expect(marketMeta.contentCategory).toContain('market_data');
      expect(riskMeta.contentCategory).toContain('risk_assessment');
    });
  });
});
