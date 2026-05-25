// @ts-nocheck
/**
 * Helper functions for Policy Impact Analysis
 */

import { RiskLevel } from '@/types/policy-management';

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'text-green-600 bg-green-100';
    case 'medium': return 'text-yellow-600 bg-yellow-100';
    case 'high': return 'text-orange-600 bg-orange-100';
    case 'critical': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function getSeverityColor(
  severity: 'low' | 'medium' | 'high' | 'critical'
): string {
  switch (severity) {
    case 'low': return 'text-green-600';
    case 'medium': return 'text-yellow-600';
    case 'high': return 'text-orange-600';
    case 'critical': return 'text-red-600';
    default: return 'text-gray-600';
  }
}
