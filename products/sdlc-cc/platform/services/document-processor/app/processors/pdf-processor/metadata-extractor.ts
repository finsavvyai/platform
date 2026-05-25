import { Logger } from '../../utils/logger';
import { PDFMetadata } from './types';

const logger = new Logger('PDFMetadataExtractor');

export async function extractPDFMetadata(
  pdfData: Record<string, unknown>,
  _buffer: Buffer,
): Promise<PDFMetadata> {
  const metadata: PDFMetadata = {
    pageCount: (pdfData.numpages as number) || 0,
    isEncrypted: false,
    isScanned: false,
    hasImages: false,
    hasTables: false,
    hasForms: false,
  };

  try {
    const info = pdfData.info as Record<string, unknown> | undefined;
    if (info) {
      metadata.title = info.Title as string | undefined;
      metadata.author = info.Author as string | undefined;
      metadata.subject = info.Subject as string | undefined;
      metadata.creator = info.Creator as string | undefined;
      metadata.producer = info.Producer as string | undefined;

      if (info.CreationDate) {
        metadata.creationDate = new Date(info.CreationDate as string);
      }
      if (info.ModDate) {
        metadata.modificationDate = new Date(info.ModDate as string);
      }
      if (info.Keywords) {
        metadata.keywords = (info.Keywords as string)
          .split(',')
          .map((k: string) => k.trim());
      }
    }

    const textLength = (pdfData.text as string)?.length || 0;
    const avgTextPerPage = textLength / metadata.pageCount;
    metadata.isScanned = avgTextPerPage < 100;

    return metadata;
  } catch (error) {
    logger.warn('Failed to extract some PDF metadata:', error);
    return metadata;
  }
}

export async function detectLanguage(text: string): Promise<string> {
  try {
    if (!text || text.length < 50) {
      return 'unknown';
    }

    const sample = text.substring(0, 1000);

    if (/[ñáéíóúü]/i.test(sample)) return 'spa';
    if (/[àâäçéèêëïîôöùûü]/i.test(sample)) return 'fra';
    if (/[äöüß]/i.test(sample)) return 'deu';
    if (/[àèéìíîòóù]/i.test(sample)) return 'ita';
    if (/[ãâáàéêíóôõú]/i.test(sample)) return 'por';
    if (/[\u4e00-\u9fff]/.test(sample)) return 'chi_sim';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return 'jpn';
    if (/[\uac00-\ud7af]/.test(sample)) return 'kor';
    if (/[\u0400-\u04ff]/.test(sample)) return 'rus';

    return 'eng';
  } catch (error) {
    logger.warn('Language detection failed:', error);
    return 'unknown';
  }
}
