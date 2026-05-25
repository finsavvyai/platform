import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecurityPage from '@/app/dashboard/security/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/components/dashboard/security/ScoreHistoryChart', () => ({
  ScoreHistoryChart: () => <div data-testid="score-chart" />,
}));
vi.mock('@/components/dashboard/security/ThreatMapViz', () => ({
  ThreatMapViz: () => <div data-testid="threat-map" />,
}));
vi.mock('@/app/dashboard/security/security-helpers', () => ({} as any));
vi.mock('@/app/dashboard/security/security-cards', () => ({
  TopStatsRow: () => <div data-testid="top-stats" />,
  SkillsCard: () => <div />,
  LastHealthCard: () => <div />,
  CategoryBreakdown: () => <div />,
  RecentEventsTable: () => <div />,
}));

describe('SecurityPage', () => {
  it('renders heading and empty state when no token', async () => {
    const result = await SecurityPage();
    render(result);
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('No security data')).toBeInTheDocument();
  });

  it('renders deploy prompt in empty state', async () => {
    const result = await SecurityPage();
    render(result);
    expect(
      screen.getByText(/Deploy an instance to see security metrics/),
    ).toBeInTheDocument();
  });
});
