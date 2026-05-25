import pdf from 'pdf-parse';
import { Logger } from '../../utils/logger';
import { DocumentProcessingError } from '../../utils/error-handler';
import { StorageManager } from '../../core/storage-manager';
import { PDFExtractionResult, PDFOptions } from './types';
import { extractPDFMetadata, detectLanguage } from './metadata-extractor';
import {
  processPDFPages,
  extractImages,
  extractTables,
  extractForms,
} from './text-extractor';
import { OCRProcessor } from './ocr-processor';
import { assessQuality } from './quality-assessor';

export class PDFProcessor {
  private logger: Logger;
  private storageManager: StorageManager;
  private ocrProcessor: OCRProcessor;
  private maxFileSize: number;

  constructor(storageManager: StorageManager) {
    this.logger = new Logger('PDFProcessor');
    this.storageManager = storageManager;
    this.ocrProcessor = new OCRProcessor();
    this.maxFileSize = 50 * 1024 * 1024;
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing PDF processor...');
      await this.ocrProcessor.initialize();
      this.logger.info('PDF processor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PDF processor:', error);
      throw new DocumentProcessingError(
        'Failed to initialize PDF processor',
        error,
      );
    }
  }

  public async extractPDFContent(
    fileId: string,
    options: PDFOptions = {},
  ): Promise<PDFExtractionResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting PDF extraction for file: ${fileId}`);
      const pdfBuffer = await this.storageManager.downloadFile(fileId);
      await this.validatePDF(pdfBuffer);
      const result = await this.processPDF(pdfBuffer, options);
      const duration = Date.now() - startTime;
      this.logger.info(
        `PDF extraction completed in ${duration}ms for file: ${fileId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`PDF extraction failed for file ${fileId}:`, error);
      throw new DocumentProcessingError(
        `PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  private async validatePDF(buffer: Buffer): Promise<void> {
    if (buffer.length === 0) {
      throw new DocumentProcessingError('PDF file is empty');
    }
    if (buffer.length > this.maxFileSize) {
      throw new DocumentProcessingError(
        `PDF file size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }
    const header = buffer.slice(0, 5).toString();
    if (header !== '%PDF-') {
      throw new DocumentProcessingError('Invalid PDF file format');
    }
  }

  private async processPDF(
    buffer: Buffer,
    options: PDFOptions,
  ): Promise<PDFExtractionResult> {
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
      const pdfData = await pdf(buffer);

      result.metadata = await extractPDFMetadata(pdfData, buffer);
      result.pages = await processPDFPages(pdfData, options);
      result.text = result.pages
        .map((page) => page.text)
        .join('\n\n--- Page Break ---\n\n');

      if (options.extractImages !== false) {
        result.images = await extractImages(buffer, options);
        result.metadata.hasImages = result.images.length > 0;
      }
      if (options.extractTables !== false) {
        result.tables = await extractTables(buffer, options);
        result.metadata.hasTables = result.tables.length > 0;
      }
      if (options.extractForms !== false) {
        result.forms = await extractForms(buffer, options);
        result.metadata.hasForms = result.forms.length > 0;
      }

      result.quality = await assessQuality(result);

      if (
        this.ocrProcessor.isEnabled &&
        result.quality.textClarity < 0.7 &&
        options.enableOCR !== false
      ) {
        await this.ocrProcessor.processWithOCR(buffer, result, options);
      }

      result.metadata.language = await detectLanguage(result.text);
      return result;
    } catch (error) {
      throw new DocumentProcessingError(
        'Failed to process PDF content',
        error,
      );
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await this.ocrProcessor.shutdown();
      this.logger.info('PDF processor shutdown completed');
    } catch (error) {
      this.logger.error('Error during PDF processor shutdown:', error);
    }
  }
}
