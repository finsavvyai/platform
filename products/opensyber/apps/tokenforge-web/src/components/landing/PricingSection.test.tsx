/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PricingSection } from './PricingSection';

function createMotionComponent(tag: string) {
  return function MotionComponent({ children, ...props }: Record<string, unknown>) {
    const {
      initial, animate, whileInView, viewport, transition,
      whileHover, exit, variants, onAnimationComplete,
      ...rest
    } = props;
    return React.createElement(tag, rest, children as React.ReactNode);
  };
}

vi.mock('framer-motion', () => ({
  motion: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => createMotionComponent(prop),
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { tenantId: 'test_tenant_123', apiKey: 'test_key_123' },
    },
    status: 'authenticated',
  }),
}));

describe('PricingSection', () => {
  it('renders the section title', () => {
    render(<PricingSection />);
    expect(screen.getByText('Simple, Transparent Pricing')).toBeDefined();
  });

  it('renders all four plan names', () => {
    render(<PricingSection />);
    expect(screen.getByText('Free')).toBeDefined();
    expect(screen.getByText('Pro')).toBeDefined();
    expect(screen.getByText('Team')).toBeDefined();
    expect(screen.getByText('Enterprise')).toBeDefined();
  });

  it('renders correct prices', () => {
    render(<PricingSection />);
    expect(screen.getByText('$0')).toBeDefined();
    expect(screen.getByText('$49')).toBeDefined();
    expect(screen.getByText('$199')).toBeDefined();
    expect(screen.getByText('Custom')).toBeDefined();
  });

  it('renders the Most Popular badge on Pro plan', () => {
    render(<PricingSection />);
    expect(screen.getByText('Most Popular')).toBeDefined();
  });

  it('renders CTA buttons for all plans', () => {
    render(<PricingSection />);
    expect(screen.getByText('Start Free')).toBeDefined();
    expect(screen.getByText('Subscribe to Pro')).toBeDefined();
    expect(screen.getByText('Subscribe to Team')).toBeDefined();
    expect(screen.getByText('Contact Sales')).toBeDefined();
  });

  it('links paid plans to pricing page', () => {
    render(<PricingSection />);
    const proLink = screen.getByText('Subscribe to Pro').closest('a');
    expect(proLink?.getAttribute('href')).toBe('/pricing');
    const teamLink = screen.getByText('Subscribe to Team').closest('a');
    expect(teamLink?.getAttribute('href')).toBe('/pricing');
  });

  it('renders key features', () => {
    render(<PricingSection />);
    expect(screen.getByText('10K verifications/mo')).toBeDefined();
    expect(screen.getByText('50K verifications/mo')).toBeDefined();
    expect(screen.getByText('250K verifications/mo')).toBeDefined();
    expect(screen.getByText('Unlimited verifications')).toBeDefined();
  });

  it('renders the footer note', () => {
    render(<PricingSection />);
    expect(
      screen.getByText(/All plans include cryptographic device binding/),
    ).toBeDefined();
  });
});
