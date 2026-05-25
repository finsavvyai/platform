/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <nav data-testid="site-header">Header</nav>,
}));

vi.mock('@/app/HomeFooter', () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

describe('TermsPage', () => {
  it('renders the page heading', () => {
    render(<TermsPage />);
    expect(screen.getByText('Terms of Service')).toBeDefined();
  });

  it('renders last updated date', () => {
    render(<TermsPage />);
    expect(screen.getByText('Last updated: February 2026')).toBeDefined();
  });

  it('renders key sections', () => {
    render(<TermsPage />);
    expect(screen.getByText('1. Acceptance of Terms')).toBeDefined();
    expect(screen.getByText('4. Acceptable Use')).toBeDefined();
    expect(screen.getByText('5. Subscription & Billing')).toBeDefined();
    expect(screen.getByText('10. Termination')).toBeDefined();
  });

  it('renders contact email link', () => {
    render(<TermsPage />);
    const link = screen.getByText('legal@opensyber.cloud');
    expect(link.closest('a')?.getAttribute('href')).toBe('mailto:legal@opensyber.cloud');
  });
});
