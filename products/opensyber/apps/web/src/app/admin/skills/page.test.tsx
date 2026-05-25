/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockResolvedValue({
    data: [
      { id: 's1', name: 'Port Scanner', description: 'Scans ports', createdAt: '2026-03-01' },
      { id: 's2', name: 'Log Analyzer', description: null, createdAt: '2026-03-02' },
    ],
  }),
}));

import AdminSkillsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminSkillsPage', () => {
  it('renders page title', async () => {
    const jsx = await AdminSkillsPage();
    render(jsx);
    expect(screen.getByText('Skills Moderation')).toBeDefined();
  });

  it('shows pending count', async () => {
    const jsx = await AdminSkillsPage();
    render(jsx);
    expect(screen.getByText(/2 pending/)).toBeDefined();
  });

  it('renders skill cards', async () => {
    const jsx = await AdminSkillsPage();
    render(jsx);
    expect(screen.getByText('Port Scanner')).toBeDefined();
    expect(screen.getByText('Log Analyzer')).toBeDefined();
  });

  it('renders empty state when no pending skills', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient).mockResolvedValueOnce({ data: [] });
    const jsx = await AdminSkillsPage();
    render(jsx);
    expect(screen.getByText('No pending skills')).toBeDefined();
  });
});
