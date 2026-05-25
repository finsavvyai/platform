import {
  DocumentProcessor,
  Document,
  DocumentChunk,
  ProcessedDocument,
  DocumentMetadata,
  ChunkingStrategy,
  ProcessingOptions,
  TextEntity,
  TextPreprocessor,
  Language,
  DocumentType,
  DocumentSource
} from '../interfaces';
import { EventEmitter } from 'events';

export class DocumentProcessorService extends EventEmitter implements DocumentProcessor {
  private chunkSize: number;
  private chunkOverlap: number;
  private minChunkSize: number;
  private maxChunkSize: number;
  private supportedLanguages: Set<Language>;
  private entityExtractors: Map<string, (text: string) => TextEntity[]>;
  private keywordExtractors: Map<string, (text: string, limit?: number) => string[]>;

  constructor(options: ProcessingOptions = {}) {
    super();

    this.chunkSize = options.chunkSize || 1000;
    this.chunkOverlap = options.chunkOverlap || 200;
    this.minChunkSize = options.minChunkSize || 200;
    this.maxChunkSize = options.maxChunkSize || 2000;
    this.supportedLanguages = new Set(options.supportedLanguages || [
      Language.ENGLISH,
      Language.SPANISH,
      Language.FRENCH,
      Language.GERMAN,
      Language.ITALIAN,
      Language.PORTUGUESE,
      Language.CHINESE,
      Language.JAPANESE
    ]);

    this.entityExtractors = new Map();
    this.keywordExtractors = new Map();

    this.initializeDefaultExtractors();
  }

  /**
   * Process a document and split it into chunks
   */
  async processDocument(
    content: string,
    options: {
      documentId?: string;
      title?: string;
      source?: string;
      metadata?: DocumentMetadata;
      chunkingStrategy?: ChunkingStrategy;
    } = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();

    try {
      this.emit('processing:start', { documentId: options.documentId });

      // Detect language
      const language = this.detectLanguage(content);

      // Create document object
      const document: Document = {
        id: options.documentId || this.generateId(),
        title: options.title || 'Untitled Document',
        content,
        source: (options.source as DocumentSource) || 'custom',
        metadata: {
          ...options.metadata,
          language,
          type: this.detectDocumentType(content, options.metadata?.type || options.metadata?.documentType),
          documentType: this.detectDocumentType(content, options.metadata?.type || options.metadata?.documentType),
          processedAt: new Date().toISOString(),
          processingVersion: '1.0.0'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Preprocess text
      const preprocessedContent = this.preprocessText(content, language);

      // Extract entities and keywords
      const entities = await this.extractEntities(preprocessedContent, language);
      const keywords = await this.extractKeywords(preprocessedContent, language, 20);

      // Split into chunks
      const chunkingStrategy = options.chunkingStrategy || ChunkingStrategy.SEMANTIC;
      const chunks = await this.createChunks(
        preprocessedContent,
        chunkingStrategy,
        document,
        language
      );

      // Create processed document
      const processedDocument: ProcessedDocument = {
        document,
        chunks,
        entities,
        keywords,
        statistics: this.calculateStatistics(content, chunks),
        processingTime: Date.now() - startTime,
        success: true,
        errors: []
      };

      this.emit('processing:complete', {
        documentId: document.id,
        chunkCount: chunks.length,
        processingTime: processedDocument.processingTime
      });

      return processedDocument;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.emit('processing:error', {
        documentId: options.documentId,
        error: errorMessage
      });

      return {
        document: {} as Document,
        chunks: [],
        entities: [],
        keywords: [],
        statistics: {
          totalChunks: 0,
          averageChunkLength: 0,
          minChunkLength: 0,
          maxChunkLength: 0,
          totalTokens: 0
        },
        processingTime: Date.now() - startTime,
        success: false,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Process multiple documents in batch
   */
  async processBatch(
    documents: Array<{
      content: string;
      documentId?: string;
      title?: string;
      source?: string;
      metadata?: DocumentMetadata;
      chunkingStrategy?: ChunkingStrategy;
    }>,
    options: {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<ProcessedDocument[]> {
    const concurrency = options.concurrency || 3;
    const results: ProcessedDocument[] = [];

    // Process documents in batches
    for (let i = 0; i < documents.length; i += concurrency) {
      const batch = documents.slice(i, i + concurrency);
      const batchPromises = batch.map(doc => this.processDocument(doc.content, doc));

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (options.onProgress) {
        options.onProgress(Math.min(i + concurrency, documents.length), documents.length);
      }
    }

    return results;
  }

  /**
   * Create chunks from content using specified strategy
   */
  async createChunks(
    content: string,
    strategy: ChunkingStrategy,
    document: Document,
    language: Language
  ): Promise<DocumentChunk[]> {
    switch (strategy) {
      case ChunkingStrategy.FIXED:
        return this.createFixedChunks(content, document);

      case ChunkingStrategy.SEMANTIC:
        return this.createSemanticChunks(content, document, language);

      case ChunkingStrategy.RECURSIVE:
        return this.createRecursiveChunks(content, document);

      case ChunkingStrategy.SLIDING:
        return this.createSlidingChunks(content, document);

      case ChunkingStrategy.HYBRID:
        return this.createHybridChunks(content, document, language);

      default:
        return this.createFixedChunks(content, document);
    }
  }

  /**
   * Create fixed-size chunks
   */
  private createFixedChunks(content: string, document: Document): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = this.splitIntoSentences(content);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > this.minChunkSize) {
        chunks.push(this.createChunk(currentChunk, chunkIndex, document));
        currentChunk = sentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, document));
    }

    return chunks;
  }

  /**
   * Create semantic chunks based on content coherence
   */
  private async createSemanticChunks(
    content: string,
    document: Document,
    language: Language
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const paragraphs = content.split(/\n\s*\n/);

    let currentChunk = '';
    let chunkIndex = 0;
    let currentTopic = '';

    for (const paragraph of paragraphs) {
      const paragraphTopic = this.extractTopic(paragraph, language);
      const coherenceScore = this.calculateCoherence(currentChunk, paragraph, currentTopic, paragraphTopic);

      // Start new chunk if coherence is low or chunk is too large
      if ((coherenceScore < 0.3 || currentChunk.length > this.chunkSize) && currentChunk.length > this.minChunkSize) {
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(currentChunk, chunkIndex, document));
          chunkIndex++;
        }
        currentChunk = paragraph;
        currentTopic = paragraphTopic;
      } else {
        currentChunk += '\n\n' + paragraph;
        if (!currentTopic) currentTopic = paragraphTopic;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, document));
    }

    return chunks;
  }

  /**
   * Create recursive chunks using multiple separators
   */
  private createRecursiveChunks(content: string, document: Document): DocumentChunk[] {
    const separators = [
      '\n\n\n',  // Triple newlines (major sections)
      '\n\n',   // Double newlines (paragraphs)
      '\n',     // Single newlines (lines)
      '. ',     // Sentences
      ' ',      // Words
    ];

    return this.recursiveChunk(content, document, separators, 0);
  }

  /**
   * Recursive chunking helper
   */
  private recursiveChunk(
    content: string,
    document: Document,
    separators: string[],
    separatorIndex: number
  ): DocumentChunk[] {
    if (separatorIndex >= separators.length || content.length <= this.chunkSize) {
      return [this.createChunk(content, 0, document)];
    }

    const separator = separators[separatorIndex];
    const parts = content.split(separator);

    if (parts.length === 1) {
      return this.recursiveChunk(content, document, separators, separatorIndex + 1);
    }

    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const part of parts) {
      const testChunk = currentChunk + (currentChunk ? separator : '') + part;

      if (testChunk.length > this.chunkSize && currentChunk.length > this.minChunkSize) {
        chunks.push(this.createChunk(currentChunk, chunkIndex, document));
        currentChunk = part;
        chunkIndex++;
      } else {
        currentChunk = testChunk;
      }
    }

    if (currentChunk.trim()) {
      if (currentChunk.length > this.chunkSize && separatorIndex < separators.length - 1) {
        const subChunks = this.recursiveChunk(currentChunk, document, separators, separatorIndex + 1);
        chunks.push(...subChunks);
      } else {
        chunks.push(this.createChunk(currentChunk, chunkIndex, document));
      }
    }

    return chunks;
  }

  /**
   * Create sliding window chunks
   */
  private createSlidingChunks(content: string, document: Document): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const words = content.split(/\s+/);

    let chunkIndex = 0;
    for (let i = 0; i < words.length; i += Math.max(1, this.chunkSize - this.chunkOverlap)) {
      const chunkWords = words.slice(i, i + this.chunkSize);
      const chunkText = chunkWords.join(' ');

      if (chunkText.trim().length >= this.minChunkSize) {
        chunks.push(this.createChunk(chunkText, chunkIndex, document));
        chunkIndex++;
      }
    }

    return chunks;
  }

  /**
   * Create hybrid chunks combining multiple strategies
   */
  private async createHybridChunks(
    content: string,
    document: Document,
    language: Language
  ): Promise<DocumentChunk[]> {
    // Start with semantic chunks
    const semanticChunks = await this.createSemanticChunks(content, document, language);

    const finalChunks: DocumentChunk[] = [];

    for (const semanticChunk of semanticChunks) {
      if (semanticChunk.content.length > this.maxChunkSize) {
        // If semantic chunk is too large, apply fixed chunking
        const subChunks = this.createFixedChunks(semanticChunk.content, document);
        finalChunks.push(...subChunks);
      } else {
        finalChunks.push(semanticChunk);
      }
    }

    // Renumber chunks
    finalChunks.forEach((chunk, index) => {
      chunk.index = index;
    });

    return finalChunks;
  }

  /**
   * Create a chunk object
   */
  private createChunk(content: string, index: number, document: Document): DocumentChunk {
    return {
      id: this.generateId(),
      parentDocumentId: document.id,
      chunkIndex: index,
      index, // Compatibility
      source: document.source,
      content: content.trim(),
      metadata: {
        documentTitle: document.title,
        documentSource: document.source,
        chunkLength: content.length,
        tokenCount: this.estimateTokenCount(content),
        createdAt: new Date().toISOString(),
        type: document.metadata.type, // Ensure required type is present
        documentType: document.metadata.type
      },
      embedding: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Detect document language
   */
  private detectLanguage(content: string): Language {
    // Simple language detection based on character patterns
    const text = content.toLowerCase().substring(0, 1000);

    const patterns: { [key in Language]: RegExp } = {
      [Language.ENGLISH]: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/,
      [Language.SPANISH]: /\b(el|la|y|o|pero|en|de|para|con|por)\b/,
      [Language.FRENCH]: /\b(le|la|et|mais|dans|de|pour|avec|par)\b/,
      [Language.GERMAN]: /\b(der|die|das|und|oder|aber|in|an|zu|für|mit|von)\b/,
      [Language.ITALIAN]: /\b(il|la|e|ma|in|di|per|con|da)\b/,
      [Language.PORTUGUESE]: /\b(o|a|e|mas|em|de|para|com|por)\b/,
      [Language.CHINESE]: /[\u4e00-\u9fff]/,
      [Language.JAPANESE]: /[\u3040-\u309f\u30a0-\u30ff]/
    };

    let detectedLanguage = Language.ENGLISH;
    let maxMatches = 0;

    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = (text.match(pattern) || []).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLanguage = lang as Language;
      }
    }

    return detectedLanguage;
  }

  /**
   * Detect document type
   */
  private detectDocumentType(content: string, providedType?: DocumentType): DocumentType {
    if (providedType && providedType !== DocumentType.UNKNOWN) {
      return providedType;
    }

    const text = content.toLowerCase();

    if (text.includes('<!doctype') || text.includes('<html')) {
      return DocumentType.HTML;
    }

    if (text.includes('# ') || text.includes('## ') || text.includes('### ')) {
      return DocumentType.MARKDOWN;
    }

    if (text.includes('{') && text.includes('"') && text.includes(':')) {
      return DocumentType.JSON;
    }

    if (text.includes('abstract') || text.includes('introduction') || text.includes('conclusion')) {
      return DocumentType.ACADEMIC;
    }

    if (text.includes('```') || text.includes('function') || text.includes('class ')) {
      return DocumentType.CODE;
    }

    return DocumentType.PLAIN_TEXT;
  }

  /**
   * Preprocess text content
   */
  private preprocessText(content: string, language: Language): string {
    let processed = content;

    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ');
    processed = processed.replace(/\n\s*\n/g, '\n\n');

    // Language-specific preprocessing
    switch (language) {
      case Language.ENGLISH:
        processed = this.preprocessEnglish(processed);
        break;
      case Language.CHINESE:
      case Language.JAPANESE:
        processed = this.preprocessCJK(processed);
        break;
    }

    return processed.trim();
  }

  /**
   * English text preprocessing
   */
  private preprocessEnglish(content: string): string {
    // Remove extra whitespace around punctuation
    return content.replace(/\s+([.,;:!?])/g, '$1');
  }

  /**
   * Chinese/Japanese/Korean text preprocessing
   */
  private preprocessCJK(content: string): string {
    // Add spacing between CJK and Latin characters for better processing
    return content.replace(/([^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff])([\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff])/g, '$1 $2');
  }

  /**
   * Extract entities from text
   */
  public async extractEntities(text: string, language: Language): Promise<TextEntity[]> {
    const extractor = this.entityExtractors.get(language);
    if (extractor) {
      return extractor(text);
    }

    // Basic entity extraction
    return this.extractBasicEntities(text);
  }

  /**
   * Extract keywords from text
   */
  public async extractKeywords(text: string, language: Language, limit: number = 10): Promise<string[]> {
    const extractor = this.keywordExtractors.get(language);
    if (extractor) {
      return extractor(text, limit);
    }

    // Basic keyword extraction using TF-IDF-like approach
    return this.extractBasicKeywords(text, limit);
  }

  /**
   * Basic entity extraction
   */
  private extractBasicEntities(text: string): TextEntity[] {
    const entities: TextEntity[] = [];

    // Email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    emails.forEach(email => {
      entities.push({
        text: email,
        type: 'email',
        confidence: 0.9,
        startPosition: text.indexOf(email),
        endPosition: text.indexOf(email) + email.length
      });
    });

    // URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    urls.forEach(url => {
      entities.push({
        text: url,
        type: 'url',
        confidence: 0.95,
        startPosition: text.indexOf(url),
        endPosition: text.indexOf(url) + url.length
      });
    });

    // Phone numbers (basic pattern)
    const phoneRegex = /\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b/g;
    const phones = text.match(phoneRegex) || [];
    phones.forEach(phone => {
      entities.push({
        text: phone,
        type: 'phone',
        confidence: 0.8,
        startPosition: text.indexOf(phone),
        endPosition: text.indexOf(phone) + phone.length
      });
    });

    return entities;
  }

  /**
   * Basic keyword extraction
   */
  private extractBasicKeywords(text: string, limit: number = 10): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Count word frequencies
    const frequencies = new Map<string, number>();
    words.forEach(word => {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    });

    // Sort by frequency and return top keywords
    return Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }

  /**
   * Extract topic from paragraph
   */
  private extractTopic(paragraph: string, language: Language): string {
    const sentences = this.splitIntoSentences(paragraph);
    if (sentences.length === 0) return '';

    // Use first sentence as topic indicator
    const firstSentence = sentences[0].toLowerCase();
    const words = firstSentence.split(/\s+/);

    // Remove stop words and return significant words
    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const topicWords = words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 3);

    return topicWords.join(' ');
  }

  /**
   * Calculate coherence between text segments
   */
  private calculateCoherence(
    currentChunk: string,
    newParagraph: string,
    currentTopic: string,
    newTopic: string
  ): number {
    if (!currentTopic || !newTopic) return 0.5;

    // Simple coherence calculation based on topic similarity
    const currentWords = new Set(currentTopic.toLowerCase().split(' '));
    const newWords = new Set(newTopic.toLowerCase().split(' '));

    const intersection = new Set([...currentWords].filter(word => newWords.has(word)));
    const union = new Set([...currentWords, ...newWords]);

    return intersection.size / union.size;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }

  /**
   * Estimate token count
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate document statistics
   */
  private calculateStatistics(content: string, chunks: DocumentChunk[]) {
    const chunkLengths = chunks.map(chunk => chunk.content.length);

    return {
      totalChunks: chunks.length,
      averageChunkLength: chunkLengths.reduce((a, b) => a + b, 0) / chunkLengths.length || 0,
      minChunkLength: Math.min(...chunkLengths) || 0,
      maxChunkLength: Math.max(...chunkLengths) || 0,
      totalTokens: this.estimateTokenCount(content)
    };
  }

  /**
   * Initialize default extractors
   */
  private initializeDefaultExtractors(): void {
    // Add default entity extractors for supported languages
    this.entityExtractors.set(Language.ENGLISH, this.extractBasicEntities.bind(this));
    this.entityExtractors.set(Language.SPANISH, this.extractBasicEntities.bind(this));

    // Add default keyword extractors for supported languages
    this.keywordExtractors.set(Language.ENGLISH, this.extractBasicKeywords.bind(this));
    this.keywordExtractors.set(Language.SPANISH, this.extractBasicKeywords.bind(this));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update processor options
   */
  updateOptions(options: Partial<ProcessingOptions>): void {
    if (options.chunkSize) this.chunkSize = options.chunkSize;
    if (options.chunkOverlap) this.chunkOverlap = options.chunkOverlap;
    if (options.minChunkSize) this.minChunkSize = options.minChunkSize;
    if (options.maxChunkSize) this.maxChunkSize = options.maxChunkSize;
    if (options.supportedLanguages) {
      this.supportedLanguages = new Set(options.supportedLanguages);
    }
  }

  /**
   * Get supported chunking strategies
   */
  getSupportedStrategies(): ChunkingStrategy[] {
    return Object.values(ChunkingStrategy);
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Language[] {
    return Array.from(this.supportedLanguages);
  }
}
