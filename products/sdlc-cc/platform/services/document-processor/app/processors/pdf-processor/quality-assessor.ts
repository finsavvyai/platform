import { Logger } from '../../utils/logger';
import { PDFExtractionResult, QualityMetrics } from './types';

const logger = new Logger('PDFQualityAssessor');

export async function assessQuality(
  result: PDFExtractionResult,
): Promise<QualityMetrics> {
  const metrics: QualityMetrics = {
    overall: 0,
    textClarity: 0,
    structurePreservation: 0,
    extractionCompleteness: 0,
    formattingAccuracy: 0,
  };

  try {
    const avgPageQuality =
      result.pages.reduce((sum, page) => sum + page.quality, 0) /
      result.pages.length;
    metrics.textClarity = avgPageQuality;

    metrics.structurePreservation =
      await assessStructurePreservation(result);

    metrics.extractionCompleteness =
      await assessExtractionCompleteness(result);

    metrics.formattingAccuracy =
      await assessFormattingAccuracy(result);

    metrics.overall =
      metrics.textClarity * 0.3 +
      metrics.structurePreservation * 0.25 +
      metrics.extractionCompleteness * 0.25 +
      metrics.formattingAccuracy * 0.2;

    return metrics;
  } catch (error) {
    logger.warn('Failed to assess quality:', error);
    return metrics;
  }
}

async function assessStructurePreservation(
  result: PDFExtractionResult,
): Promise<number> {
  let score = 1.0;

  const pageCount = result.pages.length;
  if (pageCount === 0) score *= 0.1;
  else if (pageCount === 1) score *= 0.8;

  const hasStructure = /\n\s*[A-Z][^.]*\n/.test(result.text);
  if (!hasStructure) score *= 0.9;

  return Math.max(0.1, Math.min(1.0, score));
}

async function assessExtractionCompleteness(
  result: PDFExtractionResult,
): Promise<number> {
  let score = 1.0;

  const pagesWithText = result.pages.filter(
    (page) => page.text.trim().length > 0,
  ).length;
  const textCompleteness = pagesWithText / result.pages.length;
  score *= textCompleteness;

  const metadataFields = Object.values(result.metadata).filter(
    (value) => value !== undefined,
  ).length;
  const metadataCompleteness = metadataFields / 8;
  score *= 0.7 + 0.3 * metadataCompleteness;

  return Math.max(0.1, Math.min(1.0, score));
}

async function assessFormattingAccuracy(
  result: PDFExtractionResult,
): Promise<number> {
  let score = 1.0;

  const lineBreakCount = (result.text.match(/\n/g) || []).length;
  const expectedLineBreaks = result.pages.length * 10;
  const lineBreakRatio = Math.min(1.0, lineBreakCount / expectedLineBreaks);
  score *= 0.5 + 0.5 * lineBreakRatio;

  const hasMultipleSpaces = /\s{2,}/.test(result.text);
  if (hasMultipleSpaces) score *= 0.95;

  return Math.max(0.1, Math.min(1.0, score));
}
