import { Project } from './types';

export const mockProjects: Project[] = [
  {
    id: 'proj-001',
    repo: 'acme/web-app',
    platform: 'github',
    lastRunStatus: 'passed',
    connectedDate: '2026-02-14',
    url: 'https://github.com/acme/web-app',
  },
  {
    id: 'proj-002',
    repo: 'acme/api-service',
    platform: 'github',
    lastRunStatus: 'failed',
    connectedDate: '2026-03-01',
    url: 'https://github.com/acme/api-service',
  },
  {
    id: 'proj-003',
    repo: 'acme/infra',
    platform: 'gitlab',
    lastRunStatus: 'passed',
    connectedDate: '2026-03-20',
    url: 'https://gitlab.com/acme/infra',
  },
  {
    id: 'proj-004',
    repo: 'acme/mobile-app',
    platform: 'bitbucket',
    lastRunStatus: 'passed',
    connectedDate: '2026-01-10',
    url: 'https://bitbucket.org/acme/mobile-app',
  },
];
