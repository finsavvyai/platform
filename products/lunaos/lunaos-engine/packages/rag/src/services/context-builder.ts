import {
  ContextBuilder,
  ContextWindow,
  DocumentChunk,
  ContextBuilderOptions,
  ContextRelevanceStrategy,
  ContextCompressionMethod,
} from '../interfaces';
import { EventEmitter } from 'events';

export class ContextBuilderService
  extends EventEmitter
  implements ContextBuilder {
  private maxTokens: number;
  private defaultStrategy: ContextRelevanceStrategy;
  private defaultCompression: ContextCompressionMethod;
  private tokenEstimator: (text: string) => number;

  constructor(
    options: {
      maxTokens?: number;
      defaultStrategy?: ContextRelevanceStrategy;
      defaultCompression?: ContextCompressionMethod;
      tokenEstimator?: (text: string) => number;
    } = {}
  ) {
    super();

    this.maxTokens = options.maxTokens || 4000;
    this.defaultStrategy =
      options.defaultStrategy || ContextRelevanceStrategy.SEMANTIC_RELEVANCE;
    this.defaultCompression =
      options.defaultCompression || ContextCompressionMethod.NONE;
    this.tokenEstimator = options.tokenEstimator || this.defaultTokenEstimator;
  }

  /**
   * Build context window from retrieved documents
   */
  async buildContext(
    documents: DocumentChunk[],
    options: ContextBuilderOptions = {}
  ): Promise<ContextWindow> {
    const startTime = Date.now();
    this.emit('building:start', { documentCount: documents.length });

    try {
      // Sort documents by relevance strategy
      const sortedDocs = this.sortDocumentsByRelevance(
        documents,
        options.relevanceStrategy || this.defaultStrategy,
        options.query
      );

      // Apply context compression if specified
      const compressedDocs = await this.applyContextCompression(
        sortedDocs,
        options.compressionMethod || this.defaultCompression,
        options
      );

      // Build context window within token limit
      const contextWindow = await this.buildContextWindow(
        compressedDocs,
        options
      );

      // Optimize context layout
      const optimizedContext = this.optimizeContextLayout(
        contextWindow,
        options
      );

      const finalContext: ContextWindow = {
        chunks: optimizedContext.chunks,
        totalTokens: optimizedContext.totalTokens,
        totalLength: optimizedContext.chunks.reduce(
          (sum, chunk) => sum + chunk.content.length,
          0
        ),
        compressionRatio: compressedDocs.length / documents.length,
        relevanceScore: this.calculateOverallRelevanceScore(
          optimizedContext.chunks,
          options.query
        ),
        metadata: {
          buildTime: Date.now() - startTime,
          strategy: options.relevanceStrategy || this.defaultStrategy,
          compression: options.compressionMethod || this.defaultCompression,
          originalDocumentCount: documents.length,
          finalDocumentCount: optimizedContext.chunks.length,
          averageChunkLength:
            optimizedContext.chunks.reduce(
              (sum, chunk) => sum + chunk.content.length,
              0
            ) / optimizedContext.chunks.length,
          timestamp: new Date().toISOString(),
        },
      };

      this.emit('building:complete', {
        originalCount: documents.length,
        finalCount: finalContext.chunks.length,
        totalTokens: finalContext.totalTokens,
        buildTime: finalContext.metadata.buildTime,
      });

      return finalContext;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown context building error';

      this.emit('building:error', { error: errorMessage });
      throw new Error(`Failed to build context: ${errorMessage}`);
    }
  }

  /**
   * Build hierarchical context with sections and subsections
   */
  async buildHierarchicalContext(
    documents: DocumentChunk[],
    sections: Array<{
      title: string;
      maxTokens?: number;
      priority?: number;
      documentIds?: string[];
    }>,
    options: ContextBuilderOptions = {}
  ): Promise<ContextWindow> {
    const startTime = Date.now();
    this.emit('hierarchical:building:start', { sections: sections.length });

    try {
      const sectionContexts: Array<{
        section: (typeof sections)[0];
        context: ContextWindow;
      }> = [];

      // Build context for each section
      for (const section of sections) {
        // Filter documents for this section
        const sectionDocs = section.documentIds
          ? documents.filter(doc =>
            section.documentIds!.includes(doc.documentId!)
          )
          : documents;

        // Apply section-specific token limit
        const sectionOptions: ContextBuilderOptions = {
          ...options,
          maxTokens:
            section.maxTokens || Math.floor(this.maxTokens / sections.length),
        };

        const sectionContext = await this.buildContext(
          sectionDocs,
          sectionOptions
        );

        sectionContexts.push({
          section,
          context: sectionContext,
        });
      }

      // Combine sections respecting priorities
      const combinedContext = this.combineSectionContexts(sectionContexts);

      const hierarchicalContext: ContextWindow = {
        chunks: combinedContext.chunks,
        totalTokens: combinedContext.totalTokens,
        totalLength: combinedContext.chunks.reduce(
          (sum, chunk) => sum + chunk.content.length,
          0
        ),
        compressionRatio: combinedContext.chunks.length / documents.length,
        relevanceScore: this.calculateOverallRelevanceScore(
          combinedContext.chunks,
          options.query
        ),
        metadata: {
          buildTime: Date.now() - startTime,
          strategy: 'hierarchical',
          sections: sections.map(s => s.title),
          originalDocumentCount: documents.length,
          finalDocumentCount: combinedContext.chunks.length,
          timestamp: new Date().toISOString(),
        },
      };

      this.emit('hierarchical:building:complete', {
        sections: sections.length,
        totalChunks: hierarchicalContext.chunks.length,
        buildTime: hierarchicalContext.metadata.buildTime,
      });

      return hierarchicalContext;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown hierarchical context building error';

      this.emit('hierarchical:building:error', { error: errorMessage });
      throw new Error(`Failed to build hierarchical context: ${errorMessage}`);
    }
  }

  /**
   * Build context with temporal awareness
   */
  async buildTemporalContext(
    documents: DocumentChunk[],
    options: ContextBuilderOptions & {
      timeWeight?: number; // Weight for recency (0-1)
      timeDecayFunction?: 'linear' | 'exponential' | 'logarithmic';
      referenceDate?: Date;
    } = {}
  ): Promise<ContextWindow> {
    const startTime = Date.now();
    const timeWeight = options.timeWeight || 0.3;
    const referenceDate = options.referenceDate || new Date();

    this.emit('temporal:building:start', { documentCount: documents.length });

    try {
      // Calculate temporal scores for each document
      const documentsWithTimeScore = documents.map(doc => {
        const temporalScore = this.calculateTemporalScore(
          doc,
          referenceDate,
          options.timeDecayFunction
        );

        return {
          ...doc,
          score:
            (doc.score || 0) * (1 - timeWeight) + temporalScore * timeWeight,
        };
      });

      // Sort by combined relevance and temporal score
      const sortedDocs = documentsWithTimeScore.sort(
        (a, b) => b.score - a.score
      );

      // Build context with temporal awareness
      const temporalContext = await this.buildContext(sortedDocs, {
        ...options,
        prioritizeRecency: true,
      });

      // Add temporal metadata
      temporalContext.metadata = {
        ...temporalContext.metadata,
        strategy: 'temporal',
        timeWeight,
        referenceDate: referenceDate.toISOString(),
        oldestDocument: this.findOldestDocumentDate(sortedDocs),
        newestDocument: this.findNewestDocumentDate(sortedDocs),
      };

      this.emit('temporal:building:complete', {
        documentCount: documents.length,
        finalCount: temporalContext.chunks.length,
        timeWeight,
      });

      return temporalContext;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown temporal context building error';

      this.emit('temporal:building:error', { error: errorMessage });
      throw new Error(`Failed to build temporal context: ${errorMessage}`);
    }
  }

  /**
   * Sort documents by relevance strategy
   */
  private sortDocumentsByRelevance(
    documents: DocumentChunk[],
    strategy: ContextRelevanceStrategy,
    query?: string
  ): DocumentChunk[] {
    switch (strategy) {
      case ContextRelevanceStrategy.SEMANTIC_RELEVANCE:
        return documents.sort((a, b) => (b.score || 0) - (a.score || 0));

      case ContextRelevanceStrategy.RECENCY:
        return documents.sort((a, b) => {
          const dateA = a.metadata?.createdAt
            ? new Date(a.metadata.createdAt).getTime()
            : 0;
          const dateB = b.metadata?.createdAt
            ? new Date(b.metadata.createdAt).getTime()
            : 0;
          return dateB - dateA;
        });

      case ContextRelevanceStrategy.DIVERSITY:
        return this.diversifyDocuments(documents);

      case ContextRelevanceStrategy.COVERAGE:
        return this.optimizeForCoverage(documents, query);

      case ContextRelevanceStrategy.BALANCED:
        return this.balanceMultipleFactors(documents, query);

      default:
        return documents;
    }
  }

  /**
   * Apply context compression methods
   */
  private async applyContextCompression(
    documents: DocumentChunk[],
    method: ContextCompressionMethod,
    options: ContextBuilderOptions
  ): Promise<DocumentChunk[]> {
    switch (method) {
      case ContextCompressionMethod.NONE:
        return documents;

      case ContextCompressionMethod.SUMMARIZATION:
        return await this.summarizeDocuments(documents, options);

      case ContextCompressionMethod.KEYWORD_EXTRACTION:
        return this.extractKeywords(documents);

      case ContextCompressionMethod.ENTITY_FILTERING:
        return this.filterByEntities(documents, options.query);

      case ContextCompressionMethod.REDUNDANCY_REMOVAL:
        return this.removeRedundantContent(documents);

      default:
        return documents;
    }
  }

  /**
   * Build context window within token limits
   */
  private async buildContextWindow(
    documents: DocumentChunk[],
    options: ContextBuilderOptions
  ): Promise<{ chunks: DocumentChunk[]; totalTokens: number }> {
    const maxTokens = options.maxTokens || this.maxTokens;
    const chunks: DocumentChunk[] = [];
    let totalTokens = 0;

    for (const doc of documents) {
      const docTokens = this.tokenEstimator(doc.content);

      if (totalTokens + docTokens <= maxTokens) {
        chunks.push(doc);
        totalTokens += docTokens;
      } else {
        // Try to add a truncated version
        const remainingTokens = maxTokens - totalTokens;
        if (remainingTokens > 100) {
          // Minimum chunk size
          const truncatedContent = this.truncateToTokens(
            doc.content,
            remainingTokens
          );
          chunks.push({
            ...doc,
            content: truncatedContent,
            metadata: {
              ...doc.metadata,
              truncated: true,
              originalLength: doc.content.length,
            },
          });
          totalTokens += remainingTokens;
        }
        break;
      }
    }

    return { chunks, totalTokens };
  }

  /**
   * Optimize context layout for better readability
   */
  private optimizeContextLayout(
    contextWindow: { chunks: DocumentChunk[]; totalTokens: number },
    options: ContextBuilderOptions
  ): { chunks: DocumentChunk[]; totalTokens: number } {
    if (!options.optimizeLayout) {
      return contextWindow;
    }

    const optimizedChunks = contextWindow.chunks.map((chunk, index) => {
      let optimizedContent = chunk.content;

      // Add section headers if document info is available
      if (chunk.metadata?.documentTitle && index === 0) {
        optimizedContent = `# ${chunk.metadata.documentTitle}\n\n${optimizedContent}`;
      }

      // Add chunk separators
      if (index < contextWindow.chunks.length - 1) {
        optimizedContent += '\n\n---\n\n';
      }

      return {
        ...chunk,
        content: optimizedContent,
      };
    });

    return {
      chunks: optimizedChunks,
      totalTokens: this.tokenEstimator(
        optimizedChunks.map(c => c.content).join('')
      ),
    };
  }

  // Helper methods for different strategies

  private diversifyDocuments(documents: DocumentChunk[]): DocumentChunk[] {
    const diversified: DocumentChunk[] = [];
    const seenTopics = new Set<string>();

    for (const doc of documents) {
      const topic = this.extractTopic(doc.content);

      if (!seenTopics.has(topic)) {
        diversified.push(doc);
        seenTopics.add(topic);
      }
    }

    return diversified;
  }

  private optimizeForCoverage(
    documents: DocumentChunk[],
    query?: string
  ): DocumentChunk[] {
    if (!query) return documents;

    const queryKeywords = new Set(
      this.extractKeywordsFromText(query.toLowerCase())
    );

    return documents
      .map(doc => {
        const docKeywords = new Set(
          this.extractKeywordsFromText(doc.content.toLowerCase())
        );
        const coverage = this.calculateCoverage(queryKeywords, docKeywords);

        return {
          ...doc,
          score: coverage,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private balanceMultipleFactors(
    documents: DocumentChunk[],
    query?: string
  ): DocumentChunk[] {
    return documents
      .map(doc => {
        const relevanceScore = doc.score || 0;
        const recencyScore = this.calculateRecencyScore(doc);
        const diversityScore = Math.random(); // Simplified diversity score

        const balancedScore =
          relevanceScore * 0.5 + recencyScore * 0.3 + diversityScore * 0.2;

        return {
          ...doc,
          score: balancedScore,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private async summarizeDocuments(
    documents: DocumentChunk[],
    options: ContextBuilderOptions
  ): Promise<DocumentChunk[]> {
    // Simplified summarization - in practice would use LLM
    return documents.map(doc => ({
      ...doc,
      content:
        doc.content.length > 500
          ? doc.content.substring(0, 500) + '... [summarized]'
          : doc.content,
      metadata: {
        ...doc.metadata,
        summarized: doc.content.length > 500,
      },
    }));
  }

  private extractKeywords(documents: DocumentChunk[]): DocumentChunk[] {
    return documents.map(doc => {
      const keywords = this.extractKeywordsFromText(doc.content);
      const keywordContent = keywords.join(', ');

      return {
        ...doc,
        content: `Keywords: ${keywordContent}`,
        metadata: {
          ...doc.metadata,
          keywordExtraction: true,
          originalKeywords: keywords,
        },
      };
    });
  }

  private filterByEntities(
    documents: DocumentChunk[],
    query?: string
  ): DocumentChunk[] {
    if (!query) return documents;

    const queryEntities = this.extractEntitiesFromText(query);

    return documents.filter(doc => {
      const docEntities = this.extractEntitiesFromText(doc.content);
      return queryEntities.some(entity => docEntities.includes(entity));
    });
  }

  private removeRedundantContent(documents: DocumentChunk[]): DocumentChunk[] {
    const unique: DocumentChunk[] = [];
    const seenHashes = new Set<string>();

    for (const doc of documents) {
      const hash = this.hashContent(doc.content);

      if (!seenHashes.has(hash)) {
        unique.push(doc);
        seenHashes.add(hash);
      }
    }

    return unique;
  }

  private combineSectionContexts(
    sectionContexts: Array<{ section: any; context: ContextWindow }>
  ): { chunks: DocumentChunk[]; totalTokens: number } {
    // Sort sections by priority
    const sortedSections = sectionContexts.sort(
      (a, b) => (b.section.priority || 0) - (a.section.priority || 0)
    );

    const combinedChunks: DocumentChunk[] = [];
    let totalTokens = 0;

    for (const { section, context } of sortedSections) {
      // Add section header
      if (combinedChunks.length > 0) {
        combinedChunks.push({
          id: `section-header-${section.title}`,
          documentId: 'section-header',
          index: combinedChunks.length,
          content: `## ${section.title}`,
          metadata: { sectionHeader: true, sectionTitle: section.title } as any,
          embedding: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
        totalTokens += this.tokenEstimator(`## ${section.title}`);
      }

      combinedChunks.push(...context.chunks);
      totalTokens += context.totalTokens;
    }

    return { chunks: combinedChunks, totalTokens };
  }

  private calculateTemporalScore(
    document: DocumentChunk,
    referenceDate: Date,
    decayFunction?: 'linear' | 'exponential' | 'logarithmic'
  ): number {
    const docDate = document.metadata?.createdAt
      ? new Date(document.metadata.createdAt)
      : new Date(0);

    const daysDiff =
      (referenceDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24);

    switch (decayFunction) {
      case 'linear':
        return Math.max(0, 1 - daysDiff / 365);

      case 'exponential':
        return Math.exp(-daysDiff / 30);

      case 'logarithmic':
        return Math.max(
          0,
          1 - Math.log(1 + daysDiff / 30) / Math.log(365 / 30 + 1)
        );

      default:
        return Math.max(0, 1 - daysDiff / 365);
    }
  }

  private calculateOverallRelevanceScore(
    chunks: DocumentChunk[],
    query?: string
  ): number {
    if (chunks.length === 0) return 0;

    const totalScore = chunks.reduce(
      (sum, chunk) => sum + (chunk.score || 0),
      0
    );
    return totalScore / chunks.length;
  }

  private extractTopic(content: string): string {
    const sentences = content.split(/[.!?]+/);
    if (sentences.length === 0) return '';

    return sentences[0]
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3)
      .join(' ');
  }

  private extractKeywordsFromText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isStopWord(word))
      .slice(0, 10);
  }

  private extractEntitiesFromText(text: string): string[] {
    // Simple entity extraction - in practice would use NER
    const entities = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    return entities;
  }

  private calculateCoverage(
    queryKeywords: Set<string>,
    docKeywords: Set<string>
  ): number {
    const intersection = new Set(
      [...queryKeywords].filter(keyword => docKeywords.has(keyword))
    );
    return intersection.size / queryKeywords.size;
  }

  private calculateRecencyScore(document: DocumentChunk): number {
    if (!document.metadata?.createdAt) return 0.5;

    const now = new Date().getTime();
    const created = new Date(document.metadata.createdAt).getTime();
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);

    return Math.max(0, 1 - daysDiff / 365);
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
    ]);
    return stopWords.has(word);
  }

  private truncateToTokens(content: string, maxTokens: number): string {
    const words = content.split(/\s+/);
    const avgTokensPerWord = 1.3; // Approximate

    const maxWords = Math.floor(maxTokens / avgTokensPerWord);
    return words.slice(0, maxWords).join(' ');
  }

  private findOldestDocumentDate(documents: DocumentChunk[]): string {
    const dates = documents
      .map(doc => doc.metadata?.createdAt)
      .filter(date => date)
      .map(date => new Date(date!));

    return dates.length > 0
      ? new Date(Math.min(...dates.map(d => d.getTime()))).toISOString()
      : '';
  }

  private findNewestDocumentDate(documents: DocumentChunk[]): string {
    const dates = documents
      .map(doc => doc.metadata?.createdAt)
      .filter(date => date)
      .map(date => new Date(date!));

    return dates.length > 0
      ? new Date(Math.max(...dates.map(d => d.getTime()))).toISOString()
      : '';
  }

  private defaultTokenEstimator(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    maxTokens?: number;
    defaultStrategy?: ContextRelevanceStrategy;
    defaultCompression?: ContextCompressionMethod;
    tokenEstimator?: (text: string) => number;
  }): void {
    if (config.maxTokens) this.maxTokens = config.maxTokens;
    if (config.defaultStrategy) this.defaultStrategy = config.defaultStrategy;
    if (config.defaultCompression)
      this.defaultCompression = config.defaultCompression;
    if (config.tokenEstimator) this.tokenEstimator = config.tokenEstimator;

    this.emit('config:updated', config);
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    maxTokens: number;
    defaultStrategy: ContextRelevanceStrategy;
    defaultCompression: ContextCompressionMethod;
  } {
    return {
      maxTokens: this.maxTokens,
      defaultStrategy: this.defaultStrategy,
      defaultCompression: this.defaultCompression,
    };
  }
}
