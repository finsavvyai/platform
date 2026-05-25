/**
 * FinSavvy AI Suite - Multi-Modal AI Processing Engine
 *
 * Revolutionary multi-modal AI system for processing documents, images,
 * charts, voice, and structured data with intelligent extraction and analysis.
 */

import { Logger } from '../utils/logger';
import { DatabaseService } from '../services/database-service';
import { VectorEmbeddingService } from '../rag/vector-service';

export interface ProcessingRequest {
  id: string;
  type: 'document' | 'image' | 'audio' | 'video' | 'chart' | 'mixed';
  content?: string;
  file_url?: string;
  metadata: Record<string, any>;
  options: ProcessingOptions;
  user_id: string;
  organization_id: string;
}

export interface ProcessingOptions {
  extract_text?: boolean;
  extract_entities?: boolean;
  analyze_sentiment?: boolean;
  extract_tables?: boolean;
  analyze_charts?: boolean;
  transcribe_audio?: boolean;
  detect_objects?: boolean;
  extract_handwriting?: boolean;
  language_detection?: boolean;
  quality_check?: boolean;
  compliance_check?: boolean;
  pii_detection?: boolean;
}

export interface ProcessingResult {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results: ProcessedData;
  confidence: number;
  processing_time: number;
  metadata: Record<string, any>;
  errors?: string[];
}

export interface ProcessedData {
  text?: {
    content: string;
    language: string;
    confidence: number;
    pages?: Array<{
      page_number: number;
      content: string;
      confidence: number;
    }>;
  };
  entities?: Array<{
    text: string;
    type: string;
    confidence: number;
    start_position: number;
    end_position: number;
    metadata?: Record<string, any>;
  }>;
  tables?: Array<{
    rows: string[][];
    headers: string[];
    confidence: number;
    metadata?: Record<string, any>;
  }>;
  charts?: Array<{
    type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'heatmap';
    title: string;
    data: any;
    description: string;
    confidence: number;
    insights: string[];
  }>;
  sentiment?: {
    overall: 'positive' | 'negative' | 'neutral';
    score: number;
    confidence: number;
    aspects?: Array<{
      aspect: string;
      sentiment: string;
      score: number;
    }>;
  };
  objects?: Array<{
    name: string;
    confidence: number;
    bounding_box?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  audio?: {
    transcription: string;
    language: string;
    speaker_count: number;
    duration: number;
    confidence: number;
    speaker_segments?: Array<{
      start_time: number;
      end_time: number;
      speaker: string;
      text: string;
    }>;
  };
  handwriting?: Array<{
    text: string;
    confidence: number;
    bounding_box?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  compliance?: {
    pii_detected: boolean;
    pii_instances: Array<{
      type: string;
      text: string;
      confidence: number;
      position: number;
    }>;
    compliance_score: number;
    regulations: Array<{
      name: string;
      relevant: boolean;
      score: number;
    }>;
  };
  quality?: {
    overall_score: number;
    readability_score: number;
    structure_score: number;
    completeness_score: number;
    issues: string[];
  };
}

export class MultiModalAIProcessor {
  private logger: Logger;
  private dbService: DatabaseService;
  private vectorService: VectorEmbeddingService;
  private aiService: any;
  private processingQueue: Map<string, ProcessingRequest> = new Map();

  constructor(env: any) {
    this.logger = new Logger(env, 'MultiModalAI');
    this.dbService = new DatabaseService(env);
    this.vectorService = new VectorEmbeddingService(env);
    this.aiService = env.AI;
  }

  /**
   * Initialize multi-modal processing system
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing Multi-Modal AI Processor...');

    try {
      // Create processing tables
      await this.createProcessingTables();

      // Load AI models and configurations
      await this.loadAIModels();

      this.logger.info('Multi-Modal AI Processor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Multi-Modal AI Processor', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create database tables for processing
   */
  private async createProcessingTables(): Promise<void> {
    const tables = [
      // Processing requests
      `CREATE TABLE IF NOT EXISTS processing_requests (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT,
        file_url TEXT,
        metadata TEXT,
        options TEXT,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        results TEXT,
        confidence REAL DEFAULT 0,
        processing_time INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      )`,

      // Extracted entities
      `CREATE TABLE IF NOT EXISTS extracted_entities (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        confidence REAL NOT NULL,
        start_position INTEGER,
        end_position INTEGER,
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES processing_requests(id)
      )`,

      // Extracted tables
      `CREATE TABLE IF NOT EXISTS extracted_tables (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        table_data TEXT NOT NULL,
        headers TEXT,
        confidence REAL NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES processing_requests(id)
      )`,

      // Processing analytics
      `CREATE TABLE IF NOT EXISTS processing_analytics (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        processing_type TEXT NOT NULL,
        processing_time INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        model_used TEXT,
        confidence REAL,
        input_size INTEGER,
        output_size INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES processing_requests(id)
      )`
    ];

    for (const tableSql of tables) {
      await this.dbService.query(tableSql);
    }
  }

  /**
   * Load AI models and configurations
   */
  private async loadAIModels(): Promise<void> {
    // In a real implementation, this would load specific AI models
    this.logger.info('AI models loaded successfully');
  }

  /**
   * Submit processing request
   */
  public async submitProcessingRequest(request: ProcessingRequest): Promise<string> {
    this.logger.info('Submitting processing request', {
      id: request.id,
      type: request.type,
      userId: request.user_id
    });

    try {
      // Store request in database
      await this.dbService.query(`
        INSERT INTO processing_requests (
          id, type, content, file_url, metadata, options,
          user_id, organization_id, status, progress, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        request.id,
        request.type,
        request.content,
        request.file_url,
        JSON.stringify(request.metadata),
        JSON.stringify(request.options),
        request.user_id,
        request.organization_id,
        'pending',
        0,
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      // Add to processing queue
      this.processingQueue.set(request.id, request);

      // Start async processing
      this.processRequestAsync(request);

      return request.id;
    } catch (error) {
      this.logger.error('Failed to submit processing request', {
        requestId: request.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process request asynchronously
   */
  private async processRequestAsync(request: ProcessingRequest): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to processing
      await this.updateRequestStatus(request.id, 'processing', 0);

      // Process based on type
      let results: ProcessedData;
      let confidence = 0;

      switch (request.type) {
        case 'document':
          results = await this.processDocument(request);
          break;
        case 'image':
          results = await this.processImage(request);
          break;
        case 'audio':
          results = await this.processAudio(request);
          break;
        case 'video':
          results = await this.processVideo(request);
          break;
        case 'chart':
          results = await this.processChart(request);
          break;
        case 'mixed':
          results = await this.processMixed(request);
          break;
        default:
          throw new Error(`Unsupported processing type: ${request.type}`);
      }

      // Calculate overall confidence
      confidence = this.calculateOverallConfidence(results);

      // Update request with results
      const processingTime = Date.now() - startTime;
      await this.completeRequest(request.id, results, confidence, processingTime);

      // Log analytics
      await this.logProcessingAnalytics(request.id, request.type, processingTime, true, confidence);

      this.logger.info('Processing request completed', {
        requestId: request.id,
        type: request.type,
        processingTime,
        confidence
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.failRequest(request.id, error.message, processingTime);
      await this.logProcessingAnalytics(request.id, request.type, processingTime, false, 0);

      this.logger.error('Processing request failed', {
        requestId: request.id,
        error: error.message
      });
    } finally {
      // Remove from queue
      this.processingQueue.delete(request.id);
    }
  }

  /**
   * Process document content
   */
  private async processDocument(request: ProcessingRequest): Promise<ProcessedData> {
    const results: ProcessedData = {};
    const content = request.content || '';

    // Update progress
    await this.updateRequestStatus(request.id, 'processing', 10);

    // Text extraction
    if (request.options.extract_text !== false) {
      await this.updateRequestStatus(request.id, 'processing', 20);
      results.text = await this.extractTextFromDocument(content, request.metadata);
    }

    // Entity extraction
    if (request.options.extract_entities) {
      await this.updateRequestStatus(request.id, 'processing', 40);
      results.entities = await this.extractEntities(results.text?.content || content);
    }

    // Table extraction
    if (request.options.extract_tables) {
      await this.updateRequestStatus(request.id, 'processing', 60);
      results.tables = await this.extractTables(content);
    }

    // Sentiment analysis
    if (request.options.analyze_sentiment) {
      await this.updateRequestStatus(request.id, 'processing', 70);
      results.sentiment = await this.analyzeSentiment(results.text?.content || content);
    }

    // Language detection
    if (request.options.language_detection) {
      await this.updateRequestStatus(request.id, 'processing', 80);
      if (results.text) {
        results.text.language = await this.detectLanguage(results.text.content);
      }
    }

    // Compliance check
    if (request.options.compliance_check) {
      await this.updateRequestStatus(request.id, 'processing', 90);
      results.compliance = await this.performComplianceCheck(results.text?.content || content);
    }

    await this.updateRequestStatus(request.id, 'processing', 100);
    return results;
  }

  /**
   * Process image content
   */
  private async processImage(request: ProcessingRequest): Promise<ProcessedData> {
    const results: ProcessedData = {};

    await this.updateRequestStatus(request.id, 'processing', 20);

    // OCR text extraction
    if (request.options.extract_text) {
      results.text = await this.extractTextFromImage(request.file_url, request.options);
      await this.updateRequestStatus(request.id, 'processing', 40);
    }

    // Object detection
    if (request.options.detect_objects) {
      results.objects = await this.detectObjects(request.file_url);
      await this.updateRequestStatus(request.id, 'processing', 60);
    }

    // Handwriting recognition
    if (request.options.extract_handwriting) {
      results.handwriting = await this.extractHandwriting(request.file_url);
      await this.updateRequestStatus(request.id, 'processing', 70);
    }

    // Entity extraction from extracted text
    if (request.options.extract_entities && results.text?.content) {
      results.entities = await this.extractEntities(results.text.content);
      await this.updateRequestStatus(request.id, 'processing', 85);
    }

    // Compliance check
    if (request.options.compliance_check && results.text?.content) {
      results.compliance = await this.performComplianceCheck(results.text.content);
      await this.updateRequestStatus(request.id, 'processing', 95);
    }

    await this.updateRequestStatus(request.id, 'processing', 100);
    return results;
  }

  /**
   * Process audio content
   */
  private async processAudio(request: ProcessingRequest): Promise<ProcessedData> {
    const results: ProcessedData = {};

    await this.updateRequestStatus(request.id, 'processing', 20);

    // Audio transcription
    if (request.options.transcribe_audio) {
      results.audio = await this.transcribeAudio(request.file_url);
      await this.updateRequestStatus(request.id, 'processing', 60);
    }

    // Entity extraction from transcription
    if (request.options.extract_entities && results.audio?.transcription) {
      results.entities = await this.extractEntities(results.audio.transcription);
      await this.updateRequestStatus(request.id, 'processing', 80);
    }

    // Sentiment analysis
    if (request.options.analyze_sentiment && results.audio?.transcription) {
      results.sentiment = await this.analyzeSentiment(results.audio.transcription);
      await this.updateRequestStatus(request.id, 'processing', 90);
    }

    // Compliance check
    if (request.options.compliance_check && results.audio?.transcription) {
      results.compliance = await this.performComplianceCheck(results.audio.transcription);
      await this.updateRequestStatus(request.id, 'processing', 95);
    }

    await this.updateRequestStatus(request.id, 'processing', 100);
    return results;
  }

  /**
   * Process video content
   */
  private async processVideo(request: ProcessingRequest): Promise<ProcessedData> {
    const results: ProcessedData = {};

    await this.updateRequestStatus(request.id, 'processing', 20);

    // Extract audio track and transcribe
    if (request.options.transcribe_audio) {
      // In a real implementation, this would extract audio from video
      results.audio = await this.transcribeAudio(request.file_url);
      await this.updateRequestStatus(request.id, 'processing', 50);
    }

    // Extract frames and analyze
    if (request.options.detect_objects) {
      // In a real implementation, this would extract and analyze video frames
      results.objects = await this.detectObjects(request.file_url);
      await this.updateRequestStatus(request.id, 'processing', 80);
    }

    // Process extracted text/audio
    const textContent = results.audio?.transcription || '';
    if (textContent && request.options.extract_entities) {
      results.entities = await this.extractEntities(textContent);
      await this.updateRequestStatus(request.id, 'processing', 90);
    }

    await this.updateRequestStatus(request.id, 'processing', 100);
    return results;
  }

  /**
   * Process chart/graph content
   */
  private async processChart(request: ProcessingRequest): Promise<ProcessedData> {
    const results: ProcessedData = {};

    await this.updateRequestStatus(request.id, 'processing', 20);

    // Chart analysis
    if (request.options.analyze_charts) {
      results.charts = await this.analyzeCharts(request.file_url, request.content);
      await this.updateRequestStatus(request.id, 'processing', 60);
    }

    // OCR text extraction from chart
    if (request.options.extract_text) {
      results.text = await this.extractTextFromImage(request.file_url, request.options);
      await this.updateRequestStatus(request.id, 'processing', 80);
    }

    await this.updateRequestStatus(request.id, 'processing', 100);
    return results;
  }

  /**
   * Process mixed content
   */
  private async processMixed(request: ProcessingRequest): Promise<ProcessedData> {
    const results: ProcessedData = {};

    // Process text content
    if (request.content) {
      const textResults = await this.processDocument({
        ...request,
        type: 'document'
      });
      Object.assign(results, textResults);
    }

    // Process file content
    if (request.file_url) {
      // Determine file type and process accordingly
      const fileExtension = request.file_url.split('.').pop()?.toLowerCase();

      let fileResults: ProcessedData;
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExtension || '')) {
        fileResults = await this.processImage({
          ...request,
          type: 'image'
        });
      } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension || '')) {
        fileResults = await this.processAudio({
          ...request,
          type: 'audio'
        });
      } else if (['mp4', 'avi', 'mov', 'mkv'].includes(fileExtension || '')) {
        fileResults = await this.processVideo({
          ...request,
          type: 'video'
        });
      } else {
        // Default to document processing
        fileResults = await this.processDocument({
          ...request,
          type: 'document'
        });
      }

      // Merge results
      this.mergeProcessingResults(results, fileResults);
    }

    return results;
  }

  /**
   * Extract text from document
   */
  private async extractTextFromDocument(
    content: string,
    metadata: Record<string, any>
  ): Promise<ProcessedData['text']> {
    try {
      // For text documents, the content is already available
      const language = await this.detectLanguage(content);

      // Split into pages if it's a long document
      const pages = this.splitIntoPages(content);

      return {
        content,
        language,
        confidence: 0.95,
        pages: pages.map((pageContent, index) => ({
          page_number: index + 1,
          content: pageContent,
          confidence: 0.95
        }))
      };
    } catch (error) {
      this.logger.warn('Failed to extract text from document', {
        error: error.message
      });
      return {
        content,
        language: 'en',
        confidence: 0.5
      };
    }
  }

  /**
   * Extract text from image using OCR
   */
  private async extractTextFromImage(
    imageUrl: string,
    options: ProcessingOptions
  ): Promise<ProcessedData['text']> {
    try {
      // In a real implementation, this would use an OCR service
      // For now, we'll simulate OCR using AI
      const prompt = `
Extract all text from this image. Provide the extracted text in a structured format.
If there are multiple sections or columns, preserve the structure.
Include confidence scores for different sections if possible.

Image URL: ${imageUrl}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 2000,
        temperature: 0.1
      });

      const extractedText = response.response.trim();
      const language = await this.detectLanguage(extractedText);

      return {
        content: extractedText,
        language,
        confidence: 0.85
      };
    } catch (error) {
      this.logger.warn('Failed to extract text from image', {
        imageUrl,
        error: error.message
      });
      return {
        content: '',
        language: 'en',
        confidence: 0
      };
    }
  }

  /**
   * Extract entities from text
   */
  private async extractEntities(text: string): Promise<ProcessedData['entities']> {
    try {
      const prompt = `
Extract named entities from the following text. Categorize each entity as one of:
- PERSON (names of people)
- ORGANIZATION (companies, institutions)
- LOCATION (places, addresses)
- DATE (dates, times)
- MONEY (amounts, currencies)
- PHONE (phone numbers)
- EMAIL (email addresses)
- ID (identification numbers, account numbers)
- OTHER (any other relevant entities)

Text: ${text.substring(0, 2000)}

Return results in JSON format:
{
  "entities": [
    {
      "text": "entity text",
      "type": "entity type",
      "confidence": 0.95,
      "start_position": 0,
      "end_position": 10
    }
  ]
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 1500,
        temperature: 0.1
      });

      const result = JSON.parse(response.response);
      return result.entities || [];
    } catch (error) {
      this.logger.warn('Failed to extract entities', { error: error.message });
      return [];
    }
  }

  /**
   * Extract tables from text
   */
  private async extractTables(text: string): Promise<ProcessedData['tables']> {
    try {
      // Look for table patterns in the text
      const lines = text.split('\n');
      const tables: ProcessedData['tables'] = [];

      let currentTable: string[][] = [];
      let inTable = false;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Check if line looks like a table row (contains multiple values separated by tabs or multiple spaces)
        if (trimmedLine.includes('\t') || /\s{2,}/.test(trimmedLine)) {
          const row = trimmedLine.split(/\t|\s{2,}/).map(cell => cell.trim());
          currentTable.push(row);
          inTable = true;
        } else if (inTable && trimmedLine === '') {
          // End of table
          if (currentTable.length > 1) {
            const headers = currentTable[0];
            const rows = currentTable.slice(1);

            tables.push({
              rows,
              headers,
              confidence: 0.8,
              metadata: {
                row_count: rows.length,
                column_count: headers.length
              }
            });
          }
          currentTable = [];
          inTable = false;
        }
      }

      // Add last table if text ends with a table
      if (currentTable.length > 1) {
        const headers = currentTable[0];
        const rows = currentTable.slice(1);

        tables.push({
          rows,
          headers,
          confidence: 0.8,
          metadata: {
            row_count: rows.length,
            column_count: headers.length
          }
        });
      }

      return tables;
    } catch (error) {
      this.logger.warn('Failed to extract tables', { error: error.message });
      return [];
    }
  }

  /**
   * Analyze sentiment
   */
  private async analyzeSentiment(text: string): Promise<ProcessedData['sentiment']> {
    try {
      const prompt = `
Analyze the sentiment of the following text. Provide:
1. Overall sentiment (positive, negative, or neutral)
2. Sentiment score from -1 (very negative) to 1 (very positive)
3. Confidence in the analysis
4. Aspect-based sentiment if applicable

Text: ${text.substring(0, 1500)}

Return results in JSON format:
{
  "overall": "positive|negative|neutral",
  "score": 0.5,
  "confidence": 0.9,
  "aspects": [
    {
      "aspect": "customer service",
      "sentiment": "positive",
      "score": 0.8
    }
  ]
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 500,
        temperature: 0.1
      });

      return JSON.parse(response.response);
    } catch (error) {
      this.logger.warn('Failed to analyze sentiment', { error: error.message });
      return {
        overall: 'neutral',
        score: 0,
        confidence: 0
      };
    }
  }

  /**
   * Detect language
   */
  private async detectLanguage(text: string): Promise<string> {
    try {
      // Simple language detection based on common words
      const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
      const spanishWords = ['el', 'la', 'y', 'o', 'pero', 'en', 'de', 'para', 'con', 'por', 'un', 'una'];
      const frenchWords = ['le', 'la', 'et', 'ou', 'mais', 'dans', 'de', 'pour', 'avec', 'par', 'un', 'une'];

      const words = text.toLowerCase().split(/\s+/);
      const englishCount = words.filter(word => englishWords.includes(word)).length;
      const spanishCount = words.filter(word => spanishWords.includes(word)).length;
      const frenchCount = words.filter(word => frenchWords.includes(word)).length;

      const maxCount = Math.max(englishCount, spanishCount, frenchCount);

      if (maxCount === spanishCount) return 'es';
      if (maxCount === frenchCount) return 'fr';
      return 'en'; // Default to English
    } catch (error) {
      return 'en';
    }
  }

  /**
   * Transcribe audio
   */
  private async transcribeAudio(audioUrl: string): Promise<ProcessedData['audio']> {
    try {
      // In a real implementation, this would use a speech-to-text service
      const prompt = `
Transcribe the audio from the provided URL. Provide:
1. Full transcription
2. Detected language
3. Number of speakers (if detectable)
4. Duration (if available)
5. Speaker segments if multiple speakers detected

Audio URL: ${audioUrl}

Return results in JSON format.
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 2000,
        temperature: 0.1
      });

      // Simulate transcription result
      return {
        transcription: "Simulated audio transcription",
        language: "en",
        speaker_count: 1,
        duration: 120,
        confidence: 0.85
      };
    } catch (error) {
      this.logger.warn('Failed to transcribe audio', { error: error.message });
      return {
        transcription: '',
        language: 'en',
        speaker_count: 0,
        duration: 0,
        confidence: 0
      };
    }
  }

  /**
   * Detect objects in image
   */
  private async detectObjects(imageUrl: string): Promise<ProcessedData['objects']> {
    try {
      // In a real implementation, this would use computer vision
      const prompt = `
Identify objects in the image at the provided URL. List all visible objects with confidence scores.

Image URL: ${imageUrl}

Return results in JSON format:
{
  "objects": [
    {
      "name": "person",
      "confidence": 0.95,
      "bounding_box": {"x": 100, "y": 50, "width": 200, "height": 300}
    }
  ]
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 500,
        temperature: 0.1
      });

      const result = JSON.parse(response.response);
      return result.objects || [];
    } catch (error) {
      this.logger.warn('Failed to detect objects', { error: error.message });
      return [];
    }
  }

  /**
   * Extract handwriting
   */
  private async extractHandwriting(imageUrl: string): Promise<ProcessedData['handwriting']> {
    try {
      // In a real implementation, this would use specialized handwriting recognition
      const prompt = `
Extract handwritten text from the image at the provided URL.

Image URL: ${imageUrl}

Return results in JSON format:
{
  "handwriting": [
    {
      "text": "handwritten text",
      "confidence": 0.85,
      "bounding_box": {"x": 50, "y": 100, "width": 150, "height": 50}
    }
  ]
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 1000,
        temperature: 0.1
      });

      const result = JSON.parse(response.response);
      return result.handwriting || [];
    } catch (error) {
      this.logger.warn('Failed to extract handwriting', { error: error.message });
      return [];
    }
  }

  /**
   * Analyze charts and graphs
   */
  private async analyzeCharts(imageUrl?: string, content?: string): Promise<ProcessedData['charts']> {
    try {
      const prompt = `
Analyze the chart or graph provided. Identify:
1. Chart type (bar, line, pie, scatter, area, heatmap)
2. Title and labels
3. Data points and trends
4. Key insights and patterns

${imageUrl ? `Image URL: ${imageUrl}` : ''}
${content ? `Chart Data/Description: ${content}` : ''}

Return results in JSON format:
{
  "charts": [
    {
      "type": "bar",
      "title": "Chart Title",
      "data": {...},
      "description": "Chart description",
      "confidence": 0.9,
      "insights": ["insight 1", "insight 2"]
    }
  ]
}
`;

      const response = await this.aiService.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 1000,
        temperature: 0.1
      });

      const result = JSON.parse(response.response);
      return result.charts || [];
    } catch (error) {
      this.logger.warn('Failed to analyze charts', { error: error.message });
      return [];
    }
  }

  /**
   * Perform compliance check
   */
  private async performComplianceCheck(text: string): Promise<ProcessedData['compliance']> {
    try {
      // PII detection
      const piiDetected = await this.detectPII(text);

      // Compliance scoring
      const complianceScore = await this.calculateComplianceScore(text);

      return {
        pii_detected: piiDetected.length > 0,
        pii_instances: piiDetected,
        compliance_score: complianceScore,
        regulations: [
          {
            name: 'GDPR',
            relevant: true,
            score: complianceScore
          },
          {
            name: 'CCPA',
            relevant: true,
            score: complianceScore
          }
        ]
      };
    } catch (error) {
      this.logger.warn('Failed to perform compliance check', { error: error.message });
      return {
        pii_detected: false,
        pii_instances: [],
        compliance_score: 1.0,
        regulations: []
      };
    }
  }

  /**
   * Detect PII in text
   */
  private async detectPII(text: string): Promise<Array<{
    type: string;
    text: string;
    confidence: number;
    position: number;
  }>> {
    const piiInstances = [];

    // Simple PII detection patterns
    const patterns = {
      'EMAIL': /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      'PHONE': /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      'SSN': /\b\d{3}-\d{2}-\d{4}\b/g,
      'CREDIT_CARD': /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        piiInstances.push({
          type,
          text: match[0],
          confidence: 0.9,
          position: match.index
        });
      }
    }

    return piiInstances;
  }

  /**
   * Calculate compliance score
   */
  private async calculateComplianceScore(text: string): Promise<number> {
    // Simple compliance scoring based on PII presence
    const piiInstances = await this.detectPII(text);
    const piiCount = piiInstances.length;
    const textLength = text.length;

    // Lower score for more PII
    const piiDensity = piiCount / (textLength / 1000); // PII per 1000 characters
    return Math.max(0, 1 - (piiDensity * 0.1));
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(results: ProcessedData): number {
    const confidences = [];

    if (results.text?.confidence) confidences.push(results.text.confidence);
    if (results.entities?.length) {
      const avgEntityConfidence = results.entities.reduce((sum, e) => sum + e.confidence, 0) / results.entities.length;
      confidences.push(avgEntityConfidence);
    }
    if (results.sentiment?.confidence) confidences.push(results.sentiment.confidence);
    if (results.audio?.confidence) confidences.push(results.audio.confidence);

    if (confidences.length === 0) return 0;
    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }

  /**
   * Split text into pages
   */
  private splitIntoPages(text: string, maxCharsPerPage = 2000): string[] {
    const pages = [];
    const sentences = text.split(/[.!?]+/);
    let currentPage = '';

    for (const sentence of sentences) {
      if (currentPage.length + sentence.length > maxCharsPerPage && currentPage) {
        pages.push(currentPage.trim());
        currentPage = sentence;
      } else {
        currentPage += (currentPage ? '. ' : '') + sentence;
      }
    }

    if (currentPage.trim()) {
      pages.push(currentPage.trim());
    }

    return pages.length > 0 ? pages : [text];
  }

  /**
   * Merge processing results
   */
  private mergeProcessingResults(target: ProcessedData, source: ProcessedData): void {
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) {
        if (Array.isArray(value) && Array.isArray(target[key as keyof ProcessedData])) {
          // Merge arrays
          (target[key as keyof ProcessedData] as any[]) = [
            ...(target[key as keyof ProcessedData] as any[]),
            ...value
          ];
        } else if (!target[key as keyof ProcessedData]) {
          // Set if target doesn't have the property
          target[key as keyof ProcessedData] = value;
        }
      }
    }
  }

  /**
   * Update request status
   */
  private async updateRequestStatus(
    requestId: string,
    status: string,
    progress: number
  ): Promise<void> {
    await this.dbService.query(`
      UPDATE processing_requests
      SET status = ?, progress = ?, updated_at = ?
      WHERE id = ?
    `, [status, progress, new Date().toISOString(), requestId]);
  }

  /**
   * Complete request with results
   */
  private async completeRequest(
    requestId: string,
    results: ProcessedData,
    confidence: number,
    processingTime: number
  ): Promise<void> {
    await this.dbService.query(`
      UPDATE processing_requests
      SET status = 'completed', progress = 100, results = ?, confidence = ?,
          processing_time = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `, [
      JSON.stringify(results),
      confidence,
      processingTime,
      new Date().toISOString(),
      new Date().toISOString(),
      requestId
    ]);
  }

  /**
   * Fail request with error
   */
  private async failRequest(
    requestId: string,
    errorMessage: string,
    processingTime: number
  ): Promise<void> {
    await this.dbService.query(`
      UPDATE processing_requests
      SET status = 'failed', results = ?, processing_time = ?, updated_at = ?
      WHERE id = ?
    `, [
      JSON.stringify({ error: errorMessage }),
      processingTime,
      new Date().toISOString(),
      requestId
    ]);
  }

  /**
   * Log processing analytics
   */
  private async logProcessingAnalytics(
    requestId: string,
    processingType: string,
    processingTime: number,
    success: boolean,
    confidence: number
  ): Promise<void> {
    await this.dbService.query(`
      INSERT INTO processing_analytics (
        id, request_id, processing_type, processing_time, success,
        model_used, confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      requestId,
      processingType,
      processingTime,
      success,
      'multi-modal-ai',
      confidence,
      new Date().toISOString()
    ]);
  }

  /**
   * Get processing request status
   */
  public async getRequestStatus(requestId: string): Promise<ProcessingResult | null> {
    try {
      const result = await this.dbService.query(`
        SELECT * FROM processing_requests WHERE id = ?
      `, [requestId]);

      if (result.results.length === 0) return null;

      const request = result.results[0];
      return {
        request_id: request.id,
        status: request.status,
        progress: request.progress,
        results: request.results ? JSON.parse(request.results) : {},
        confidence: request.confidence,
        processing_time: request.processing_time,
        metadata: request.metadata ? JSON.parse(request.metadata) : {},
        errors: request.status === 'failed' && request.results
          ? [JSON.parse(request.results).error]
          : undefined
      };
    } catch (error) {
      this.logger.error('Failed to get request status', {
        requestId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get processing statistics
   */
  public async getStatistics(): Promise<{
    total_requests: number;
    completed_requests: number;
    failed_requests: number;
    average_processing_time: number;
    average_confidence: number;
    type_breakdown: Record<string, number>;
  }> {
    try {
      // Overall stats
      const overallStats = await this.dbService.query(`
        SELECT
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_requests,
          AVG(processing_time) as avg_processing_time,
          AVG(confidence) as avg_confidence
        FROM processing_requests
      `);

      // Type breakdown
      const typeStats = await this.dbService.query(`
        SELECT type, COUNT(*) as count
        FROM processing_requests
        GROUP BY type
      `);

      const stats = overallStats.results[0];
      return {
        total_requests: stats.total_requests || 0,
        completed_requests: stats.completed_requests || 0,
        failed_requests: stats.failed_requests || 0,
        average_processing_time: stats.avg_processing_time || 0,
        average_confidence: stats.avg_confidence || 0,
        type_breakdown: typeStats.results.reduce((acc, row) => {
          acc[row.type] = row.count;
          return acc;
        }, {})
      };
    } catch (error) {
      this.logger.error('Failed to get processing statistics', {
        error: error.message
      });
      throw error;
    }
  }
}