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
      { id: 'i1', name: 'Agent A', ownerEmail: 'alice@ex.com', status: 'running', region: 'eu', createdAt: '2026-01-01' },
      { id: 'i2', name: 'Agent B', ownerEmail: null, status: 'stopped', region: null, createdAt: '2026-02-01' },
    ],
  }),
}));

import AdminInstancesPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminInstancesPage', () => {
  it('renders page title', async () => {
    const jsx = await AdminInstancesPage();
    render(jsx);
    expect(screen.getByText('Instances')).toBeDefined();
    expect(screen.getByText('All deployed agent instances')).toBeDefined();
  });

  it('renders instance rows', async () => {
    const jsx = await AdminInstancesPage();
    render(jsx);
    expect(screen.getByText('Agent A')).toBeDefined();
    expect(screen.getByText('alice@ex.com')).toBeDefined();
    expect(screen.getByText('running')).toBeDefined();
    expect(screen.getByText('Agent B')).toBeDefined();
  });

  it('renders empty state when no instances', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient).mockResolvedValueOnce({ data: [] });
    const jsx = await AdminInstancesPage();
    render(jsx);
    expect(screen.getByText('No instances')).toBeDefined();
  });

  it('shows dash for missing owner and region', async () => {
    const jsx = await AdminInstancesPage();
    render(jsx);
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
