import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsCard, MetricsGrid, MetricData } from './MetricsCard';
import { Database, Activity, Clock } from 'lucide-react';

const mockMetric: MetricData = {
  label: 'Active Connections',
  value: 12,
  icon: Database,
  change: { value: 20, trend: 'up' },
};

describe('MetricsCard', () => {
  it('renders label and value', () => {
    render(<MetricsCard metric={mockMetric} />);
    expect(screen.getByText('Active Connections')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows up trend indicator', () => {
    render(<MetricsCard metric={mockMetric} />);
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('shows down trend indicator', () => {
    const downMetric: MetricData = {
      label: 'Errors',
      value: 5,
      icon: Activity,
      change: { value: 10, trend: 'down' },
    };
    render(<MetricsCard metric={downMetric} />);
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('handles custom className', () => {
    const { container } = render(
      <MetricsCard metric={mockMetric} className="custom-card" />
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('custom-card');
  });
});

describe('MetricsGrid', () => {
  const metrics: MetricData[] = [
    { label: 'Metric A', value: 10, icon: Database },
    { label: 'Metric B', value: 20, icon: Activity },
    { label: 'Metric C', value: 30, icon: Clock },
  ];

  it('renders correct number of cards', () => {
    render(<MetricsGrid metrics={metrics} />);
    expect(screen.getByText('Metric A')).toBeInTheDocument();
    expect(screen.getByText('Metric B')).toBeInTheDocument();
    expect(screen.getByText('Metric C')).toBeInTheDocument();
  });

  it('renders values for each card', () => {
    render(<MetricsGrid metrics={metrics} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });
});
