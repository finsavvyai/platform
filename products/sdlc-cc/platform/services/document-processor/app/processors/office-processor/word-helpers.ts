/**
 * Office Processor - Word Document Helpers
 * Metadata, structure, content extraction and quality assessment
 */

import { Logger } from '../../utils/logger';
import type {
  OfficeMetadata,
  DocumentStructure,
  OfficeContent,
  QualityMetrics,
} from './types';
import { stripHTML } from './word-processor';

export function extractWordMetadata(
  _buffer: Buffer,
  structuredResult: Record<string, unknown>,
  logger: Logger
): OfficeMetadata {
  const metadata: OfficeMetadata = {
    isTemplate: false,
    hasMacros: false,
    hasEmbeddedContent: false,
  };

  try {
    if (structuredResult.messages) {
      metadata.hasMacros = (structuredResult.messages as any[]).some(
        (msg: { message?: string }) =>
          msg.message && msg.message.toLowerCase().includes('macro')
      );
      metadata.hasEmbeddedContent = (
        structuredResult.messages as any[]
      ).some(
        (msg: { message?: string }) =>
          msg.message && msg.message.toLowerCase().includes('embedded')
      );
    }

    const text = (structuredResult.value as string) || '';
    metadata.wordCount = text
      .split(/\s+/)
      .filter((word: string) => word.length > 0).length;
    metadata.pageCount = Math.max(
      1,
      Math.ceil((metadata.wordCount ?? 0) / 250)
    );

    return metadata;
  } catch (error) {
    logger.warn('Failed to extract Word metadata:', error);
    return metadata;
  }
}

export function extractWordStructure(
  structuredResult: Record<string, unknown>,
  logger: Logger
): DocumentStructure {
  const structure: DocumentStructure = {
    headings: [],
    paragraphs: [],
    tables: [],
    lists: [],
    sections: [],
    footnotes: [],
    endnotes: [],
    headers: [],
    footers: [],
  };

  try {
    if (structuredResult.value) {
      const htmlContent = structuredResult.value as string;

      const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
      let match;
      while ((match = headingRegex.exec(htmlContent)) !== null) {
        structure.headings.push({
          level: parseInt(match[1] ?? '1'),
          text: stripHTML(match[2] ?? ''),
        });
      }

      const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
      while ((match = paragraphRegex.exec(htmlContent)) !== null) {
        const paragraphText = stripHTML(match[1] ?? '');
        if (paragraphText.trim().length > 0) {
          structure.paragraphs.push({ text: paragraphText });
        }
      }
    }

    return structure;
  } catch (error) {
    logger.warn('Failed to extract Word structure:', error);
    return structure;
  }
}

export function extractWordContent(
  structuredResult: Record<string, unknown>,
  logger: Logger
): OfficeContent {
  const content: OfficeContent = {
    mainContent: (structuredResult.value as string) || '',
    embeddedObjects: [],
    hyperlinks: [],
    comments: [],
    revisions: [],
    bookmarks: [],
  };

  try {
    if (structuredResult.value) {
      const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      let match;
      while (
        (match = linkRegex.exec(structuredResult.value as string)) !== null
      ) {
        content.hyperlinks.push({
          url: match[1] ?? '',
          text: stripHTML(match[2] ?? ''),
        });
      }
    }

    return content;
  } catch (error) {
    logger.warn('Failed to extract Word content:', error);
    return content;
  }
}

export function assessWordQuality(
  result: Record<string, unknown>,
  structuredResult: Record<string, unknown>,
  logger: Logger
): QualityMetrics {
  const metrics: QualityMetrics = {
    overall: 0,
    textCompleteness: 0,
    structurePreservation: 0,
    formattingAccuracy: 0,
    metadataExtraction: 0,
    contentIntegrity: 0,
  };

  try {
    const textLength = result.value
      ? (result.value as string).length
      : 0;
    metrics.textCompleteness = Math.min(1.0, textLength / 1000);

    const sv = structuredResult.value as string | undefined;
    const headingCount = sv
      ? (sv.match(/<h[1-6]/gi) || []).length
      : 0;
    const paragraphCount = sv ? (sv.match(/<p/gi) || []).length : 0;
    metrics.structurePreservation = Math.min(
      1.0,
      (headingCount + paragraphCount) / 20
    );

    const formattingElements = sv
      ? (sv.match(/<(strong|em|u|span)/gi) || []).length
      : 0;
    metrics.formattingAccuracy = Math.min(1.0, formattingElements / 10);

    metrics.overall =
      metrics.textCompleteness * 0.3 +
      metrics.structurePreservation * 0.25 +
      metrics.formattingAccuracy * 0.25 +
      metrics.metadataExtraction * 0.2;

    metrics.contentIntegrity = metrics.overall;

    return metrics;
  } catch (error) {
    logger.warn('Failed to assess Word quality:', error);
    return metrics;
  }
}
