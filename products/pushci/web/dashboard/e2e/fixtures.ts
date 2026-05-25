import type { Page } from '@playwright/test';

export const mockUser = {
  login: 'testuser',
  avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
  name: 'Test User',
  provider: 'github' as const,
};

export const mockRuns = [
  {
    id: 'run-001',
    repo: 'testuser/my-app',
    branch: 'main',
    sha: 'abc1234',
    status: 'passed' as const,
    duration_ms: 12500,
    created_at: new Date().toISOString(),
    commit_message: 'fix: resolve login redirect',
    trigger: 'push',
  },
  {
    id: 'run-002',
    repo: 'testuser/my-app',
    branch: 'feat/dashboard',
    sha: 'def5678',
    status: 'failed' as const,
    duration_ms: 8300,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    commit_message: 'feat: add analytics page',
    trigger: 'push',
  },
  {
    id: 'run-003',
    repo: 'testuser/api-service',
    branch: 'main',
    sha: '789abcd',
    status: 'running' as const,
    duration_ms: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
    commit_message: 'chore: update dependencies',
    trigger: 'webhook',
  },
];

export const mockProjects = [
  {
    id: 'proj-001',
    repo: 'testuser/my-app',
    platform: 'github' as const,
    created_at: new Date().toISOString(),
    last_run_status: 'passed',
    webhook_secret: 'whsec_test123',
  },
  {
    id: 'proj-002',
    repo: 'testuser/api-service',
    platform: 'github' as const,
    created_at: new Date().toISOString(),
    last_run_status: 'running',
    webhook_secret: 'whsec_test456',
  },
];

/**
 * Sets up localStorage tokens to simulate an authenticated session.
 * Call this before navigating to authenticated pages.
 */
export async function setupAuth(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem('pushci_token', 'test-jwt-token-for-e2e');
    localStorage.setItem('pushci_user', JSON.stringify(user));
  }, mockUser);
}
