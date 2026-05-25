/**
 * HTML Quality Assessment
 * Scores content extraction, structure, readability, accessibility, SEO
 */

import { Logger } from '../../utils/logger';
import type {
  HTMLProcessingResult,
  HTMLOptions,
  QualityMetrics,
} from './types';

export class QualityAssessor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async assess(
    result: HTMLProcessingResult,
    _options: HTMLOptions,
  ): Promise<QualityMetrics> {
    const metrics: QualityMetrics = {
      overall: 0,
      contentExtraction: 0,
      structurePreservation: 0,
      boilerplateRemoval: 0,
      readabilityScore: 0,
      accessibilityScore: 0,
      seoScore: 0,
    };

    try {
      metrics.contentExtraction =
        this.scoreContentExtraction(result);
      metrics.structurePreservation =
        this.scoreStructurePreservation(result);
      metrics.boilerplateRemoval =
        this.scoreBoilerplateRemoval(result);
      metrics.readabilityScore =
        result.content.readabilityScore / 100;
      metrics.accessibilityScore =
        this.scoreAccessibility(result);
      metrics.seoScore = this.scoreSEO(result);
      metrics.overall = this.calculateOverall(metrics);
      return metrics;
    } catch (error) {
      this.logger.warn('Failed to assess HTML quality:', error);
      return metrics;
    }
  }

  private scoreContentExtraction(
    result: HTMLProcessingResult,
  ): number {
    const mainLen = result.content.mainContent.length;
    const totalLen = result.text.length;
    return totalLen > 0 ? mainLen / totalLen : 0;
  }

  private scoreStructurePreservation(
    result: HTMLProcessingResult,
  ): number {
    const elements =
      result.structure.headings.length +
      result.structure.paragraphs.length +
      result.structure.tables.length +
      result.structure.lists.length;
    return Math.min(1.0, elements / 50);
  }

  private scoreBoilerplateRemoval(
    result: HTMLProcessingResult,
  ): number {
    if (result.content.boilerplateRemoved && result.text) {
      const ratio = 1 - (
        result.content.boilerplateRemoved.length / result.text.length
      );
      return Math.max(0, Math.min(1.0, ratio));
    }
    return 0;
  }

  private scoreAccessibility(
    result: HTMLProcessingResult,
  ): number {
    const checks = [
      result.structure.images.filter(img => img.alt).length /
        Math.max(1, result.structure.images.length),
      result.structure.headings.length > 0 ? 1 : 0,
      result.metadata.language ? 1 : 0,
    ];
    return checks.reduce((sum, s) => sum + s, 0) / checks.length;
  }

  private scoreSEO(result: HTMLProcessingResult): number {
    const checks = [
      result.metadata.title ? 1 : 0,
      result.metadata.description ? 1 : 0,
      result.metadata.keywords &&
        result.metadata.keywords.length > 0 ? 1 : 0,
      result.structure.headings.length > 0 ? 1 : 0,
    ];
    return checks.reduce((sum, s) => sum + s, 0) / checks.length;
  }

  private calculateOverall(metrics: QualityMetrics): number {
    return (
      metrics.contentExtraction * 0.25 +
      metrics.structurePreservation * 0.20 +
      metrics.boilerplateRemoval * 0.15 +
      metrics.readabilityScore * 0.15 +
      metrics.accessibilityScore * 0.15 +
      metrics.seoScore * 0.10
    );
  }
}
