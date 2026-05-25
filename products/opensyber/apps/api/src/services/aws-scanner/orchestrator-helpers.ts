import type { AwsScanResult } from './orchestrator.js';

/**
 * Default regions to scan if not specified
 */
export const DEFAULT_REGION = 'us-east-1';

/**
 * Batch size for inserting findings (D1 limit)
 */
export const FINDING_BATCH_SIZE = 100;

/**
 * Create a failed scan result with an error message
 */
export function failedResult(error: string): AwsScanResult {
  return {
    scanRunId: '',
    status: 'failed',
    findingCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    error,
  };
}

/**
 * Extract AWS account ID from role ARN
 * ARN format: arn:aws:iam::{account_id}:role/{role_name}
 */
export function extractAccountIdFromArn(roleArn: string): string | null {
  const match = roleArn.match(/^arn:aws:iam::(\d{12}):role\/[^/]+$/);
  return match ? match[1] ?? null : null;
}

/**
 * Count findings by severity
 */
export function countBySeverity(findings: Array<{ severity: string }>): {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
} {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const finding of findings) {
    switch (finding.severity) {
      case 'critical':
        criticalCount++;
        break;
      case 'high':
        highCount++;
        break;
      case 'medium':
        mediumCount++;
        break;
      case 'low':
        lowCount++;
        break;
    }
  }

  return { criticalCount, highCount, mediumCount, lowCount };
}
