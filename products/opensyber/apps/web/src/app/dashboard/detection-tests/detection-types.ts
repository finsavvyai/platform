/**
 * Types shared between detection validation components.
 */

export type SuiteCategory =
  | 'prompt-injection'
  | 'exfiltration'
  | 'supply-chain'
  | 'credential-probe'
  | 'tool-anomaly'
  | 'full';

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCount: number;
  category: SuiteCategory;
}

export interface TestCase {
  id: string;
  name: string;
  technique: string;
  payload: string;
  expectedDetection: string;
  result: 'pass' | 'fail' | 'pending';
  detectedAt?: string;
  latencyMs?: number;
}

export interface TestRun {
  id: string;
  suiteId: string;
  instanceId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalTests: number;
  passed: number;
  failed: number;
  tests: TestCase[];
}

/** Icon name mapping for suite categories */
export const SUITE_ICONS: Record<SuiteCategory, string> = {
  'prompt-injection': 'MessageSquareWarning',
  'exfiltration': 'Upload',
  'supply-chain': 'Package',
  'credential-probe': 'KeyRound',
  'tool-anomaly': 'Wrench',
  'full': 'Shield',
};
