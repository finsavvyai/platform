/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveEventFeed } from './LiveEventFeed';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('LiveEventFeed', () => {
  it('renders heading', () => {
    render(<LiveEventFeed events={[]} />);
    expect(screen.getByText('Live Event Feed')).toBeDefined();
  });

  it('shows empty state when no events', () => {
    render(<LiveEventFeed events={[]} />);
    expect(screen.getByText('No recent events detected.')).toBeDefined();
  });

  it('renders events', () => {
    const events = [
      { eventType: 'brute_force', severity: 'critical', sourceCountry: 'US', createdAt: new Date().toISOString() },
      { eventType: 'port_scan', severity: 'warning', sourceCountry: 'DE', createdAt: new Date().toISOString() },
    ];
    render(<LiveEventFeed events={events} />);
    expect(screen.getByText('Brute Force')).toBeDefined();
    expect(screen.getByText('Port Scan')).toBeDefined();
  });

  it('renders severity badges', () => {
    const events = [
      { eventType: 'test', severity: 'critical', sourceCountry: null, createdAt: new Date().toISOString() },
    ];
    render(<LiveEventFeed events={events} />);
    expect(screen.getByText('critical')).toBeDefined();
  });

  it('shows time ago for events', () => {
    const events = [
      { eventType: 'test', severity: 'info', sourceCountry: 'US', createdAt: new Date().toISOString() },
    ];
    render(<LiveEventFeed events={events} />);
    expect(screen.getByText('just now')).toBeDefined();
  });
});
