/**
 * Badge Generator
 * Generates embeddable SVG/PNG badges with quality scores
 */

import { BadgeConfig, BadgeData, QestroScore, ScoreGrade } from './types.js';
import { logger } from '../../utils/logger.js';

class BadgeGenerator {
  private colorMap: Record<ScoreGrade, string> = {
    A: '#28a745',
    B: '#0275d8',
    C: '#ffc107',
    D: '#fd7e14',
    F: '#dc3545',
  };

  private gradeLabels: Record<ScoreGrade, string> = {
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D',
    F: 'F',
  };

  /**
   * Generate SVG badge
   */
  generateBadge(score: QestroScore, config: Partial<BadgeConfig> = {}): string {
    const color = config.colorScheme?.[score.grade] || this.colorMap[score.grade];
    const scoreDisplay = `${score.totalScore.toFixed(1)}/100`;
    const gradeDisplay = config.includeGrade !== false ? ` ${score.grade}` : '';
    const label = `Qestro Score${gradeDisplay}`;
    const value = scoreDisplay;

    return this.generateShields(label, value, color, config.style || 'flat');
  }

  /**
   * Generate Shields.io compatible SVG
   */
  private generateShields(label: string, value: string, color: string, style: string = 'flat'): string {
    const labelWidth = label.length * 7 + 12;
    const valueWidth = value.length * 7 + 12;
    const totalWidth = labelWidth + valueWidth;

    if (style === 'flat-square') {
      return this.generateFlatSquare(label, value, labelWidth, valueWidth, totalWidth, color);
    }

    return this.generateFlat(label, value, labelWidth, valueWidth, totalWidth, color);
  }

  /**
   * Generate flat-style SVG badge
   */
  private generateFlat(
    label: string,
    value: string,
    labelWidth: number,
    valueWidth: number,
    totalWidth: number,
    color: string
  ): string {
    const height = 20;
    const labelEnd = labelWidth;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${height}" role="img" aria-label="${label}: ${value}">
      <title>${label}: ${value}</title>
      <linearGradient id="s" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb"/>
        <stop offset="1" stop-color="#999"/>
      </linearGradient>
      <clipPath id="r">
        <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
      </clipPath>
      <g clip-path="url(#r)">
        <rect width="${labelEnd}" height="${height}" fill="#555"/>
        <rect x="${labelEnd}" width="${valueWidth}" height="${height}" fill="${color}"/>
        <rect width="${totalWidth}" height="${height}" fill="url(#s)" opacity="0.1"/>
      </g>
      <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
        <text aria-hidden="true" x="${labelEnd / 2}" y="15" fill="#010101" fill-opacity="0.3" transform="scale(0.9)" textLength="${labelEnd - 4}">${label}</text>
        <text x="${labelEnd / 2}" y="14" transform="scale(0.9)" fill="#fff" textLength="${labelEnd - 4}">${label}</text>
        <text aria-hidden="true" x="${labelEnd + valueWidth / 2}" y="15" fill="#010101" fill-opacity="0.3" transform="scale(0.9)" textLength="${valueWidth - 4}">${value}</text>
        <text x="${labelEnd + valueWidth / 2}" y="14" transform="scale(0.9)" fill="#fff" textLength="${valueWidth - 4}">${value}</text>
      </g>
    </svg>`;
  }

  /**
   * Generate flat-square-style SVG badge
   */
  private generateFlatSquare(
    label: string,
    value: string,
    labelWidth: number,
    valueWidth: number,
    totalWidth: number,
    color: string
  ): string {
    const height = 20;
    const labelEnd = labelWidth;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${height}" role="img" aria-label="${label}: ${value}">
      <title>${label}: ${value}</title>
      <g shape-rendering="crispEdges">
        <rect width="${labelEnd}" height="${height}" fill="#555"/>
        <rect x="${labelEnd}" width="${valueWidth}" height="${height}" fill="${color}"/>
      </g>
      <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
        <text x="${labelEnd / 2}" y="14" textLength="${labelEnd - 4}">${label}</text>
        <text x="${labelEnd + valueWidth / 2}" y="14" textLength="${valueWidth - 4}">${value}</text>
      </g>
    </svg>`;
  }

  /**
   * Generate markdown badge syntax
   */
  generateMarkdown(projectId: string, score: QestroScore, baseUrl: string = 'http://localhost:3000'): string {
    const badgeUrl = `${baseUrl}/api/score/${projectId}/badge.svg`;
    const linkUrl = `${baseUrl}/projects/${projectId}`;

    return `[![Qestro Score](${badgeUrl})](${linkUrl})`;
  }

  /**
   * Generate HTML embed code
   */
  getEmbedCode(projectId: string, baseUrl: string = 'http://localhost:3000'): string {
    const badgeUrl = `${baseUrl}/api/score/${projectId}/badge.svg`;

    return `<!-- Qestro Score Badge -->
<a href="${baseUrl}/projects/${projectId}">
  <img src="${badgeUrl}" alt="Qestro Score" />
</a>`;
  }

  /**
   * Generate badge metadata (for JSON endpoint)
   */
  generateMetadata(score: QestroScore): BadgeData {
    return {
      projectId: score.projectId,
      score: score.totalScore,
      grade: score.grade,
      color: this.colorMap[score.grade],
      lastUpdated: score.lastUpdated,
    };
  }

  /**
   * Get color for score
   */
  getColor(grade: ScoreGrade): string {
    return this.colorMap[grade];
  }

  /**
   * Get grade label
   */
  getGradeLabel(grade: ScoreGrade): string {
    return this.gradeLabels[grade];
  }
}

export const badgeGenerator = new BadgeGenerator();
