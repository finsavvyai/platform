/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverviewTab } from './OverviewTab';
import type { LiveEvent } from './demo-constants';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

const mockEvents: LiveEvent[] = [
  { id: 1, type: 'skill_installed', message: 'Skill installed', detail: 'github-int', severity: 'info', time: '2m ago', isNew: false },
  { id: 2, type: 'network_blocked', message: 'Connection blocked', severity: 'high', time: '5m ago', isNew: true },
];

const defaultProps = {
  score: 87,
  overallAvg: 83,
  scanText: 'just now',
  cpu: 23,
  mem: 45,
  disk: 31,
  categories: [
    { name: 'Gateway Binding', score: 100 },
    { name: 'Credential Storage', score: 95 },
  ],
  events: mockEvents,
  onViewAllEvents: vi.fn(),
};

describe('OverviewTab', () => {
  it('renders without crashing', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText('Security Score')).toBeDefined();
  });

  it('displays the security score', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText('87')).toBeDefined();
  });

  it('displays detection metrics', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText('Detection Metrics')).toBeDefined();
    expect(screen.getByText('Threats blocked (24h)')).toBeDefined();
  });

  it('displays health metrics', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText('Health Metrics')).toBeDefined();
    expect(screen.getByText('23%')).toBeDefined();
    expect(screen.getByText('45%')).toBeDefined();
    expect(screen.getByText('31%')).toBeDefined();
  });

  it('renders score categories', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText('Score Breakdown')).toBeDefined();
    expect(screen.getByText('Gateway Binding')).toBeDefined();
    expect(screen.getByText('Credential Storage')).toBeDefined();
  });

  it('renders recent events', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText('Skill installed')).toBeDefined();
    expect(screen.getByText('Connection blocked')).toBeDefined();
  });

  it('calls onViewAllEvents when view all is clicked', () => {
    render(<OverviewTab {...defaultProps} />);
    fireEvent.click(screen.getByText('View all'));
    expect(defaultProps.onViewAllEvents).toHaveBeenCalled();
  });
});
