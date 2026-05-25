/**
 * Unit tests for Claw Gateway Victory chart components.
 * Victory is mocked to avoid SVG-in-jsdom issues; tests verify
 * that each component mounts, renders a root element, and passes
 * data down without throwing.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  AgentUsageChart,
  CostBreakdownChart,
  LatencyChart,
  CreditBalanceChart,
} from './gateway-charts.js';

// ---------------------------------------------------------------------------
// Mock Victory — all primitives render a labelled div so jsdom does not choke
// on SVG layout. VictoryTheme is forwarded from the real module so that
// theme.ts can spread VictoryTheme.grayscale without errors.
// ---------------------------------------------------------------------------
vi.mock('victory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('victory')>();
  const stub =
    (testId: string) =>
    ({ children, data }: { children?: React.ReactNode; data?: unknown }) =>
      React.createElement(
        'div',
        { 'data-testid': testId, 'data-count': Array.isArray(data) ? data.length : undefined },
        children,
      );

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
// Sample fixtures
// ---------------------------------------------------------------------------

const agentData = [
  { date: '2024-01-01', count: 10 },
  { date: '2024-01-02', count: 20 },
  { date: '2024-01-03', count: 15 },
];

const costData = [
  { provider: 'anthropic', cost: 12.5 },
  { provider: 'openai', cost: 8.0 },
];

const latencyData = [
  { time: '2024-01-01T10:00', ms: 120 },
  { time: '2024-01-01T11:00', ms: 95 },
];

const creditData = [
  { date: '2024-01-01', balance: 100.0 },
  { date: '2024-01-02', balance: 87.5 },
];

// ---------------------------------------------------------------------------
// AgentUsageChart
// ---------------------------------------------------------------------------

describe('AgentUsageChart', () => {
  it('renders with valid data', () => {
    render(<AgentUsageChart data={agentData} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('victory-bar')).toBeInTheDocument();
  });

  it('renders with empty data without throwing', () => {
    expect(() => render(<AgentUsageChart data={[]} />)).not.toThrow();
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders with a single data point', () => {
    render(<AgentUsageChart data={[{ date: '2024-01-01', count: 5 }]} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CostBreakdownChart
// ---------------------------------------------------------------------------

describe('CostBreakdownChart', () => {
  it('renders VictoryPie with valid data', () => {
    render(<CostBreakdownChart data={costData} />);
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('renders with empty data without throwing', () => {
    expect(() => render(<CostBreakdownChart data={[]} />)).not.toThrow();
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('renders with a single provider', () => {
    render(<CostBreakdownChart data={[{ provider: 'anthropic', cost: 42 }]} />);
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('does not render a VictoryChart wrapper (pie is standalone)', () => {
    const { container } = render(<CostBreakdownChart data={costData} />);
    const charts = container.querySelectorAll('[data-testid="victory-chart"]');
    expect(charts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// LatencyChart
// ---------------------------------------------------------------------------

describe('LatencyChart', () => {
  it('renders VictoryLine with valid data', () => {
    render(<LatencyChart data={latencyData} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('victory-line')).toBeInTheDocument();
  });

  it('renders with empty data without throwing', () => {
    expect(() => render(<LatencyChart data={[]} />)).not.toThrow();
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders with minimum single data point', () => {
    render(<LatencyChart data={[{ time: '2024-01-01T09:00', ms: 50 }]} />);
    expect(screen.getByTestId('victory-line')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CreditBalanceChart
// ---------------------------------------------------------------------------

describe('CreditBalanceChart', () => {
  it('renders VictoryArea with valid data', () => {
    render(<CreditBalanceChart data={creditData} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('victory-area')).toBeInTheDocument();
  });

  it('renders with empty data without throwing', () => {
    expect(() => render(<CreditBalanceChart data={[]} />)).not.toThrow();
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders with a single balance data point', () => {
    render(<CreditBalanceChart data={[{ date: '2024-01-01', balance: 500 }]} />);
    expect(screen.getByTestId('victory-area')).toBeInTheDocument();
  });

  it('renders with zero balance', () => {
    render(
      <CreditBalanceChart
        data={[
          { date: '2024-01-01', balance: 0 },
          { date: '2024-01-02', balance: 0 },
        ]}
      />,
    );
    expect(screen.getByTestId('victory-area')).toBeInTheDocument();
  });
});
