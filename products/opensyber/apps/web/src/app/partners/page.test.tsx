/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PartnersPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <nav data-testid="site-header">Header</nav>,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

describe('PartnersPage', () => {
  it('renders the hero heading', () => {
    render(<PartnersPage />);
    expect(screen.getByText('Deploy and Manage AI Agents for Your Clients')).toBeDefined();
  });

  it('renders partner features', () => {
    render(<PartnersPage />);
    expect(screen.getByText('Multi-Tenant Management')).toBeDefined();
    expect(screen.getByText('Per-Client Security Scores')).toBeDefined();
    expect(screen.getByText('White-Label Dashboards')).toBeDefined();
    expect(screen.getByText('Revenue Sharing')).toBeDefined();
  });

  it('renders onboarding steps', () => {
    render(<PartnersPage />);
    expect(screen.getByText('How It Works')).toBeDefined();
    expect(screen.getByText('Sign Up Team Plan')).toBeDefined();
    expect(screen.getByText('Provision Client Instances')).toBeDefined();
    expect(screen.getByText('Monitor From One Dashboard')).toBeDefined();
    expect(screen.getByText('Generate Client Reports')).toBeDefined();
  });

  it('has CTA link to enterprise', () => {
    render(<PartnersPage />);
    const cta = screen.getByText('Apply for Partner Access').closest('a');
    expect(cta?.getAttribute('href')).toBe('/enterprise');
  });
});
