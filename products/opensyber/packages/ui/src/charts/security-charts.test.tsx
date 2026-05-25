/**
 * Unit tests for security dashboard Victory chart components.
 * Covers render paths, null-return guards for insufficient data,
 * and edge cases (empty arrays, single points, unknown severities).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ThreatTrendChart,
  SeverityDonutChart,
  SecurityScoreChart,
  AlertVolumeChart,
} from './security-charts.js';

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

const threatData = [
  { date: '2024-01-01', agentScore: 80, cspmScore: 70, combinedScore: 75 },
  { date: '2024-01-02', agentScore: 85, cspmScore: 72, combinedScore: 78 },
  { date: '2024-01-03', agentScore: 78, cspmScore: 68, combinedScore: 73 },
];

const severityData = [
  { severity: 'critical', count: 5 },
  { severity: 'high', count: 12 },
  { severity: 'medium', count: 20 },
  { severity: 'low', count: 8 },
];

const scoreData = [
  { date: '2024-01-01', score: 72 },
  { date: '2024-01-02', score: 78 },
  { date: '2024-01-03', score: 85 },
];

const alertData = [
  { date: '2024-01-01', critical: 2, high: 5, medium: 8, low: 3 },
  { date: '2024-01-02', critical: 1, high: 3, medium: 6, low: 2 },
];

// ---------------------------------------------------------------------------
// ThreatTrendChart
// ---------------------------------------------------------------------------

describe('ThreatTrendChart', () => {
  it('renders chart and legend with valid multi-point data', () => {
    render(<ThreatTrendChart data={threatData} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('victory-legend')).toBeInTheDocument();
    expect(screen.getAllByTestId('victory-line')).toHaveLength(3);
  });

  it('returns null for empty data (less than 2 points)', () => {
    const { container } = render(<ThreatTrendChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for exactly 1 data point', () => {
    const { container } = render(
      <ThreatTrendChart
        data={[{ date: '2024-01-01', agentScore: 80, cspmScore: 70, combinedScore: 75 }]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with exactly 2 data points (minimum valid)', () => {
    const twoPoints = threatData.slice(0, 2);
    render(<ThreatTrendChart data={twoPoints} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders with large dataset without throwing', () => {
    const large = Array.from({ length: 90 }, (_, i) => ({
      date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
      agentScore: 60 + (i % 30),
      cspmScore: 55 + (i % 25),
      combinedScore: 58 + (i % 27),
    }));
    expect(() => render(<ThreatTrendChart data={large} />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// SeverityDonutChart
// ---------------------------------------------------------------------------

describe('SeverityDonutChart', () => {
  it('renders VictoryPie with standard severity data', () => {
    render(<SeverityDonutChart data={severityData} />);
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('returns null for empty data array (defensive guard)', () => {
    const { container } = render(<SeverityDonutChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders with a single severity entry', () => {
    render(<SeverityDonutChart data={[{ severity: 'critical', count: 3 }]} />);
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('renders with unknown severity (falls back to grey)', () => {
    render(
      <SeverityDonutChart
        data={[{ severity: 'unknown-level', count: 1 }]}
      />,
    );
    expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
  });

  it('is not wrapped in a VictoryChart (standalone pie)', () => {
    const { container } = render(<SeverityDonutChart data={severityData} />);
    expect(container.querySelectorAll('[data-testid="victory-chart"]')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SecurityScoreChart
// ---------------------------------------------------------------------------

describe('SecurityScoreChart', () => {
  it('renders chart and area for scores >= 80 (green threshold)', () => {
    const highScores = [
      { date: '2024-01-01', score: 80 },
      { date: '2024-01-02', score: 90 },
    ];
    render(<SecurityScoreChart data={highScores} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('victory-area')).toBeInTheDocument();
  });

  it('renders for scores in amber range (50–79)', () => {
    const amberScores = [
      { date: '2024-01-01', score: 60 },
      { date: '2024-01-02', score: 65 },
    ];
    render(<SecurityScoreChart data={amberScores} />);
    expect(screen.getByTestId('victory-area')).toBeInTheDocument();
  });

  it('renders for scores below 50 (rose/red threshold)', () => {
    const lowScores = [
      { date: '2024-01-01', score: 30 },
      { date: '2024-01-02', score: 45 },
    ];
    render(<SecurityScoreChart data={lowScores} />);
    expect(screen.getByTestId('victory-area')).toBeInTheDocument();
  });

  it('returns null for empty data', () => {
    const { container } = render(<SecurityScoreChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for exactly 1 data point', () => {
    const { container } = render(
      <SecurityScoreChart data={[{ date: '2024-01-01', score: 75 }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with exactly 2 data points (minimum valid)', () => {
    render(<SecurityScoreChart data={scoreData.slice(0, 2)} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });

  it('renders with score of 0 without throwing', () => {
    expect(() =>
      render(
        <SecurityScoreChart
          data={[
            { date: '2024-01-01', score: 0 },
            { date: '2024-01-02', score: 0 },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AlertVolumeChart
// ---------------------------------------------------------------------------

describe('AlertVolumeChart', () => {
  it('renders 4 severity bars with valid data', () => {
    render(<AlertVolumeChart data={alertData} />);
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('victory-bar')).toHaveLength(4);
  });

  it('returns null for empty data (defensive guard)', () => {
    const { container } = render(<AlertVolumeChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders with a single day of data', () => {
    render(
      <AlertVolumeChart
        data={[{ date: '2024-01-01', critical: 1, high: 2, medium: 3, low: 4 }]}
      />,
    );
    expect(screen.getAllByTestId('victory-bar')).toHaveLength(4);
  });

  it('renders when all counts are zero', () => {
    render(
      <AlertVolumeChart
        data={[
          { date: '2024-01-01', critical: 0, high: 0, medium: 0, low: 0 },
        ]}
      />,
    );
    expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
  });
});
