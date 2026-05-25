/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BillingToggle } from './BillingToggle';
import type { PlanData } from './plans';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/motion/PricingGrid', () => ({
  PricingGrid: ({ children }: any) => <div data-testid="pricing-grid">{children}</div>,
  PricingRow: ({ children }: any) => <div data-testid="pricing-row">{children}</div>,
  PricingCard: ({ children }: any) => <div data-testid="pricing-card">{children}</div>,
}));

const testPlans: PlanData[] = [
  {
    name: 'Free', planKey: 'free', price: 0, annualPrice: 0,
    description: 'Get started', cta: 'Get Started Free',
    features: ['1 agent'], popular: false, contactSales: false,
  },
  {
    name: 'Team', planKey: 'team', price: 299, annualPrice: 2870,
    description: 'For teams', cta: 'Start Free Trial',
    features: ['3 agents'], popular: true, contactSales: false,
  },
  {
    name: 'Enterprise', planKey: 'enterprise', price: 2499, annualPrice: 23990,
    description: 'Custom controls', cta: 'Contact Sales',
    features: ['Unlimited agents'], popular: false, contactSales: true,
  },
];

describe('BillingToggle', () => {
  const defaultProps = {
    plans: testPlans,
    checkoutUrls: null,
    isSignedIn: false,
    signupHref: '/sign-up',
    salesHref: '/enterprise',
  };

  it('renders without crashing', () => {
    render(<BillingToggle {...defaultProps} />);
    expect(screen.getByText('Monthly')).toBeDefined();
    expect(screen.getByText('Annual')).toBeDefined();
  });

  it('renders all plan names', () => {
    render(<BillingToggle {...defaultProps} />);
    expect(screen.getByText('Free')).toBeDefined();
    expect(screen.getByText('Team')).toBeDefined();
    expect(screen.getByText('Enterprise')).toBeDefined();
  });

  it('renders plan features', () => {
    render(<BillingToggle {...defaultProps} />);
    expect(screen.getByText('1 agent')).toBeDefined();
    expect(screen.getByText('3 agents')).toBeDefined();
  });

  it('shows monthly prices by default', () => {
    render(<BillingToggle {...defaultProps} />);
    expect(screen.getByText('$0')).toBeDefined();
    expect(screen.getByText('$299')).toBeDefined();
  });

  it('toggles to annual billing', () => {
    render(<BillingToggle {...defaultProps} />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(screen.getByText(/Save 20%/)).toBeDefined();
  });

  it('shows Most Popular badge on popular plan', () => {
    render(<BillingToggle {...defaultProps} />);
    expect(screen.getByText('Most Popular')).toBeDefined();
  });

  it('links free plan to signup when not signed in', () => {
    render(<BillingToggle {...defaultProps} />);
    const link = screen.getByText('Get Started Free').closest('a');
    expect(link?.getAttribute('href')).toBe('/sign-up');
  });

  it('links free plan to dashboard when signed in', () => {
    render(<BillingToggle {...defaultProps} isSignedIn={true} />);
    const link = screen.getByText('Get Started Free').closest('a');
    expect(link?.getAttribute('href')).toBe('/dashboard');
  });

  it('renders contact sales plans in separate row', () => {
    render(<BillingToggle {...defaultProps} />);
    expect(screen.getByTestId('pricing-row')).toBeDefined();
    expect(screen.getByText('Contact Sales')).toBeDefined();
  });

  it('links contact sales plans to enterprise page', () => {
    render(<BillingToggle {...defaultProps} />);
    const link = screen.getByText('Contact Sales').closest('a');
    expect(link?.getAttribute('href')).toBe('/enterprise');
  });
});
