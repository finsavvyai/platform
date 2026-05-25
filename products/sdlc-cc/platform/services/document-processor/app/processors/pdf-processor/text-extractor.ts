import { Logger } from '../../utils/logger';
import { PDFPage, PDFImage, PDFTable, PDFFormData, PDFOptions } from './types';

const logger = new Logger('PDFTextExtractor');

export async function processPDFPages(
  pdfData: Record<string, unknown>,
  _options: PDFOptions,
): Promise<PDFPage[]> {
  const pages: PDFPage[] = [];

  try {
    const pageTexts = pdfData.text
      ? (pdfData.text as string).split('\n\n')
      : [];

    const numPages = pdfData.numpages as number;
    const pdfPages = pdfData.pages as Array<Record<string, unknown>> | undefined;

    for (let i = 0; i < numPages; i++) {
      const page: PDFPage = {
        pageNumber: i + 1,
        text: pageTexts[i] || '',
        boundingBoxes: [],
        images: [],
        tables: [],
        quality: 0.8,
      };

      if (pdfPages && pdfPages[i]) {
        const pageData = pdfPages[i];
        page.text = (pageData.text as string) || page.text;

        if (pageData.items) {
          const items = pageData.items as Array<{
            x: number; y: number; w: number; h: number; str: string;
          }>;
          page.boundingBoxes = items.map((item) => ({
            x: item.x || 0,
            y: item.y || 0,
            width: item.width || 0,
            height: item.height || 0,
          }));
        }
      }

      page.quality = await assessPageQuality(page);
      pages.push(page);
    }

    return pages;
  } catch (error) {
    logger.warn('Failed to process some PDF pages:', error);
    return pages;
  }
}

export async function assessPageQuality(page: PDFPage): Promise<number> {
  let quality = 1.0;

  if (page.text.length === 0) {
    quality *= 0.1;
  } else if (page.text.length < 50) {
    quality *= 0.5;
  }

  const specialCharRatio =
    (page.text.match(/[^\w\s.,;:!?()\-'"`]/g) || []).length / page.text.length;
  if (specialCharRatio > 0.1) {
    quality *= 0.8;
  }

  const whitespaceRatio =
    (page.text.match(/\s/g) || []).length / page.text.length;
  if (whitespaceRatio > 0.8 || whitespaceRatio < 0.05) {
    quality *= 0.9;
  }

  return Math.max(0.1, Math.min(1.0, quality));
}

export async function extractImages(
  _buffer: Buffer,
  _options: PDFOptions,
): Promise<PDFImage[]> {
  try {
    logger.debug('Image extraction not implemented in this version');
    return [];
  } catch (error) {
    logger.warn('Failed to extract images from PDF:', error);
    return [];
  }
}

export async function extractTables(
  _buffer: Buffer,
  _options: PDFOptions,
): Promise<PDFTable[]> {
  try {
    logger.debug('Table extraction not implemented in this version');
    return [];
  } catch (error) {
    logger.warn('Failed to extract tables from PDF:', error);
    return [];
  }
}

export async function extractForms(
  _buffer: Buffer,
  _options: PDFOptions,
): Promise<PDFFormData[]> {
  try {
    logger.debug('Form extraction not implemented in this version');
    return [];
  } catch (error) {
    logger.warn('Failed to extract forms from PDF:', error);
    return [];
  }
}
