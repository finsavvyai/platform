/**
 * Office Processor - Word Document Processing
 */

import { Logger } from '../../utils/logger';
import { DocumentProcessingError } from '../../utils/error-handler';
import * as mammoth from 'mammoth';
import type {
  OfficeDocumentResult,
  OfficeProcessingOptions,
} from './types';
import {
  extractWordMetadata,
  extractWordStructure,
  extractWordContent,
  assessWordQuality,
} from './word-helpers';

export function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export async function processWordDocument(
  buffer: Buffer,
  _options: OfficeProcessingOptions,
  logger: Logger
): Promise<OfficeDocumentResult> {
  try {
    logger.debug('Processing Word document');

    const result = await mammoth.extractRawText({ buffer });
    const structuredResult = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
        ],
      }
    );

    return {
      text: result.value,
      documentType: 'word',
      metadata: extractWordMetadata(buffer, structuredResult, logger),
      structure: extractWordStructure(structuredResult, logger),
      content: extractWordContent(structuredResult, logger),
      quality: assessWordQuality(result, structuredResult, logger),
    };
  } catch (error) {
    throw new DocumentProcessingError(
      'Failed to process Word document',
      error
    );
  }
}
