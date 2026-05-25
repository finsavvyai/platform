/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockResolvedValue({
    data: [
      { id: 'u1', email: 'a@ex.com', name: 'Alice', plan: 'pro', isAdmin: false, isSuspended: false, createdAt: '2026-01-01' },
    ],
    nextCursor: null,
    hasMore: false,
  }),
}));

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

import AdminUsersPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminUsersPage', () => {
  it('renders page title', async () => {
    const jsx = await AdminUsersPage();
    render(jsx);
    expect(screen.getByText('Users')).toBeDefined();
    expect(screen.getByText('Manage platform users')).toBeDefined();
  });

  it('renders user table when users exist', async () => {
    const jsx = await AdminUsersPage();
    render(jsx);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('a@ex.com')).toBeDefined();
  });

  it('renders empty state when no users', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient).mockResolvedValueOnce({
      data: [], nextCursor: null, hasMore: false,
    });
    const jsx = await AdminUsersPage();
    render(jsx);
    expect(screen.getByText('No users found')).toBeDefined();
  });
});
