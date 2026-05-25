/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecurityPage from './page';

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

describe('SecurityPage', () => {
  it('renders the page heading', () => {
    render(<SecurityPage />);
    expect(screen.getByText('Security Policy')).toBeDefined();
  });

  it('renders key security sections', () => {
    render(<SecurityPage />);
    expect(screen.getByText('2. Vulnerability Reporting')).toBeDefined();
    expect(screen.getByText(/3. Encryption/)).toBeDefined();
    expect(screen.getByText('5. Infrastructure Security')).toBeDefined();
    expect(screen.getByText('8. Incident Response')).toBeDefined();
  });

  it('renders security contact email', () => {
    render(<SecurityPage />);
    const links = screen.getAllByText('security@opensyber.cloud');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].closest('a')?.getAttribute('href')).toBe('mailto:security@opensyber.cloud');
  });
});
