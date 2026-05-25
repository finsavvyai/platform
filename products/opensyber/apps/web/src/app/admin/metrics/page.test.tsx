/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@opensyber/ui', () => ({
  PlanDistributionChart: () => null,
  RevenueTrendChart: () => null,
  ConversionFunnelChart: () => null,
  SkillPopularityChart: () => null,
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockResolvedValue({
    data: {
      snapshot: '2026-03-28T00:00:00Z',
      revenue: { mrr: 5000, arr: 60000, payingCustomers: 25, arpu: 200 },
      usage: { totalUsers: 300, totalOrgs: 20, totalInstances: 80, totalSkills: 22, totalSkillInstalls: 120, avgInstancesPerOrg: 4 },
      planBreakdown: { free: 250, pro: 40, team: 10 },
      conversion: { freeToPayingRate: 17 },
    },
  }),
}));

import MetricsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MetricsPage', () => {
  it('renders page title', async () => {
    const jsx = await MetricsPage();
    render(jsx);
    expect(screen.getByText('Series A Data Room')).toBeDefined();
  });

  it('renders revenue metrics', async () => {
    const jsx = await MetricsPage();
    render(jsx);
    expect(screen.getByText('$5,000')).toBeDefined();
    expect(screen.getByText('$60,000')).toBeDefined();
    expect(screen.getByText('25')).toBeDefined();
  });

  it('renders usage metrics', async () => {
    const jsx = await MetricsPage();
    render(jsx);
    expect(screen.getByText('300')).toBeDefined();
    expect(screen.getByText('80')).toBeDefined();
    expect(screen.getByText('120')).toBeDefined();
  });

  it('renders plan distribution chart', async () => {
    const jsx = await MetricsPage();
    render(jsx);
    // Plan distribution appears in both the grid heading and the chart panel
    expect(screen.getAllByText('Plan Distribution').length).toBeGreaterThanOrEqual(1);
  });

  it('renders conversion rate', async () => {
    const jsx = await MetricsPage();
    render(jsx);
    expect(screen.getByText('17%')).toBeDefined();
    expect(screen.getByText(/Free.*Paying conversion/)).toBeDefined();
  });

  it('renders admin required when no metrics', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('fail'));
    const jsx = await MetricsPage();
    render(jsx);
    expect(screen.getByText('Admin access required.')).toBeDefined();
  });
});
