/**
 * Multi-Modal AI Processing Engine
 *
 * Handles processing of various document types including:
 * - PDF documents with text and images
 * - Scanned documents and images
 * - Charts and graphs
 * - Voice/audio recordings
 * - Video content (frames and transcripts)
 * - Structured data (tables, forms)
 */

import {
  MultiModalRequest,
  MultiModalResult,
  DocumentType,
  ProcessingOptions,
  ExtractedContent,
  MediaContent,
  StructuredData
} from './types/multi-modal-types';

export class MultiModalProcessor {
  private ai: any; // Cloudflare Workers AI
  private r2: any; // Cloudflare R2 storage
  private logger: any;
  private config: ProcessingConfig;

  constructor(ai: any, r2: any, logger: any, config?: Partial<ProcessingConfig>) {
    this.ai = ai;
    this.r2 = r2;
    this.logger = logger;
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedFormats: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'mp3', 'wav', 'mp4', 'mov'],
      aiModels: {
        ocr: '@cf/unstructuredio/chinese-vision',
        imageAnalysis: '@cf/unstructuredio/chinese-vision',
        chartAnalysis: '@cf/unstructuredio/chinese-vision',
        speechToText: '@cf/openai/whisper-tiny-en',
        textEmbedding: '@cf/baai/bge-base-en-v1.5',
        classification: '@cf/meta/llama-3.1-8b-instruct',
        entityExtraction: '@cf/meta/llama-3.1-8b-instruct'
      },
      confidence: {
        minThreshold: 0.7,
        ocrThreshold: 0.8,
        entityThreshold: 0.75
      },
      ...config
    };
  }

  /**
   * Main processing method for multi-modal content
   */
  async process(request: MultiModalRequest): Promise<MultiModalResult> {
    const startTime = Date.now();

    this.logger?.info("Starting multi-modal processing", {
      requestId: request.id,
      documentType: request.documentType,
      contentSize: request.content?.length || 0
    });

    try {
      // Validate request
      this.validateRequest(request);

      // Detect content type if not provided
      const detectedType = await this.detectContentType(request);

      // Process based on content type
      let extractedContent: ExtractedContent;

      switch (detectedType) {
        case 'pdf':
          extractedContent = await this.processPDF(request);
          break;
        case 'image':
          extractedContent = await this.processImage(request);
          break;
        case 'scanned_document':
          extractedContent = await this.processScannedDocument(request);
          break;
        case 'chart':
          extractedContent = await this.processChart(request);
          break;
        case 'audio':
          extractedContent = await this.processAudio(request);
          break;
        case 'video':
          extractedContent = await this.processVideo(request);
          break;
        case 'structured_data':
          extractedContent = await this.processStructuredData(request);
          break;
        default:
          throw new Error(`Unsupported content type: ${detectedType}`);
      }

      // Generate embeddings for all extracted text
      const embeddings = await this.generateEmbeddings(extractedContent);

      // Extract entities and relationships
      const entities = await this.extractEntities(extractedContent.text);

      // Classify content
      const classification = await this.classifyContent(extractedContent);

      const processingTime = Date.now() - startTime;

      const result: MultiModalResult = {
        id: `mm_result_${request.id}`,
        requestId: request.id,
        documentType: detectedType,
        content: extractedContent,
        embeddings,
        entities,
        classification,
        metadata: {
          processingTime,
          confidence: this.calculateOverallConfidence(extractedContent),
          mediaCount: extractedContent.media?.length || 0,
          structuredDataCount: extractedContent.structuredData?.length || 0,
          textLength: extractedContent.text?.length || 0,
          extractedFields: extractedContent.extractedFields?.length || 0
        },
        status: 'completed'
      };

      this.logger?.info("Multi-modal processing completed", {
        requestId: request.id,
        processingTime,
        textLength: result.metadata.textLength,
        mediaCount: result.metadata.mediaCount
      });

      return result;

    } catch (error) {
      this.logger?.error("Multi-modal processing failed", {
        requestId: request.id,
        error: error.message,
        stack: error.stack
      });

      return {
        id: `mm_error_${request.id}`,
        requestId: request.id,
        documentType: request.documentType,
        content: null,
        embeddings: [],
        entities: [],
        classification: null,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0,
          mediaCount: 0,
          structuredDataCount: 0,
          textLength: 0,
          extractedFields: 0
        },
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Process PDF documents
   */
  private async processPDF(request: MultiModalRequest): Promise<ExtractedContent> {
    const content = request.content;
    const options = request.options || {};

    try {
      // Extract text using Workers AI
      const textExtraction = await this.ai.run(this.config.aiModels.ocr, {
        image: content,
        prompt: "Extract all text content from this PDF page. Preserve structure, headings, and formatting."
      });

      // Extract images from PDF
      const images = await this.extractImagesFromPDF(content);

      // Extract tables and structured data
      const tables = await this.extractTablesFromPDF(content);

      // Detect and process forms
      const forms = await this.extractFormsFromPDF(content);

      // Extract metadata
      const metadata = await this.extractPDFMetadata(content);

      return {
        text: textExtraction.text || '',
        media: images.map(img => ({
          type: 'image',
          content: img.data,
          metadata: {
            position: img.position,
            size: img.size,
            confidence: img.confidence,
            description: img.description
          }
        })),
        structuredData: [
          ...tables.map(table => ({
            type: 'table',
            data: table.data,
            metadata: {
              position: table.position,
              headers: table.headers,
              rowCount: table.rowCount,
              colCount: table.colCount,
              confidence: table.confidence
            }
          })),
          ...forms.map(form => ({
            type: 'form',
            data: form.fields,
            metadata: {
              position: form.position,
              fieldType: form.type,
              confidence: form.confidence
            }
          }))
        ],
        extractedFields: [
          ...this.extractKeyFields(textExtraction.text || ''),
          ...this.extractStructuredFields(tables, forms)
        ],
        metadata: {
          ...metadata,
          pageCount: metadata.pageCount || 1,
          hasImages: images.length > 0,
          hasTables: tables.length > 0,
          hasForms: forms.length > 0
        }
      };

    } catch (error) {
      this.logger?.error("PDF processing failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process images and scanned documents
   */
  private async processImage(request: MultiModalRequest): Promise<ExtractedContent> {
    const content = request.content;
    const options = request.options || {};

    try {
      // OCR text extraction
      const ocrResult = await this.ai.run(this.config.aiModels.ocr, {
        image: content,
        prompt: "Extract all text from this image. Include text in tables, forms, and any readable content."
      });

      // Image analysis and description
      const imageAnalysis = await this.ai.run(this.config.aiModels.imageAnalysis, {
        image: content,
        prompt: "Analyze this image and describe what it contains. Identify any charts, graphs, tables, forms, or other structured content."
      });

      // Extract structured data if present
      const structuredData = await this.extractStructuredDataFromImage(content, ocrResult.text);

      // Detect if this is a scanned document vs regular image
      const isScannedDoc = await this.detectScannedDocument(content, ocrResult.text, imageAnalysis);

      return {
        text: ocrResult.text || '',
        media: [{
          type: 'image',
          content: content,
          metadata: {
            description: imageAnalysis.description,
            isScannedDocument: isScannedDoc,
            confidence: ocrResult.confidence || 0.8,
            extractedElements: this.identifyImageElements(imageAnalysis)
          }
        }],
        structuredData: structuredData,
        extractedFields: this.extractKeyFields(ocrResult.text || ''),
        metadata: {
          imageType: this.detectImageType(content),
          isScannedDocument: isScannedDoc,
          hasText: (ocrResult.text || '').length > 0,
          hasStructuredData: structuredData.length > 0
        }
      };

    } catch (error) {
      this.logger?.error("Image processing failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process charts and graphs
   */
  private async processChart(request: MultiModalRequest): Promise<ExtractedContent> {
    const content = request.content;

    try {
      // Chart analysis
      const chartAnalysis = await this.ai.run(this.config.aiModels.chartAnalysis, {
        image: content,
        prompt: "Analyze this chart or graph. Extract the chart type, data points, labels, axes information, and any trends or patterns. Provide a detailed description of what the chart shows."
      });

      // Extract structured data from chart
      const chartData = await this.extractChartData(content, chartAnalysis);

      // Generate chart summary
      const summary = await this.generateChartSummary(chartAnalysis, chartData);

      return {
        text: chartAnalysis.description || '',
        media: [{
          type: 'chart',
          content: content,
          metadata: {
            chartType: chartData.type,
            title: chartData.title,
            axes: chartData.axes,
            dataPoints: chartData.dataPoints.length,
            trends: chartData.trends,
            confidence: chartAnalysis.confidence || 0.8,
            summary: summary
          }
        }],
        structuredData: [{
          type: 'chart_data',
          data: chartData,
          metadata: {
            extractedAt: new Date().toISOString(),
            confidence: chartAnalysis.confidence || 0.8
          }
        }],
        extractedFields: [
          { name: 'chart_title', value: chartData.title, confidence: 0.9 },
          { name: 'chart_type', value: chartData.type, confidence: 0.9 },
          { name: 'data_points_count', value: chartData.dataPoints.length.toString(), confidence: 1.0 }
        ],
        metadata: {
          chartType: chartData.type,
          hasData: chartData.dataPoints.length > 0,
          hasTrends: chartData.trends.length > 0
        }
      };

    } catch (error) {
      this.logger?.error("Chart processing failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process audio content
   */
  private async processAudio(request: MultiModalRequest): Promise<ExtractedContent> {
    const content = request.content;

    try {
      // Speech to text conversion
      const transcriptionResult = await this.ai.run(this.config.aiModels.speechToText, {
        audio: content
      });

      // Extract entities from transcribed text
      const entities = await this.extractEntities(transcriptionResult.text || '');

      // Analyze audio characteristics
      const audioAnalysis = await this.analyzeAudio(content);

      // Detect language
      const language = await this.detectLanguage(transcriptionResult.text || '');

      return {
        text: transcriptionResult.text || '',
        media: [{
          type: 'audio',
          content: content,
          metadata: {
            duration: audioAnalysis.duration,
            sampleRate: audioAnalysis.sampleRate,
            channels: audioAnalysis.channels,
            language: language,
            confidence: transcriptionResult.confidence || 0.8,
            speakerCount: audioAnalysis.speakerCount,
            hasBackgroundNoise: audioAnalysis.hasBackgroundNoise
          }
        }],
        structuredData: [],
        extractedFields: [
          { name: 'language', value: language, confidence: 0.9 },
          { name: 'duration', value: audioAnalysis.duration.toString(), confidence: 1.0 },
          { name: 'speaker_count', value: audioAnalysis.speakerCount.toString(), confidence: 0.8 }
        ],
        metadata: {
          audioType: this.detectAudioType(content),
          language: language,
          duration: audioAnalysis.duration,
          hasTranscription: (transcriptionResult.text || '').length > 0
        }
      };

    } catch (error) {
      this.logger?.error("Audio processing failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process video content
   */
  private async processVideo(request: MultiModalRequest): Promise<ExtractedContent> {
    const content = request.content;

    try {
      // Extract audio track
      const audioTrack = await this.extractAudioFromVideo(content);

      // Extract key frames
      const keyFrames = await this.extractKeyFrames(content);

      // Transcribe audio
      let transcription = '';
      if (audioTrack) {
        const transcriptionResult = await this.ai.run(this.config.aiModels.speechToText, {
          audio: audioTrack
        });
        transcription = transcriptionResult.text || '';
      }

      // Analyze key frames
      const frameAnalyses = await Promise.all(
        keyFrames.map(frame => this.ai.run(this.config.aiModels.imageAnalysis, {
          image: frame,
          prompt: "Describe what is shown in this video frame. Identify any text, people, objects, or important visual elements."
        }))
      );

      // Combine transcription and frame analyses
      const combinedText = this.combineVideoContent(transcription, frameAnalyses);

      return {
        text: combinedText,
        media: [
          ...(audioTrack ? [{
            type: 'audio' as const,
            content: audioTrack,
            metadata: {
              source: 'video_audio_track',
              transcribed: true
            }
          }] : []),
          ...keyFrames.map((frame, index) => ({
            type: 'image' as const,
            content: frame,
            metadata: {
              frameNumber: index,
              timestamp: this.calculateFrameTimestamp(index),
              analysis: frameAnalyses[index]?.description
            }
          }))
        ],
        structuredData: [],
        extractedFields: [
          { name: 'duration', value: '0', confidence: 1.0 }, // Would extract from video metadata
          { name: 'frame_count', value: keyFrames.length.toString(), confidence: 1.0 },
          { name: 'has_audio', value: (audioTrack ? 'true' : 'false'), confidence: 1.0 }
        ],
        metadata: {
          videoType: this.detectVideoType(content),
          duration: 0, // Would extract from video metadata
          frameCount: keyFrames.length,
          hasAudio: !!audioTrack
        }
      };

    } catch (error) {
      this.logger?.error("Video processing failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Process structured data (CSV, JSON, XML, etc.)
   */
  private async processStructuredData(request: MultiModalRequest): Promise<ExtractedContent> {
    const content = request.content;
    const format = request.options?.format || 'auto';

    try {
      let structuredData: any[] = [];
      let text = '';

      // Parse based on format
      switch (format) {
        case 'csv':
          const csvData = await this.parseCSV(content);
          structuredData = [{
            type: 'table',
            data: csvData,
            metadata: { format: 'csv' }
          }];
          text = this.summarizeTable(csvData);
          break;

        case 'json':
          const jsonData = JSON.parse(content);
          structuredData = [{
            type: 'json',
            data: jsonData,
            metadata: { format: 'json' }
          }];
          text = this.summarizeJSON(jsonData);
          break;

        case 'xml':
          const xmlData = await this.parseXML(content);
          structuredData = [{
            type: 'xml',
            data: xmlData,
            metadata: { format: 'xml' }
          }];
          text = this.summarizeXML(xmlData);
          break;

        default:
          // Auto-detect format
          const detectedFormat = await this.detectStructuredFormat(content);
          return this.processStructuredData({
            ...request,
            options: { ...request.options, format: detectedFormat }
          });
      }

      return {
        text,
        media: [],
        structuredData,
        extractedFields: this.extractFieldsFromStructuredData(structuredData),
        metadata: {
          format,
          recordCount: this.countRecords(structuredData),
          hasHeaders: this.hasHeaders(structuredData)
        }
      };

    } catch (error) {
      this.logger?.error("Structured data processing failed", { error: error.message });
      throw error;
    }
  }

  // Helper methods

  private validateRequest(request: MultiModalRequest): void {
    if (!request.id) {
      throw new Error('Request ID is required');
    }

    if (!request.content) {
      throw new Error('Content is required');
    }

    const contentSize = request.content.length;
    if (contentSize > this.config.maxFileSize) {
      throw new Error(`Content size ${contentSize} exceeds maximum allowed size ${this.config.maxFileSize}`);
    }
  }

  private async detectContentType(request: MultiModalRequest): Promise<DocumentType> {
    if (request.documentType && request.documentType !== 'auto') {
      return request.documentType;
    }

    // Auto-detect based on content and metadata
    const content = request.content;
    const firstBytes = content.slice(0, 16);

    // Check for PDF signature
    if (firstBytes.toString().startsWith('%PDF')) {
      return 'pdf';
    }

    // Check for image signatures
    const imageSignatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/bmp': [0x42, 0x4D]
    };

    for (const [format, signature] of Object.entries(imageSignatures)) {
      if (signature.every((byte, index) => firstBytes[index] === byte)) {
        return 'image';
      }
    }

    // Check for audio/video signatures (more complex detection would go here)

    // Default to image for binary content
    return 'image';
  }

  private async generateEmbeddings(content: ExtractedContent): Promise<number[]> {
    const text = content.text || '';
    if (text.length === 0) {
      return [];
    }

    try {
      const result = await this.ai.run(this.config.aiModels.textEmbedding, {
        text: text
      });

      return result.data || [];
    } catch (error) {
      this.logger?.error("Embedding generation failed", { error: error.message });
      return [];
    }
  }

  private async extractEntities(text: string): Promise<any[]> {
    if (text.length === 0) {
      return [];
    }

    try {
      const result = await this.ai.run(this.config.aiModels.entityExtraction, {
        text: text,
        prompt: "Extract entities from this financial text. Identify people, organizations, locations, dates, amounts, and other relevant entities."
      });

      return result.entities || [];
    } catch (error) {
      this.logger?.error("Entity extraction failed", { error: error.message });
      return [];
    }
  }

  private async classifyContent(content: ExtractedContent): Promise<any> {
    const text = content.text || '';
    if (text.length === 0) {
      return null;
    }

    try {
      const result = await this.ai.run(this.config.aiModels.classification, {
        text: text,
        prompt: "Classify this financial document. Determine if it's an invoice, contract, report, statement, or other type of financial document."
      });

      return {
        category: result.category || 'unknown',
        confidence: result.confidence || 0.5,
        subcategories: result.subcategories || []
      };
    } catch (error) {
      this.logger?.error("Content classification failed", { error: error.message });
      return null;
    }
  }

  private calculateOverallConfidence(content: ExtractedContent): number {
    const confidences = [
      content.metadata?.textConfidence || 0.8,
      ...(content.media?.map(m => m.metadata?.confidence || 0.8) || []),
      ...(content.structuredData?.map(s => s.metadata?.confidence || 0.8) || [])
    ];

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  // Additional helper methods would be implemented here...
  private async extractImagesFromPDF(content: ArrayBuffer): Promise<any[]> { return []; }
  private async extractTablesFromPDF(content: ArrayBuffer): Promise<any[]> { return []; }
  private async extractFormsFromPDF(content: ArrayBuffer): Promise<any[]> { return []; }
  private async extractPDFMetadata(content: ArrayBuffer): Promise<any> { return {}; }
  private extractKeyFields(text: string): any[] { return []; }
  private extractStructuredFields(tables: any[], forms: any[]): any[] { return []; }
  private async extractStructuredDataFromImage(content: ArrayBuffer, text: string): Promise<StructuredData[]> { return []; }
  private async detectScannedDocument(content: ArrayBuffer, text: string, analysis: any): Promise<boolean> { return false; }
  private detectImageType(content: ArrayBuffer): string { return 'unknown'; }
  private identifyImageElements(analysis: any): string[] { return []; }
  private async extractChartData(content: ArrayBuffer, analysis: any): Promise<any> {
    return { type: 'unknown', title: '', axes: {}, dataPoints: [], trends: [] };
  }
  private async generateChartSummary(analysis: any, data: any): Promise<string> { return ''; }
  private async analyzeAudio(content: ArrayBuffer): Promise<any> {
    return { duration: 0, sampleRate: 0, channels: 1, speakerCount: 1, hasBackgroundNoise: false };
  }
  private async detectLanguage(text: string): Promise<string> { return 'en'; }
  private detectAudioType(content: ArrayBuffer): string { return 'unknown'; }
  private async extractAudioFromVideo(content: ArrayBuffer): Promise<ArrayBuffer | null> { return null; }
  private async extractKeyFrames(content: ArrayBuffer): Promise<ArrayBuffer[]> { return []; }
  private calculateFrameTimestamp(index: number): number { return index * 33; } // Assuming 30fps
  private combineVideoContent(transcription: string, frameAnalyses: any[]): string {
    return transcription + ' ' + frameAnalyses.map(f => f.description).join(' ');
  }
  private detectVideoType(content: ArrayBuffer): string { return 'unknown'; }
  private async parseCSV(content: string): Promise<any[]> { return []; }
  private summarizeTable(data: any[]): string { return `Table with ${data.length} rows`; }
  private summarizeJSON(data: any): string { return `JSON data with ${Object.keys(data).length} keys`; }
  private async parseXML(content: string): Promise<any> { return {}; }
  private summarizeXML(data: any): string { return 'XML document'; }
  private async detectStructuredFormat(content: string): Promise<string> { return 'json'; }
  private extractFieldsFromStructuredData(structuredData: any[]): any[] { return []; }
  private countRecords(structuredData: any[]): number { return 0; }
  private hasHeaders(structuredData: any[]): boolean { return false; }
  private async processScannedDocument(request: MultiModalRequest): Promise<ExtractedContent> {
    // Similar to image processing but with enhanced OCR for scanned documents
    return this.processImage(request);
  }
}

interface ProcessingConfig {
  maxFileSize: number;
  supportedFormats: string[];
  aiModels: {
    ocr: string;
    imageAnalysis: string;
    chartAnalysis: string;
    speechToText: string;
    textEmbedding: string;
    classification: string;
    entityExtraction: string;
  };
  confidence: {
    minThreshold: number;
    ocrThreshold: number;
    entityThreshold: number;
  };
}
