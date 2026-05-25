// @ts-nocheck
/**
 * Types for Policy Version Management
 */

import { PolicyVersion } from '@/types/policy-management';

export interface VersionComparison {
  version1: PolicyVersion;
  version2: PolicyVersion;
  differences: VersionDiff[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
}

export interface VersionDiff {
  type: 'added' | 'removed' | 'modified';
  path: string;
  oldValue?: string;
  newValue?: string;
  lineNumber?: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface VersionMetrics {
  deployments: number;
  rollbacks: number;
  avgPerformance: number;
  errorRate: number;
  lastDeployed?: Date;
  successRate: number;
}

export interface PolicyVersionManagementProps {
  policyId: string;
  versions: PolicyVersion[];
  onVersionSelect?: (version: PolicyVersion) => void;
  onVersionCompare?: (v1: PolicyVersion, v2: PolicyVersion) => void;
  onVersionRestore?: (version: PolicyVersion) => void;
}
