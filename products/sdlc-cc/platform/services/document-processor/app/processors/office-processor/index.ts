/**
 * Office Processor - Main Orchestrator
 */

import { Logger } from '../../utils/logger';
import {
  DocumentProcessingError,
  UnsupportedFormatError,
} from '../../utils/error-handler';
import { StorageManager } from '../../core/storage-manager';
import { processWordDocument } from './word-processor';
import { processExcelDocument } from './excel-processor';
import { processPowerPointDocument } from './powerpoint-processor';
import type { OfficeDocumentResult, OfficeProcessingOptions } from './types';

export * from './types';

const WORD_EXTENSIONS = [
  '.doc', '.docx', '.dot', '.dotx', '.docm', '.dotm', '.odt',
];
const EXCEL_EXTENSIONS = [
  '.xls', '.xlsx', '.xlsm', '.xlsb', '.xlt', '.xltx', '.xltm', '.ods',
];
const POWERPOINT_EXTENSIONS = [
  '.ppt', '.pptx', '.pps', '.ppsx', '.pot', '.potx', '.pptm', '.potm',
  '.odp',
];

const SUPPORTED_FORMATS = [
  ...WORD_EXTENSIONS,
  ...EXCEL_EXTENSIONS,
  ...POWERPOINT_EXTENSIONS,
  '.xml',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export class OfficeProcessor {
  private logger: Logger;
  private storageManager: StorageManager;
  public supportedFormats: string[];
  private maxFileSize: number;

  constructor(storageManager: StorageManager) {
    this.logger = new Logger('OfficeProcessor');
    this.storageManager = storageManager;
    this.supportedFormats = SUPPORTED_FORMATS;
    this.maxFileSize = MAX_FILE_SIZE;
  }

  public async processOfficeDocument(
    fileId: string,
    options: OfficeProcessingOptions = {}
  ): Promise<OfficeDocumentResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Processing Office document: ${fileId}`);

      const buffer = await this.storageManager.downloadFile(fileId);
      const documentType = await this.detectDocumentType(fileId, buffer);
      await this.validateDocument(buffer);

      let result: OfficeDocumentResult;

      switch (documentType) {
        case 'word':
          result = await processWordDocument(
            buffer, options, this.logger
          );
          break;
        case 'excel':
          result = await processExcelDocument(
            buffer, options, this.logger
          );
          break;
        case 'powerpoint':
          result = await processPowerPointDocument(
            buffer, options, this.logger
          );
          break;
        default:
          throw new UnsupportedFormatError(
            documentType, this.supportedFormats
          );
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        `Office document processing completed in ${duration}ms for file: ${fileId}`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Office document processing failed for file ${fileId}:`,
        error
      );
      throw new DocumentProcessingError(
        `Office document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  private async detectDocumentType(
    fileId: string,
    buffer: Buffer
  ): Promise<'word' | 'excel' | 'powerpoint'> {
    try {
      const extension = fileId
        .toLowerCase()
        .substring(fileId.lastIndexOf('.'));

      const header = buffer.slice(0, 8).toString('hex');

      if (header.startsWith('d0cf11e0a1b11ae1')) {
        if (extension === '.doc') return 'word';
        if (extension === '.xls') return 'excel';
        if (extension === '.ppt') return 'powerpoint';
      } else if (header.startsWith('504b0304')) {
        if (extension.includes('doc')) return 'word';
        if (extension.includes('xls') || extension.includes('xl'))
          return 'excel';
        if (extension.includes('ppt')) return 'powerpoint';
      }

      if (WORD_EXTENSIONS.includes(extension)) return 'word';
      if (EXCEL_EXTENSIONS.includes(extension)) return 'excel';
      if (POWERPOINT_EXTENSIONS.includes(extension)) return 'powerpoint';

      throw new UnsupportedFormatError(extension, this.supportedFormats);
    } catch (error) {
      if (error instanceof UnsupportedFormatError) throw error;
      throw new DocumentProcessingError(
        'Failed to detect document type',
        error
      );
    }
  }

  private async validateDocument(buffer: Buffer): Promise<void> {
    if (buffer.length === 0) {
      throw new DocumentProcessingError('Office document is empty');
    }
    if (buffer.length > this.maxFileSize) {
      throw new DocumentProcessingError(
        `Office document size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`
      );
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Office processor shutdown completed');
  }
}
