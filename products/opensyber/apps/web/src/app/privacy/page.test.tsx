/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrivacyPage from './page';

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

describe('PrivacyPage', () => {
  it('renders the page heading', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('Privacy Policy')).toBeDefined();
  });

  it('renders last updated date', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('Last updated: March 2026')).toBeDefined();
  });

  it('renders all privacy sections', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('1. Information We Collect')).toBeDefined();
    expect(screen.getByText('4. Data Storage & Security')).toBeDefined();
    expect(screen.getByText('7. Your Rights')).toBeDefined();
    expect(screen.getByText('9. Contact')).toBeDefined();
  });

  it('renders contact email link', () => {
    render(<PrivacyPage />);
    const link = screen.getByText('privacy@opensyber.cloud');
    expect(link.closest('a')?.getAttribute('href')).toBe('mailto:privacy@opensyber.cloud');
  });
});
