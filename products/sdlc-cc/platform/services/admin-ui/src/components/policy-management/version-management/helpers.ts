// @ts-nocheck
/**
 * Helper functions for Policy Version Management
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { PolicyVersion } from '@/types/policy-management';
import { VersionComparison, VersionDiff } from './types';

export function getRiskLevelColor(level: string): string {
  switch (level) {
    case 'low': return 'text-green-600 bg-green-100';
    case 'medium': return 'text-yellow-600 bg-yellow-100';
    case 'high': return 'text-orange-600 bg-orange-100';
    case 'critical': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function computeVersionComparison(
  v1: PolicyVersion,
  v2: PolicyVersion
): VersionComparison {
  const differences: VersionDiff[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;

  const lines1 = v1.regoCode.split('\n');
  const lines2 = v2.regoCode.split('\n');

  lines2.forEach((line, index) => {
    if (!lines1[index]) {
      differences.push({
        type: 'added',
        path: `rego:${index + 1}`,
        newValue: line,
        lineNumber: index + 1,
        impact: line.includes('allow') ? 'high' : 'low'
      });
      added++;
    } else if (lines1[index] !== line) {
      differences.push({
        type: 'modified',
        path: `rego:${index + 1}`,
        oldValue: lines1[index],
        newValue: line,
        lineNumber: index + 1,
        impact: line.includes('allow') ? 'high' : 'medium'
      });
      modified++;
    }
  });

  if (lines1.length > lines2.length) {
    lines1.slice(lines2.length).forEach((line, index) => {
      differences.push({
        type: 'removed',
        path: `rego:${lines2.length + index + 1}`,
        oldValue: line,
        lineNumber: lines2.length + index + 1,
        impact: line.includes('allow') ? 'high' : 'medium'
      });
      removed++;
    });
  }

  return {
    version1: v1,
    version2: v2,
    differences,
    summary: { added, removed, modified, total: added + removed + modified }
  };
}
