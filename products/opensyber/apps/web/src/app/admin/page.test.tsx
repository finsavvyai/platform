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
    data: {
      totalUsers: 100, totalInstances: 50, totalOrgs: 10, totalEvents: 500, activeInstances: 30,
      trustFunnel: {
        totalLeads: 5, recentLeads7d: 2, trustPageViews: 200, recentViews7d: 40,
        trustTrialStarts: 10, trustSignupViews: 15, trustDemoRequests: 3, topSources: [],
      },
    },
  }),
}));

import AdminDashboardPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminDashboardPage', () => {
  it('renders dashboard title', async () => {
    const jsx = await AdminDashboardPage();
    render(jsx);
    expect(screen.getByText('Admin Dashboard')).toBeDefined();
  });

  it('renders stat cards', async () => {
    const jsx = await AdminDashboardPage();
    render(jsx);
    expect(screen.getByText('Total Users')).toBeDefined();
    expect(screen.getByText('Total Instances')).toBeDefined();
    expect(screen.getByText('Organizations')).toBeDefined();
    expect(screen.getByText('Security Events')).toBeDefined();
  });

  it('renders stat values', async () => {
    const jsx = await AdminDashboardPage();
    render(jsx);
    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText('500')).toBeDefined();
  });

  it('renders active instances section', async () => {
    const jsx = await AdminDashboardPage();
    render(jsx);
    expect(screen.getByText('Active Instances')).toBeDefined();
    expect(screen.getByText('30')).toBeDefined();
  });

  it('renders trust funnel section', async () => {
    const jsx = await AdminDashboardPage();
    render(jsx);
    expect(screen.getByText('Trust Funnel')).toBeDefined();
    expect(screen.getByText('Trust Page Views')).toBeDefined();
    expect(screen.getByText('Trial Starts')).toBeDefined();
    expect(screen.getByText('Qualified Leads')).toBeDefined();
  });
});
