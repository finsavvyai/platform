/**
 * Alert utility functions for severity handling.
 */

import type { AlertSeverity, AlertFinding } from './types.js';

/**
 * Severity ranking for comparison
 */
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Check if a finding severity meets the minimum threshold
 */
export function meetsMinSeverity(
  findingSeverity: AlertSeverity,
  minSeverity: AlertSeverity,
): boolean {
  return SEVERITY_RANK[findingSeverity] >= SEVERITY_RANK[minSeverity];
}

/**
 * Filter findings by minimum severity
 */
export function filterFindingsBySeverity(
  findings: AlertFinding[],
  minSeverity: AlertSeverity,
): AlertFinding[] {
  return findings.filter((f) => meetsMinSeverity(f.severity, minSeverity));
}

/**
 * Get color hex for severity
 */
export function getSeverityColor(severity: AlertSeverity): string {
  const colors = {
    critical: '#DC2626', // red-600
    high: '#EA580C',     // orange-600
    medium: '#CA8A04',   // yellow-600
    low: '#6B7280',      // gray-500
  };
  return colors[severity];
}

/**
 * Get emoji for severity
 */
export function getSeverityEmoji(severity: AlertSeverity): string {
  const emojis = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  return emojis[severity];
}
