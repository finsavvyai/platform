/**
 * Office Processor - Excel Document Helpers
 * Metadata, structure, content extraction and quality assessment
 */

import { Logger } from '../../utils/logger';
import type { Workbook } from 'exceljs';
import type {
  OfficeMetadata,
  DocumentStructure,
  OfficeContent,
  QualityMetrics,
  Table,
} from './types';

export function extractExcelMetadata(
  workbook: Workbook,
  sheetCount: number,
  logger: Logger
): OfficeMetadata {
  const metadata: OfficeMetadata = {
    sheetCount,
    isTemplate: false,
    hasMacros: false,
    hasEmbeddedContent: false,
  };

  try {
    const workbookLike = workbook as Workbook & {
      title?: string;
      subject?: string;
      keywords?: string;
      category?: string;
      comments?: string;
      language?: string;
      model?: { media?: unknown[] };
      definedNames?: { model?: Array<{ name?: string }> };
    };

    metadata.title = workbookLike.title;
    metadata.subject = workbookLike.subject;
    metadata.author = workbook.creator;
    metadata.lastModifiedBy = workbook.lastModifiedBy;
    metadata.creationDate = workbook.created;
    metadata.modificationDate = workbook.modified;
    metadata.category = workbookLike.category;
    metadata.comments = workbookLike.comments;
    metadata.language = workbookLike.language;
    metadata.keywords = workbookLike.keywords
      ? workbookLike.keywords
          .split(',')
          .map((keyword) => keyword.trim())
          .filter(Boolean)
      : undefined;
    metadata.hasEmbeddedContent = (workbookLike.model?.media?.length || 0) > 0;

    return metadata;
  } catch (error) {
    logger.warn('Failed to extract Excel metadata:', error);
    return metadata;
  }
}

export function extractExcelStructure(tables: Table[]): DocumentStructure {
  const structure: DocumentStructure = {
    headings: [],
    paragraphs: [],
    tables,
    lists: [],
    sections: [],
    footnotes: [],
    endnotes: [],
    headers: [],
    footers: [],
  };

  tables.forEach((table) => {
    if (table.title) {
      structure.headings.push({ level: 2, text: table.title });
    }
  });

  return structure;
}

export function extractExcelContent(
  workbook: Workbook,
  tables: Table[],
  logger: Logger
): OfficeContent {
  const content: OfficeContent = {
    mainContent: tables
      .map((table: Table) =>
        table.title
          ? `${table.title}\n${table.data.map((row: string[]) => row.join('\t')).join('\n')}`
          : table.data
              .map((row: string[]) => row.join('\t'))
              .join('\n')
      )
      .join('\n\n'),
    embeddedObjects: [],
    hyperlinks: [],
    comments: [],
    revisions: [],
    bookmarks: [],
  };

  try {
    const namedRanges =
      (workbook as Workbook & { definedNames?: { model?: Array<{ name?: string }> } })
        .definedNames?.model || [];
    namedRanges.forEach((namedRange) => {
      const rangeName = String(namedRange.name || '');
      if (rangeName) {
        content.bookmarks.push({ id: rangeName, name: rangeName });
      }
    });

    return content;
  } catch (error) {
    logger.warn('Failed to extract Excel content:', error);
    return content;
  }
}

export function assessExcelQuality(
  workbook: Workbook,
  tables: Table[],
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
    const totalCells = tables.reduce(
      (sum, table) => sum + table.rows * table.columns,
      0
    );
    const nonEmptyCells = tables.reduce(
      (sum, table) =>
        sum +
        table.data.flat().filter((cell) => cell.trim().length > 0).length,
      0
    );
    metrics.textCompleteness =
      totalCells > 0 ? nonEmptyCells / totalCells : 0;

    metrics.structurePreservation = tables.length > 0 ? 0.9 : 0.1;
    metrics.formattingAccuracy = 0.9;
    metrics.metadataExtraction =
      workbook.creator || workbook.created || workbook.modified ? 0.8 : 0.3;

    metrics.overall =
      metrics.textCompleteness * 0.3 +
      metrics.structurePreservation * 0.25 +
      metrics.formattingAccuracy * 0.25 +
      metrics.metadataExtraction * 0.2;

    metrics.contentIntegrity = metrics.overall;

    return metrics;
  } catch (error) {
    logger.warn('Failed to assess Excel quality:', error);
    return metrics;
  }
}
