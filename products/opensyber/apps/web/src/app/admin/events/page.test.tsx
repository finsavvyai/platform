/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockResolvedValue({
    data: [
      { id: 'e1', instanceId: 'i1', type: 'intrusion', severity: 'critical', message: 'Port scan detected', createdAt: '2026-03-01' },
      { id: 'e2', instanceId: 'i2', type: 'auth', severity: 'low', message: null, createdAt: '2026-03-02' },
    ],
    nextCursor: 'cursor-abc',
    hasMore: true,
  }),
}));

import AdminEventsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminEventsPage', () => {
  it('renders page title', async () => {
    const jsx = await AdminEventsPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText('Events')).toBeDefined();
    expect(screen.getByText('System-wide security event stream')).toBeDefined();
  });

  it('renders event rows', async () => {
    const jsx = await AdminEventsPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText('critical')).toBeDefined();
    expect(screen.getByText('intrusion')).toBeDefined();
    expect(screen.getByText('Port scan detected')).toBeDefined();
  });

  it('shows dash for null message', async () => {
    const jsx = await AdminEventsPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText('\u2014')).toBeDefined();
  });

  it('renders Load More link when hasMore', async () => {
    const jsx = await AdminEventsPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText('Load More')).toBeDefined();
  });

  it('renders empty state when no events', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient).mockResolvedValueOnce({
      data: [], nextCursor: null, hasMore: false,
    });
    const jsx = await AdminEventsPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText('No events')).toBeDefined();
  });
});
