import { createWorker } from 'tesseract.js';
import { Logger } from '../../utils/logger';
import { DocumentProcessingError } from '../../utils/error-handler';
import { PDFExtractionResult, PDFOptions } from './types';

export class OCRProcessor {
  private logger: Logger;
  private ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
  private enableOCR: boolean;

  constructor() {
    this.logger = new Logger('OCRProcessor');
    this.enableOCR = process.env.ENABLE_OCR === 'true';
  }

  public get isEnabled(): boolean {
    return this.enableOCR;
  }

  public async initialize(): Promise<void> {
    if (!this.enableOCR) return;

    try {
      this.logger.info('Initializing OCR worker...');
      this.ocrWorker = await createWorker('eng', 1, {
        logger: (message: unknown) => {
          this.logger.debug('OCR:', message);
        },
      });

      await this.ocrWorker.setParameters({
        tessedit_char_whitelist:
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:!?()-\'" ',
        tessedit_pageseg_mode: '6',
      });
    } catch (error) {
      throw new DocumentProcessingError(
        'Failed to initialize OCR worker',
        error,
      );
    }
  }

  public async processWithOCR(
    buffer: Buffer,
    result: PDFExtractionResult,
    _options: PDFOptions,
  ): Promise<void> {
    if (!this.ocrWorker) {
      this.logger.warn('OCR worker not available, skipping OCR processing');
      return;
    }

    try {
      this.logger.info('Starting OCR processing for low-quality text pages...');

      for (let i = 0; i < result.pages.length; i++) {
        const page = result.pages[i];
        if (!page) continue;

        if (page.quality < 0.7) {
          this.logger.debug(`Processing page ${i + 1} with OCR`);
          const ocrText = await this.performOCR(buffer, i + 1);
          if (ocrText && ocrText.length > page.text.length) {
            page.text = ocrText;
            page.quality = Math.min(1.0, page.quality + 0.3);
          }
        }
      }

      result.text = result.pages
        .map((page) => page.text)
        .join('\n\n--- Page Break ---\n\n');

      result.quality.textClarity =
        result.pages.reduce((sum, page) => sum + page.quality, 0) /
        result.pages.length;
      result.quality.overall = Math.min(1.0, result.quality.overall + 0.2);

      if (result.quality.ocrConfidence === undefined) {
        result.quality.ocrConfidence = result.quality.textClarity;
      }

      this.logger.info('OCR processing completed');
    } catch (error) {
      this.logger.warn('OCR processing failed:', error);
    }
  }

  private async performOCR(
    buffer: Buffer,
    pageNumber: number,
  ): Promise<string> {
    try {
      this.logger.debug(`OCR processing page ${pageNumber}`);

      if (this.ocrWorker) {
        const {
          data: { text },
        } = await this.ocrWorker.recognize(buffer, {
          rectangle: { left: 0, top: 0, width: 1000, height: 1000 },
        });
        return text;
      }

      return '';
    } catch (error) {
      this.logger.warn(`OCR failed for page ${pageNumber}:`, error);
      return '';
    }
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.ocrWorker) {
        await this.ocrWorker.terminate();
        this.ocrWorker = null;
      }
      this.logger.info('OCR processor shutdown completed');
    } catch (error) {
      this.logger.error('Error during OCR processor shutdown:', error);
    }
  }
}
