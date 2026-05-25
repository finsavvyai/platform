// Sample placeholder data shown while the API is loading.
// This is NOT real data. It is replaced once the API responds.

import { CIRun } from './types';

export const sampleRuns: CIRun[] = [
  {
    id: 'sample-run-001',
    repo: 'example-org/web-app',
    branch: 'main',
    commitSha: '0000000',
    commitMsg: 'sample: placeholder commit',
    status: 'passed',
    duration: '0m 0s',
    timestamp: '2026-01-01T00:00:00Z',
    checks: [
      { name: 'Lint', status: 'passed', duration: '0s', output: 'Sample data.' },
      { name: 'Test', status: 'passed', duration: '0s', output: 'Sample data.' },
    ],
  },
];
