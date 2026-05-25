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
    data: {
      mrr: 4500,
      planDistribution: { free: 80, pro: 15, team: 5 },
      recentSubscriptions: [
        { userId: 'u1', userName: 'Alice', plan: 'pro', createdAt: '2026-03-01' },
      ],
    },
  }),
}));

import AdminBillingPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminBillingPage', () => {
  it('renders page title', async () => {
    const jsx = await AdminBillingPage();
    render(jsx);
    expect(screen.getByText('Billing')).toBeDefined();
  });

  it('renders MRR value', async () => {
    const jsx = await AdminBillingPage();
    render(jsx);
    expect(screen.getByText('$4,500')).toBeDefined();
  });

  it('renders plan distribution', async () => {
    const jsx = await AdminBillingPage();
    render(jsx);
    expect(screen.getByText('free')).toBeDefined();
    expect(screen.getByText('80 users')).toBeDefined();
  });

  it('renders recent subscriptions', async () => {
    const jsx = await AdminBillingPage();
    render(jsx);
    expect(screen.getByText('Recent Subscriptions')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('renders empty subscription state', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient).mockResolvedValueOnce({
      data: { mrr: 0, planDistribution: {}, recentSubscriptions: [] },
    });
    const jsx = await AdminBillingPage();
    render(jsx);
    expect(screen.getByText('No recent subscriptions.')).toBeDefined();
  });
});
