/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreatStatsBar } from './ThreatStatsBar';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className}>{children}</div>
    ),
    p: ({ children, className, ...props }: any) => (
      <p className={className}>{children}</p>
    ),
  },
}));

describe('ThreatStatsBar', () => {
  const stats = {
    events24h: 142,
    events7d: 980,
    events30d: 3200,
    threatsBlocked: 56,
    uniqueCountries: 12,
  };

  it('renders stat labels', () => {
    render(<ThreatStatsBar stats={stats} />);
    expect(screen.getByText('Events (24h)')).toBeDefined();
    expect(screen.getByText('Events (7d)')).toBeDefined();
    expect(screen.getByText('Threats Blocked')).toBeDefined();
    expect(screen.getByText('Countries')).toBeDefined();
  });

  it('renders stat values', () => {
    render(<ThreatStatsBar stats={stats} />);
    expect(screen.getByText('142')).toBeDefined();
    expect(screen.getByText('980')).toBeDefined();
    expect(screen.getByText('56')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });

  it('renders four stat cards', () => {
    const { container } = render(<ThreatStatsBar stats={stats} />);
    const grid = container.firstElementChild!;
    expect(grid.children.length).toBe(4);
  });
});
