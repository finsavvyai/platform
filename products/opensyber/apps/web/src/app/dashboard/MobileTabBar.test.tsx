/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileTabBar } from './MobileTabBar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('MobileTabBar', () => {
  it('renders all four tab labels plus More', () => {
    render(<MobileTabBar />);
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Agent')).toBeDefined();
    expect(screen.getByText('Security')).toBeDefined();
    expect(screen.getByText('Gov')).toBeDefined();
    expect(screen.getByText('More')).toBeDefined();
  });

  it('has a mobile navigation aria label', () => {
    render(<MobileTabBar />);
    expect(screen.getByLabelText('Mobile navigation')).toBeDefined();
  });

  it('opens the More sheet when More is clicked', () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByText('More'));
    expect(screen.getByText('Navigation')).toBeDefined();
  });

  it('highlights Home tab when pathname is /dashboard', () => {
    render(<MobileTabBar />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink?.className).toContain('text-signal');
  });

  it('renders tab links with correct hrefs', () => {
    render(<MobileTabBar />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveProperty('href', expect.stringContaining('/dashboard'));
  });
});
