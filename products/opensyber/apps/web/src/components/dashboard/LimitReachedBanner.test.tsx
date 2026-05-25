/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LimitReachedBanner } from './LimitReachedBanner';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('LimitReachedBanner', () => {
  it('renders agents limit title', () => {
    render(<LimitReachedBanner kind="agents" />);
    expect(screen.getByText('Agent limit reached')).toBeDefined();
  });

  it('renders skills limit copy with specific count', () => {
    render(<LimitReachedBanner kind="skills" />);
    expect(screen.getByText(/3 of 47 skills/)).toBeDefined();
  });

  it('renders alerts limit copy', () => {
    render(<LimitReachedBanner kind="alerts" />);
    expect(screen.getByText('Alert routing locked')).toBeDefined();
  });

  it('renders retention limit with Professional suggestion', () => {
    render(<LimitReachedBanner kind="retention" />);
    expect(screen.getByText(/Audit log retention/)).toBeDefined();
    expect(screen.getByText(/Upgrade to Professional/)).toBeDefined();
  });

  it('defaults agents plan to Team', () => {
    render(<LimitReachedBanner kind="agents" />);
    expect(screen.getByText(/Upgrade to Team/)).toBeDefined();
  });

  it('allows overriding the suggested plan', () => {
    render(<LimitReachedBanner kind="agents" plan="Professional" />);
    expect(screen.getByText(/Upgrade to Professional/)).toBeDefined();
  });

  it('renders current/limit counter when provided', () => {
    render(<LimitReachedBanner kind="agents" current={1} limit={1} />);
    expect(screen.getByTestId('limit-counter').textContent).toMatch(/1 \/ 1/);
  });

  it('hides counter when current/limit omitted', () => {
    render(<LimitReachedBanner kind="agents" />);
    expect(screen.queryByTestId('limit-counter')).toBeNull();
  });

  it('links upgrade CTA to pricing page', () => {
    render(<LimitReachedBanner kind="agents" />);
    const link = screen.getByText(/Upgrade to/).closest('a');
    expect(link?.getAttribute('href')).toBe('/pricing');
  });

  it('has accessible region landmark', () => {
    render(<LimitReachedBanner kind="agents" />);
    expect(screen.getByRole('region')).toBeDefined();
  });
});
