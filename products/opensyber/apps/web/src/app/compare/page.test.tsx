/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompareIndexPage from './page';
import { comparePages } from './compare-pages';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <nav data-testid="site-header">Header</nav>,
}));

describe('Compare index page', () => {
  it('renders all configured compare links', () => {
    render(<CompareIndexPage />);

    for (const page of comparePages) {
      const link = screen.getByRole('link', { name: new RegExp(page.title) });
      expect(link.getAttribute('href')).toBe(page.href);
      expect(screen.getByText(page.cardDescription)).toBeDefined();
    }
  });
});
