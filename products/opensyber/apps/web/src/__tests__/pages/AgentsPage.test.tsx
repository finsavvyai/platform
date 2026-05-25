import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AgentsPage from '@/app/dashboard/agents/page';

vi.mock('@/components/dashboard/AgentsSkeleton', () => ({
  AgentsSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('@/components/dashboard/RiskTrendChart', () => ({
  RiskTrendChart: () => <div data-testid="risk-trend" />,
}));
vi.mock('@/app/dashboard/agents/CloudFindings', () => ({
  CloudFindings: () => <div data-testid="cloud-findings" />,
}));
vi.mock('@/app/dashboard/agents/agents-helpers', () => ({
  RISK_COLORS: { critical: '', high: '', medium: '', low: '' },
  RISK_BG: { critical: '', high: '', medium: '', low: '' },
  computeScore: () => 85,
  scoreColor: () => 'text-green-400',
  scoreLabel: () => 'Good',
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AgentsPage', () => {
  it('renders heading', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ summary: null }),
    });

    render(<AgentsPage />);
    expect(screen.getByText('Agent Activity')).toBeInTheDocument();
  });

  it('shows empty state when no summary', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ summary: null }),
    });

    render(<AgentsPage />);
    await waitFor(() => {
      expect(
        screen.getByText('No agent activity synced yet'),
      ).toBeInTheDocument();
    });
  });

  it('shows install extension link', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ summary: null }),
    });

    render(<AgentsPage />);
    expect(screen.getByText('Install Extension')).toBeInTheDocument();
  });

  it('renders score and severity labels when summary exists', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          summary: {
            total: 10,
            critical: 1,
            high: 2,
            medium: 3,
            low: 4,
            secretsDetected: 0,
          },
        }),
    });

    render(<AgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('Secrets')).toBeInTheDocument();
    });
  });
});
