/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DemoClient from './DemoClient';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/demo',
}));

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <nav data-testid="site-header">Header</nav>,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

describe('DemoClient', () => {
  it('renders without crashing', () => {
    render(<DemoClient />);
    expect(screen.getByTestId('site-header')).toBeDefined();
  });

  it('renders demo tabs', () => {
    render(<DemoClient />);
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Events')).toBeDefined();
    expect(screen.getByText('Network')).toBeDefined();
  });

  it('renders the overview tab by default', () => {
    render(<DemoClient />);
    expect(screen.getByText('Security Score')).toBeDefined();
  });
});
