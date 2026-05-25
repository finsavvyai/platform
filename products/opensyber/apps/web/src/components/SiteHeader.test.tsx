/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { SiteHeader } from './SiteHeader';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

vi.mock('@/components/AuthNav', () => ({
  AuthNav: () => <div data-testid="auth-nav">AuthNav</div>,
}));

describe('SiteHeader', () => {
  it('renders the logo link', () => {
    const { container } = render(<SiteHeader />);
    const homeLink = container.querySelector('a[href="/"]');
    expect(homeLink).toBeTruthy();
    expect(homeLink?.textContent).toContain('OPEN');
    expect(homeLink?.textContent).toContain('SYBER');
  });

  it('renders navigation links', () => {
    render(<SiteHeader />);
    const allPricing = screen.getAllByText('Pricing');
    expect(allPricing.length).toBeGreaterThan(0);
    const allDocs = screen.getAllByText('Docs');
    expect(allDocs.length).toBeGreaterThan(0);
    const allBlog = screen.getAllByText('Blog');
    expect(allBlog.length).toBeGreaterThan(0);
  });

  it('renders mobile menu button', () => {
    render(<SiteHeader />);
    expect(screen.getByLabelText('Open menu')).toBeDefined();
  });

  it('opens mobile menu on click', () => {
    render(<SiteHeader />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByLabelText('Close menu')).toBeDefined();
  });
});
