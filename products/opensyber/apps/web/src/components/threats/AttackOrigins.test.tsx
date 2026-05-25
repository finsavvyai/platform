/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttackOrigins } from './AttackOrigins';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, ...props }: any) => (
      <div className={className} style={style}>{children}</div>
    ),
  },
}));

describe('AttackOrigins', () => {
  it('renders heading', () => {
    render(<AttackOrigins countries={[]} />);
    expect(screen.getByText('Attack Origins')).toBeDefined();
  });

  it('shows empty state when no countries', () => {
    render(<AttackOrigins countries={[]} />);
    expect(screen.getByText('No geographic data available.')).toBeDefined();
  });

  it('renders country data', () => {
    const countries = [
      { country: 'US', eventCount: 150 },
      { country: 'DE', eventCount: 80 },
    ];
    render(<AttackOrigins countries={countries} />);
    expect(screen.getByText('US')).toBeDefined();
    expect(screen.getByText('DE')).toBeDefined();
    expect(screen.getByText('150')).toBeDefined();
    expect(screen.getByText('80')).toBeDefined();
  });

  it('handles null country codes', () => {
    const countries = [{ country: null, eventCount: 50 }];
    render(<AttackOrigins countries={countries} />);
    expect(screen.getByText('??')).toBeDefined();
    expect(screen.getByText('50')).toBeDefined();
  });
});
