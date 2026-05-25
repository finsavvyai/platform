/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreatBreakdown } from './ThreatBreakdown';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className}>{children}</div>
    ),
  },
}));

describe('ThreatBreakdown', () => {
  it('renders headings', () => {
    render(<ThreatBreakdown byType={[]} bySeverity={[]} />);
    expect(screen.getByText('Event Types')).toBeDefined();
    expect(screen.getByText('Severity Distribution')).toBeDefined();
  });

  it('shows empty state for both panels', () => {
    render(<ThreatBreakdown byType={[]} bySeverity={[]} />);
    expect(screen.getByText('No event type data.')).toBeDefined();
    expect(screen.getByText('No severity data.')).toBeDefined();
  });

  it('renders event type data', () => {
    const byType = [
      { eventType: 'brute_force', eventCount: 45 },
      { eventType: 'port_scan', eventCount: 23 },
    ];
    render(<ThreatBreakdown byType={byType} bySeverity={[]} />);
    expect(screen.getByText('Brute Force')).toBeDefined();
    expect(screen.getByText('Port Scan')).toBeDefined();
    expect(screen.getByText('45')).toBeDefined();
    expect(screen.getByText('23')).toBeDefined();
  });

  it('renders severity data', () => {
    const bySeverity = [
      { severity: 'critical', eventCount: 10 },
      { severity: 'warning', eventCount: 30 },
    ];
    render(<ThreatBreakdown byType={[]} bySeverity={bySeverity} />);
    expect(screen.getByText('critical')).toBeDefined();
    expect(screen.getByText('warning')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('30')).toBeDefined();
  });
});
