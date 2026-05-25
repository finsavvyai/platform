/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingGrid, PricingCard } from './PricingGrid';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

describe('PricingGrid', () => {
  it('renders children in a grid', () => {
    render(
      <PricingGrid>
        <div>Plan A</div>
        <div>Plan B</div>
      </PricingGrid>,
    );
    expect(screen.getByText('Plan A')).toBeDefined();
    expect(screen.getByText('Plan B')).toBeDefined();
  });

  it('applies grid layout classes', () => {
    const { container } = render(
      <PricingGrid><div>Child</div></PricingGrid>,
    );
    expect(container.firstElementChild?.className).toContain('grid');
  });
});

describe('PricingCard', () => {
  it('renders children', () => {
    render(<PricingCard><span>Card Content</span></PricingCard>);
    expect(screen.getByText('Card Content')).toBeDefined();
  });

  it('applies popular styling when popular is true', () => {
    const { container } = render(
      <PricingCard popular={true}><span>Popular</span></PricingCard>,
    );
    expect(container.firstElementChild?.className).toContain('border-signal');
  });

  it('applies default styling when not popular', () => {
    const { container } = render(
      <PricingCard><span>Default</span></PricingCard>,
    );
    expect(container.firstElementChild?.className).toContain('border-border');
  });
});
