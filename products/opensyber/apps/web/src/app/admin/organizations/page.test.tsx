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
      { id: 'o1', name: 'Acme', slug: 'acme', ownerName: 'Alice', memberCount: 5, plan: 'pro', createdAt: '2026-01-01' },
    ],
  }),
}));

import AdminOrgsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminOrgsPage', () => {
  it('renders page title', async () => {
    const jsx = await AdminOrgsPage();
    render(jsx);
    expect(screen.getByText('Organizations')).toBeDefined();
    expect(screen.getByText('All registered organizations')).toBeDefined();
  });

  it('renders org rows', async () => {
    const jsx = await AdminOrgsPage();
    render(jsx);
    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.getByText('acme')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('renders empty state when no orgs', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient).mockResolvedValueOnce({ data: [] });
    const jsx = await AdminOrgsPage();
    render(jsx);
    expect(screen.getByText('No organizations')).toBeDefined();
  });
});
