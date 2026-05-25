/**
 * Unit tests for admin analytics Victory chart components.
 * Covers plan distribution, revenue trend, conversion funnel,
 * and skill popularity — including null-return guards and edge cases.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PlanDistributionChart,
  RevenueTrendChart,
  ConversionFunnelChart,
  SkillPopularityChart,
} from './admin-charts.js';

// ---------------------------------------------------------------------------
// Mock Victory — VictoryTheme forwarded from real module so theme.ts spreads
// VictoryTheme.grayscale without errors. All chart primitives are stubs.
// ---------------------------------------------------------------------------
vi.mock('victory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('victory')>();
  const stub =
    (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': testId }, children);

  return {
    ...actual,
    VictoryChart: stub('victory-chart'),
    VictoryLine: stub('victory-line'),
    VictoryBar: stub('victory-bar'),
    VictoryPie: stub('victory-pie'),
    VictoryArea: stub('victory-area'),
    VictoryAxis: stub('victory-axis'),
    VictoryTooltip: stub('victory-tooltip'),
    VictoryGroup: stub('victory-group'),
    VictoryLegend: stub('victory-legend'),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const planData = [
  { plan: 'free', count: 1200 },
  { plan: 'pro', count: 340 },
  { plan: 'team', count: 80 },
  { plan: 'enterprise', count: 15 },
];

const revenueData = [
  { date: '2024-01-01', mrr: 5000, arr: 60000 },
  { date: '2024-02-01', mrr: 6200, arr: 74400 },
  { date: '2024-03-01', mrr: 7800, arr: 93600 },
];

const funnelData = [
  { stage: 'Signup', count: 1000 },
  { stage: 'Activated', count: 600 },
  { stage: 'Trial', count: 300 },
  { stage: 'Paid', count: 120 },
];

const skillData = [
  { name: 'ai-triage', installs: 850 },
  { name: 'ai-remediation', installs: 620 },
  { name: 'ai-compliance-writer', installs: 410 },
];

// ---------------------------------------------------------------------------
// PlanDistributionChart
// ---------------------------------------------------------------------------

describe('PlanDistributionChart', () => {
  it('renders VictoryPie with valid plan data', () => {
    render(<PlanDistributionChart data={planData} />);
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('renders with empty data without throwing', () => {
    expect(() => render(<PlanDistributionChart data={[]} />)).not.toThrow();
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('renders with a single plan entry', () => {
    render(<PlanDistributionChart data={[{ plan: 'free', count: 50 }]} />);
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('is standalone — not wrapped in VictoryChart', () => {
    const { container } = render(<PlanDistributionChart data={planData} />);
    expect(container.querySelectorAll('[data-testid="victory-chart"]')).toHaveLength(0);
  });

  it('renders with zero-count plans without throwing', () => {
    expect(() =>
      render(
        <PlanDistributionChart
          data={[
            { plan: 'free', count: 0 },
            { plan: 'pro', count: 0 },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// RevenueTrendChart
// ---------------------------------------------------------------------------

describe('RevenueTrendChart', () => {
  it('renders chart, legend, area (MRR), and line (ARR) with valid data', () => {
    render(<RevenueTrendChart data={revenueData} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('victory-legend')).toBeInTheDocument();
    expect(screen.getByTestId('victory-area')).toBeInTheDocument();
    expect(screen.getByTestId('victory-line')).toBeInTheDocument();
  });

  it('returns null for empty data', () => {
    const { container } = render(<RevenueTrendChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for exactly 1 data point', () => {
    const { container } = render(
      <RevenueTrendChart data={[{ date: '2024-01-01', mrr: 1000, arr: 12000 }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with exactly 2 data points (minimum valid)', () => {
    render(<RevenueTrendChart data={revenueData.slice(0, 2)} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders with MRR values in thousands range', () => {
    const bigRevenue = [
      { date: '2024-01-01', mrr: 50000, arr: 600000 },
      { date: '2024-02-01', mrr: 75000, arr: 900000 },
    ];
    expect(() => render(<RevenueTrendChart data={bigRevenue} />)).not.toThrow();
  });

  it('renders with zero revenue without throwing', () => {
    expect(() =>
      render(
        <RevenueTrendChart
          data={[
            { date: '2024-01-01', mrr: 0, arr: 0 },
            { date: '2024-02-01', mrr: 0, arr: 0 },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ConversionFunnelChart
// ---------------------------------------------------------------------------

describe('ConversionFunnelChart', () => {
  it('renders horizontal VictoryChart with a bar', () => {
    render(<ConversionFunnelChart data={funnelData} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('victory-bar')).toBeInTheDocument();
  });

  it('renders with empty data without throwing', () => {
    expect(() => render(<ConversionFunnelChart data={[]} />)).not.toThrow();
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders with a single conversion stage', () => {
    render(<ConversionFunnelChart data={[{ stage: 'Signup', count: 500 }]} />);
    expect(screen.getByTestId('victory-bar')).toBeInTheDocument();
  });

  it('renders with more than 6 stages (wraps PIE_PALETTE index)', () => {
    const manyStages = Array.from({ length: 8 }, (_, i) => ({
      stage: `Stage ${i + 1}`,
      count: 100 - i * 10,
    }));
    expect(() => render(<ConversionFunnelChart data={manyStages} />)).not.toThrow();
  });

  it('renders with zero counts without throwing', () => {
    expect(() =>
      render(
        <ConversionFunnelChart
          data={[
            { stage: 'Signup', count: 0 },
            { stage: 'Paid', count: 0 },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// SkillPopularityChart
// ---------------------------------------------------------------------------

describe('SkillPopularityChart', () => {
  it('renders horizontal VictoryChart with bar for each skill', () => {
    render(<SkillPopularityChart data={skillData} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('victory-bar')).toBeInTheDocument();
  });

  it('renders with empty data without throwing', () => {
    expect(() => render(<SkillPopularityChart data={[]} />)).not.toThrow();
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders with a single skill entry', () => {
    render(<SkillPopularityChart data={[{ name: 'ai-triage', installs: 100 }]} />);
    expect(screen.getByTestId('victory-bar')).toBeInTheDocument();
  });

  it('renders with skill that has zero installs', () => {
    render(
      <SkillPopularityChart
        data={[
          { name: 'new-skill', installs: 0 },
          { name: 'popular-skill', installs: 999 },
        ]}
      />,
    );
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders long skill names without throwing', () => {
    const longNames = Array.from({ length: 10 }, (_, i) => ({
      name: `ai-very-long-skill-name-number-${i + 1}`,
      installs: (i + 1) * 50,
    }));
    expect(() => render(<SkillPopularityChart data={longNames} />)).not.toThrow();
  });
});
