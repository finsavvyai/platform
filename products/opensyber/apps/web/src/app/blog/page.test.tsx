/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

afterEach(cleanup);
import BlogPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('BlogPage', () => {
  it('renders the page heading', () => {
    render(<BlogPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('renders blog post titles', () => {
    render(<BlogPage />);
    expect(screen.getByText('Introducing OpenSyber: Secure AI Agent Hosting')).toBeDefined();
    expect(screen.getAllByText(/Kill Chain/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Slopsquatting/).length).toBeGreaterThan(0);
  });

  it('renders category badges', () => {
    render(<BlogPage />);
    const securityElements = screen.getAllByText('Security');
    expect(securityElements.length).toBeGreaterThan(0);
    const threatIntelElements = screen.getAllByText('Threat Intel');
    expect(threatIntelElements.length).toBeGreaterThan(0);
    const productElements = screen.getAllByText('Product');
    expect(productElements.length).toBeGreaterThan(0);
  });

  it('has correct blog post links', () => {
    render(<BlogPage />);
    const link = screen.getByText('Introducing OpenSyber: Secure AI Agent Hosting').closest('a');
    expect(link?.getAttribute('href')).toBe('/blog/introducing-opensyber');
  });

  it('renders all 17 blog posts', () => {
    render(<BlogPage />);
    const readMoreLinks = screen.getAllByText('Read more');
    expect(readMoreLinks.length).toBe(17);
  });
});
