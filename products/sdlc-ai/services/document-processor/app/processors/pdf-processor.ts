import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { Logger } from '../utils/logger';
import { DocumentProcessingError } from '../utils/error-handler';
import { StorageManager } from '../core/storage-manager';
import sharp from 'sharp';

export interface PDFExtractionResult {
  text: string;
  pages: PDFPage[];
  metadata: PDFMetadata;
  images: PDFImage[];
  tables: PDFTable[];
  forms: PDFFormData[];
  quality: QualityMetrics;
}

export interface PDFPage {
  pageNumber: number;
  text: string;
  boundingBoxes: BoundingBox[];
  images: PDFImage[];
  tables: PDFTable[];
  quality: number;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  keywords?: string[];
  pageCount: number;
  isEncrypted: boolean;
  isScanned: boolean;
  hasImages: boolean;
  hasTables: boolean;
  hasForms: boolean;
  language?: string;
}

export interface PDFImage {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageData?: Buffer;
  confidence: number;
  isChart: boolean;
  isDiagram: boolean;
}

export interface PDFTable {
  id: string;
  pageNumber: number;
  rows: number;
  columns: number;
  data: string[][];
  confidence: number;
  boundingBox: BoundingBox;
}

export interface PDFFormData {
  id: string;
  fieldName: string;
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature';
  value?: string;
  options?: string[];
  pageNumber: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QualityMetrics {
  overall: number;
  textClarity: number;
  structurePreservation: number;
  ocrConfidence?: number;
  extractionCompleteness: number;
  formattingAccuracy: number;
}

export class PDFProcessor {
  private logger: Logger;
  private storageManager: StorageManager;
  private ocrWorker: any;
  private supportedLanguages: string[];
  private maxFileSize: number;
  private enableOCR: boolean;

  constructor(storageManager: StorageManager) {
    this.logger = new Logger('PDFProcessor');
    this.storageManager = storageManager;
    this.supportedLanguages = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'rus', 'chi_sim', 'jpn', 'kor'];
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.enableOCR = process.env.ENABLE_OCR === 'true';
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing PDF processor...');

      if (this.enableOCR) {
        this.logger.info('Initializing OCR worker...');
        this.ocrWorker = await createWorker('eng', 1, {
          logger: (message: any) => {
            this.logger.debug('OCR:', message);
          },
        });

        await this.ocrWorker.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:!?()-\'" ',
          tessedit_pageseg_mode: '6', // Assume uniform text block
        });
      }

      this.logger.info('PDF processor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PDF processor:', error);
      throw new DocumentProcessingError('Failed to initialize PDF processor', error);
    }
  }

  public async extractPDFContent(fileId: string, options: PDFOptions = {}): Promise<PDFExtractionResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting PDF extraction for file: ${fileId}`);

      // Download file from storage
      const pdfBuffer = await this.storageManager.downloadFile(fileId);

      // Validate file
      await this.validatePDF(pdfBuffer);

      // Extract content
      const result = await this.processPDF(pdfBuffer, options);

      const duration = Date.now() - startTime;
      this.logger.info(`PDF extraction completed in ${duration}ms for file: ${fileId}`);

      return result;
    } catch (error) {
      this.logger.error(`PDF extraction failed for file ${fileId}:`, error);
      throw new DocumentProcessingError(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  private async validatePDF(buffer: Buffer): Promise<void> {
    if (buffer.length === 0) {
      throw new DocumentProcessingError('PDF file is empty');
    }

    if (buffer.length > this.maxFileSize) {
      throw new DocumentProcessingError(`PDF file size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // Check PDF signature
    const header = buffer.slice(0, 5).toString();
    if (header !== '%PDF-') {
      throw new DocumentProcessingError('Invalid PDF file format');
    }
  }

  private async processPDF(buffer: Buffer, options: PDFOptions): Promise<PDFExtractionResult> {
    const result: PDFExtractionResult = {
      text: '',
      pages: [],
      metadata: {
        pageCount: 0,
        isEncrypted: false,
        isScanned: false,
        hasImages: false,
        hasTables: false,
        hasForms: false,
      },
      images: [],
      tables: [],
      forms: [],
      quality: {
        overall: 0,
        textClarity: 0,
        structurePreservation: 0,
        extractionCompleteness: 0,
        formattingAccuracy: 0,
      },
    };

    try {
      // Extract text using pdf-parse
      const pdfData = await pdf(buffer);

      // Extract metadata
      result.metadata = await this.extractPDFMetadata(pdfData, buffer);

      // Process pages
      result.pages = await this.processPDFPages(pdfData, options);

      // Combine all text
      result.text = result.pages.map(page => page.text).join('\n\n--- Page Break ---\n\n');

      // Extract images if requested
      if (options.extractImages !== false) {
        result.images = await this.extractImages(buffer, options);
        result.metadata.hasImages = result.images.length > 0;
      }

      // Extract tables if requested
      if (options.extractTables !== false) {
        result.tables = await this.extractTables(buffer, options);
        result.metadata.hasTables = result.tables.length > 0;
      }

      // Extract forms if requested
      if (options.extractForms !== false) {
        result.forms = await this.extractForms(buffer, options);
        result.metadata.hasForms = result.forms.length > 0;
      }

      // Assess quality
      result.quality = await this.assessQuality(result, options);

      // OCR processing if text quality is low and OCR is enabled
      if (this.enableOCR && result.quality.textClarity < 0.7 && options.enableOCR !== false) {
        await this.processWithOCR(buffer, result, options);
      }

      // Detect language
      result.metadata.language = await this.detectLanguage(result.text);

      return result;
    } catch (error) {
      throw new DocumentProcessingError('Failed to process PDF content', error);
    }
  }

  private async extractPDFMetadata(pdfData: any, buffer: Buffer): Promise<PDFMetadata> {
    const metadata: PDFMetadata = {
      pageCount: pdfData.numpages || 0,
      isEncrypted: false,
      isScanned: false,
      hasImages: false,
      hasTables: false,
      hasForms: false,
    };

    try {
      // Extract basic metadata from pdf-parse
      if (pdfData.info) {
        metadata.title = pdfData.info.Title;
        metadata.author = pdfData.info.Author;
        metadata.subject = pdfData.info.Subject;
        metadata.creator = pdfData.info.Creator;
        metadata.producer = pdfData.info.Producer;
        metadata.creationDate = pdfData.info.CreationDate ? new Date(pdfData.info.CreationDate) : undefined;
        metadata.modificationDate = pdfData.info.ModDate ? new Date(pdfData.info.ModDate) : undefined;

        if (pdfData.info.Keywords) {
          metadata.keywords = pdfData.info.Keywords.split(',').map((k: string) => k.trim());
        }
      }

      // Check if PDF is likely scanned (low text content or high image content)
      const textLength = pdfData.text?.length || 0;
      const avgTextPerPage = textLength / metadata.pageCount;
      metadata.isScanned = avgTextPerPage < 100; // Less than 100 chars per page suggests scanned content

      return metadata;
    } catch (error) {
      this.logger.warn('Failed to extract some PDF metadata:', error);
      return metadata;
    }
  }

  private async processPDFPages(pdfData: any, options: PDFOptions): Promise<PDFPage[]> {
    const pages: PDFPage[] = [];

    try {
      // Split text by pages if available
      const pageTexts = pdfData.text ? pdfData.text.split('\n\n') : [];

      for (let i = 0; i < pdfData.numpages; i++) {
        const page: PDFPage = {
          pageNumber: i + 1,
          text: pageTexts[i] || '',
          boundingBoxes: [],
          images: [],
          tables: [],
          quality: 0.8, // Default quality
        };

        // Extract text with formatting info if available
        if (pdfData.pages && pdfData.pages[i]) {
          page.text = pdfData.pages[i].text || page.text;

          // Extract bounding boxes if available
          if (pdfData.pages[i].items) {
            page.boundingBoxes = pdfData.pages[i].items.map((item: any) => ({
              x: item.x || 0,
              y: item.y || 0,
              width: item.width || 0,
              height: item.height || 0,
            }));
          }
        }

        // Assess page quality
        page.quality = await this.assessPageQuality(page);

        pages.push(page);
      }

      return pages;
    } catch (error) {
      this.logger.warn('Failed to process some PDF pages:', error);
      return pages;
    }
  }

  private async extractImages(buffer: Buffer, options: PDFOptions): Promise<PDFImage[]> {
    // This is a simplified implementation
    // In practice, you would use a library like pdf-poppler or pdf2pic to extract images
    const images: PDFImage[] = [];

    try {
      // For now, return empty array
      // Implementation would convert PDF pages to images and analyze them
      this.logger.debug('Image extraction not implemented in this version');
      return images;
    } catch (error) {
      this.logger.warn('Failed to extract images from PDF:', error);
      return images;
    }
  }

  private async extractTables(buffer: Buffer, options: PDFOptions): Promise<PDFTable[]> {
    // This is a simplified implementation
    // In practice, you would use a library like tabula or pdf-table-extractor
    const tables: PDFTable[] = [];

    try {
      // For now, return empty array
      // Implementation would detect and extract table structures
      this.logger.debug('Table extraction not implemented in this version');
      return tables;
    } catch (error) {
      this.logger.warn('Failed to extract tables from PDF:', error);
      return tables;
    }
  }

  private async extractForms(buffer: Buffer, options: PDFOptions): Promise<PDFFormData[]> {
    // This is a simplified implementation
    // In practice, you would use a library like pdfkit or pdf-form-parser
    const forms: PDFFormData[] = [];

    try {
      // For now, return empty array
      // Implementation would detect and extract form fields
      this.logger.debug('Form extraction not implemented in this version');
      return forms;
    } catch (error) {
      this.logger.warn('Failed to extract forms from PDF:', error);
      return forms;
    }
  }

  private async assessPageQuality(page: PDFPage): Promise<number> {
    let quality = 1.0;

    // Assess based on text length
    if (page.text.length === 0) {
      quality *= 0.1;
    } else if (page.text.length < 50) {
      quality *= 0.5;
    }

    // Assess based on special characters (indicative of OCR issues)
    const specialCharRatio = (page.text.match(/[^\w\s.,;:!?()-'"`]/g) || []).length / page.text.length;
    if (specialCharRatio > 0.1) {
      quality *= 0.8;
    }

    // Assess based on whitespace patterns
    const whitespaceRatio = (page.text.match(/\s/g) || []).length / page.text.length;
    if (whitespaceRatio > 0.8 || whitespaceRatio < 0.05) {
      quality *= 0.9;
    }

    return Math.max(0.1, Math.min(1.0, quality));
  }

  private async assessQuality(result: PDFExtractionResult, options: PDFOptions): Promise<QualityMetrics> {
    const metrics: QualityMetrics = {
      overall: 0,
      textClarity: 0,
      structurePreservation: 0,
      extractionCompleteness: 0,
      formattingAccuracy: 0,
    };

    try {
      // Text clarity assessment
      const avgPageQuality = result.pages.reduce((sum, page) => sum + page.quality, 0) / result.pages.length;
      metrics.textClarity = avgPageQuality;

      // Structure preservation assessment
      metrics.structurePreservation = await this.assessStructurePreservation(result);

      // Extraction completeness assessment
      metrics.extractionCompleteness = await this.assessExtractionCompleteness(result);

      // Formatting accuracy assessment
      metrics.formattingAccuracy = await this.assessFormattingAccuracy(result);

      // Overall quality (weighted average)
      metrics.overall = (
        metrics.textClarity * 0.3 +
        metrics.structurePreservation * 0.25 +
        metrics.extractionCompleteness * 0.25 +
        metrics.formattingAccuracy * 0.2
      );

      return metrics;
    } catch (error) {
      this.logger.warn('Failed to assess quality:', error);
      return metrics;
    }
  }

  private async assessStructurePreservation(result: PDFExtractionResult): Promise<number> {
    // Assess how well the document structure is preserved
    let score = 1.0;

    // Check for page breaks
    const pageCount = result.pages.length;
    if (pageCount === 0) score *= 0.1;
    else if (pageCount === 1) score *= 0.8;

    // Check for headings and paragraphs
    const hasStructure = /\n\s*[A-Z][^.]*\n/.test(result.text); // Simple heading detection
    if (!hasStructure) score *= 0.9;

    return Math.max(0.1, Math.min(1.0, score));
  }

  private async assessExtractionCompleteness(result: PDFExtractionResult): Promise<number> {
    // Assess how completely the content was extracted
    let score = 1.0;

    // Check if text was extracted from all pages
    const pagesWithText = result.pages.filter(page => page.text.trim().length > 0).length;
    const textCompleteness = pagesWithText / result.pages.length;
    score *= textCompleteness;

    // Check for metadata completeness
    const metadataFields = Object.values(result.metadata).filter(value => value !== undefined).length;
    const metadataCompleteness = metadataFields / 8; // Approximate number of metadata fields
    score *= (0.7 + 0.3 * metadataCompleteness); // Give more weight to text

    return Math.max(0.1, Math.min(1.0, score));
  }

  private async assessFormattingAccuracy(result: PDFExtractionResult): Promise<number> {
    // Assess how well formatting is preserved
    let score = 1.0;

    // Check for preserved line breaks
    const lineBreakCount = (result.text.match(/\n/g) || []).length;
    const expectedLineBreaks = result.pages.length * 10; // Rough estimate
    const lineBreakRatio = Math.min(1.0, lineBreakCount / expectedLineBreaks);
    score *= (0.5 + 0.5 * lineBreakRatio);

    // Check for preserved spacing
    const hasMultipleSpaces = /\s{2,}/.test(result.text);
    if (hasMultipleSpaces) score *= 0.95;

    return Math.max(0.1, Math.min(1.0, score));
  }

  private async processWithOCR(buffer: Buffer, result: PDFExtractionResult, options: PDFOptions): Promise<void> {
    if (!this.ocrWorker) {
      this.logger.warn('OCR worker not available, skipping OCR processing');
      return;
    }

    try {
      this.logger.info('Starting OCR processing for low-quality text pages...');

      // Convert PDF pages to images and process with OCR
      // This is a simplified implementation - in practice, you would use pdf-poppler or similar
      for (let i = 0; i < result.pages.length; i++) {
        const page = result.pages[i];

        if (page.quality < 0.7) {
          this.logger.debug(`Processing page ${i + 1} with OCR`);

          // OCR processing would happen here
          // For now, we'll just mark the page as processed
          const ocrText = await this.performOCR(buffer, i + 1, options);
          if (ocrText && ocrText.length > page.text.length) {
            page.text = ocrText;
            page.quality = Math.min(1.0, page.quality + 0.3);
          }
        }
      }

      // Recombine text after OCR
      result.text = result.pages.map(page => page.text).join('\n\n--- Page Break ---\n\n');

      // Update quality metrics
      result.quality.textClarity = result.pages.reduce((sum, page) => sum + page.quality, 0) / result.pages.length;
      result.quality.overall = Math.min(1.0, result.quality.overall + 0.2);

      if (result.quality.ocrConfidence === undefined) {
        result.quality.ocrConfidence = result.quality.textClarity;
      }

      this.logger.info('OCR processing completed');
    } catch (error) {
      this.logger.warn('OCR processing failed:', error);
    }
  }

  private async performOCR(buffer: Buffer, pageNumber: number, options: PDFOptions): Promise<string> {
    try {
      // This is a placeholder implementation
      // In practice, you would convert the PDF page to an image first
      this.logger.debug(`OCR processing page ${pageNumber}`);

      if (this.ocrWorker) {
        // Placeholder - would process actual image data
        const { data: { text } } = await this.ocrWorker.recognize(buffer, {
          rectangle: { left: 0, top: 0, width: 1000, height: 1000 }
        });
        return text;
      }

      return '';
    } catch (error) {
      this.logger.warn(`OCR failed for page ${pageNumber}:`, error);
      return '';
    }
  }

  private async detectLanguage(text: string): Promise<string> {
    try {
      if (!text || text.length < 50) {
        return 'unknown';
      }

      // Simple language detection based on character patterns
      // In practice, you would use a library like franc or langdetect
      const sample = text.substring(0, 1000);

      // Basic pattern matching
      if (/[ñáéíóúü]/i.test(sample)) return 'spa';
      if (/[àâäçéèêëïîôöùûü]/i.test(sample)) return 'fra';
      if (/[äöüß]/i.test(sample)) return 'deu';
      if (/[àèéìíîòóù]/i.test(sample)) return 'ita';
      if (/[ãâáàéêíóôõú]/i.test(sample)) return 'por';
      if (/[\u4e00-\u9fff]/.test(sample)) return 'chi_sim';
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return 'jpn';
      if (/[\uac00-\ud7af]/.test(sample)) return 'kor';
      if (/[\u0400-\u04ff]/.test(sample)) return 'rus';

      return 'eng'; // Default to English
    } catch (error) {
      this.logger.warn('Language detection failed:', error);
      return 'unknown';
    }
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.ocrWorker) {
        await this.ocrWorker.terminate();
        this.ocrWorker = null;
      }

      this.logger.info('PDF processor shutdown completed');
    } catch (error) {
      this.logger.error('Error during PDF processor shutdown:', error);
    }
  }
}

export interface PDFOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  extractForms?: boolean;
  enableOCR?: boolean;
  language?: string;
  preserveFormatting?: boolean;
  maxImageSize?: number;
  imageFormat?: 'png' | 'jpg';
}
