import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TeamAgentsPage from '@/app/dashboard/agents/team/page';

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));
vi.mock('@/components/dashboard/TeamSkeleton', () => ({
  TeamSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('@/components/dashboard/RiskTrendChart', () => ({
  RiskTrendChart: () => <div data-testid="risk-trend" />,
}));
vi.mock('@/app/dashboard/agents/team/types', () => ({
  gradeColor: () => 'text-green-400',
  scoreToGrade: () => 'A',
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('TeamAgentsPage', () => {
  it('renders heading after loading', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          summary: {
            totalEvents: 10,
            critical: 0,
            high: 2,
            secretsDetected: 0,
            violations: 1,
            activeMembers: 3,
          },
          riskScore: { combined: 85, grade: 'A', agent: 80, cspm: 90 },
          members: [],
        }),
    });

    render(<TeamAgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Team Agents')).toBeInTheDocument();
    });
  });

  it('shows empty state when no summary', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ summary: null, members: [] }),
    });

    render(<TeamAgentsPage />);
    await waitFor(() => {
      expect(
        screen.getByText('No team activity yet'),
      ).toBeInTheDocument();
    });
  });
});
