/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OpenAgentPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <nav data-testid="site-header">Header</nav>,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

describe('OpenAgentPage', () => {
  it('renders the hero heading', () => {
    render(<OpenAgentPage />);
    expect(screen.getByText(/Your AI agent is reading/)).toBeDefined();
    expect(screen.getByText('your secrets.')).toBeDefined();
  });

  it('renders install CTA', () => {
    render(<OpenAgentPage />);
    const installLinks = screen.getAllByText(/Install Free/);
    expect(installLinks.length).toBeGreaterThan(0);
  });

  it('renders feature cards', () => {
    render(<OpenAgentPage />);
    expect(screen.getByText('Real-time file monitoring')).toBeDefined();
    expect(screen.getByText('Terminal command interception')).toBeDefined();
    expect(screen.getByText('Secret pattern detection')).toBeDefined();
    expect(screen.getByText('Security risk score')).toBeDefined();
    expect(screen.getByText('Critical event notifications')).toBeDefined();
    expect(screen.getByText('Fully offline')).toBeDefined();
  });

  it('renders activity demo section', () => {
    render(<OpenAgentPage />);
    expect(screen.getByText('OpenAgent — Activity Monitor')).toBeDefined();
  });

  it('renders install steps', () => {
    render(<OpenAgentPage />);
    expect(screen.getByText('Up in 60 seconds')).toBeDefined();
  });

  it('links to pricing page', () => {
    render(<OpenAgentPage />);
    const pricingLink = screen.getByText('View Pro plans').closest('a');
    expect(pricingLink?.getAttribute('href')).toBe('/pricing');
  });
});
