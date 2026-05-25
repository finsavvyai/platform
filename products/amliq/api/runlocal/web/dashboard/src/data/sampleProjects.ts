// Sample placeholder data shown while the API is loading.
// This is NOT real data. It is replaced once the API responds.

import { Project } from './types';

export const sampleProjects: Project[] = [
  {
    id: 'sample-001',
    repo: 'example-org/web-app',
    platform: 'github',
    lastRunStatus: 'passed',
    connectedDate: '2026-01-01',
    url: 'https://github.com/example-org/web-app',
  },
  {
    id: 'sample-002',
    repo: 'example-org/api-service',
    platform: 'github',
    lastRunStatus: 'failed',
    connectedDate: '2026-01-15',
    url: 'https://github.com/example-org/api-service',
  },
];
