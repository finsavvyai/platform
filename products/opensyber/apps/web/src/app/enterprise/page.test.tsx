/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EnterprisePage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/enterprise',
}));

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => <nav data-testid="site-header">Header</nav>,
}));

vi.mock('@/components/trust/TrustFunnelNotice', () => ({
  TrustFunnelNotice: () => null,
}));

vi.mock('../trust/[id]/trust-attribution', () => ({
  readTrustQueryContext: () => null,
  buildTrustReferralNote: () => '',
  buildTrustTrackPayload: () => ({}),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: any) => children,
}));

describe('EnterprisePage', () => {
  it('renders the page title', () => {
    render(<EnterprisePage />);
    expect(screen.getByText('Enterprise Security for AI Agents')).toBeDefined();
  });

  it('renders feature cards', () => {
    render(<EnterprisePage />);
    expect(screen.getByText('Enterprise SSO')).toBeDefined();
    expect(screen.getByText('Unlimited Instances')).toBeDefined();
    expect(screen.getByText('SLA Monitoring')).toBeDefined();
    expect(screen.getByText('Data Residency')).toBeDefined();
  });

  it('renders Everything Included section', () => {
    render(<EnterprisePage />);
    expect(screen.getByText('Everything Included')).toBeDefined();
    expect(screen.getByText('SAML 2.0 & OIDC SSO')).toBeDefined();
    expect(screen.getByText('Role-based access control')).toBeDefined();
  });

  it('renders contact form', () => {
    render(<EnterprisePage />);
    expect(screen.getByText('Contact Sales')).toBeDefined();
    expect(screen.getByPlaceholderText('Your name')).toBeDefined();
    expect(screen.getByPlaceholderText('Work email')).toBeDefined();
    expect(screen.getByPlaceholderText('Company name')).toBeDefined();
    expect(screen.getByText('Get in Touch')).toBeDefined();
  });

  it('shows validation error when submitting empty form', async () => {
    render(<EnterprisePage />);
    fireEvent.click(screen.getByText('Get in Touch'));
    expect(screen.getByText('All fields are required')).toBeDefined();
  });
});
