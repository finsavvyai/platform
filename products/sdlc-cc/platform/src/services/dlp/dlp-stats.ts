/**
 * DLP Statistics and Reporting utilities
 */

import { TopViolationEntry } from '../../types/dlp';

export function groupBy(items: Record<string, unknown>[], key: string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = getNestedValue(item, key);
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const result = path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return String(result ?? 'unknown');
}

export function calculateAverage(items: Record<string, unknown>[], path: string): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((total, item) => {
    const value = getNestedValue(item, path);
    return total + (Number(value) || 0);
  }, 0);
  return Math.round(sum / items.length);
}

export function getTopViolations(violations: Record<string, unknown>[], limit: number): TopViolationEntry[] {
  const counts = groupBy(violations, 'ruleId');
  return Object.entries(counts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, limit)
    .map(([ruleId, count]) => ({ ruleId, count }));
}

export function generateRecommendations(
  classification: { type: string },
  violations: { severity: string }[]
): string[] {
  const recommendations: string[] = [];

  if (classification.type === 'PII' || classification.type === 'PHI') {
    recommendations.push('Consider encrypting or masking sensitive personal data');
    recommendations.push('Review access controls for this data type');
  }
  if (classification.type === 'FINANCIAL') {
    recommendations.push('Ensure PCI DSS compliance for financial data');
    recommendations.push('Implement additional monitoring for financial transactions');
  }
  if (violations.length > 0) {
    recommendations.push('Review and update DLP rules to reduce false positives');
    recommendations.push('Consider additional training for data handling procedures');
  }
  if (violations.some(v => v.severity === 'CRITICAL')) {
    recommendations.push('Immediate action required for critical violations');
    recommendations.push('Escalate to security team for review');
  }

  return recommendations;
}
