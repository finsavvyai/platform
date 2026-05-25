import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingPage, Plan } from '../src/pages/PricingPage';

const mockPlans: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 9,
    description: 'For starters',
    features: ['5 projects', '1GB storage', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 29,
    description: 'For professionals',
    features: ['100 projects', '100GB storage', 'Priority support'],
    recommended: true,
  },
];

describe('PricingPage', () => {
  it('should render all plans', () => {
    render(
      <PricingPage plans={mockPlans} onSelectPlan={vi.fn()} />
    );
    expect(screen.getByTestId('plan-basic')).toBeInTheDocument();
    expect(screen.getByTestId('plan-pro')).toBeInTheDocument();
  });

  it('should display plan names', () => {
    render(
      <PricingPage plans={mockPlans} onSelectPlan={vi.fn()} />
    );
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
  });

  it('should display plan prices', () => {
    render(
      <PricingPage plans={mockPlans} onSelectPlan={vi.fn()} />
    );
    expect(screen.getByText('$9')).toBeInTheDocument();
    expect(screen.getByText('$29')).toBeInTheDocument();
  });

  it('should display plan features', () => {
    const { container } = render(
      <PricingPage plans={mockPlans} onSelectPlan={vi.fn()} />
    );
    const html = container.innerHTML;
    expect(html).toContain('5 projects');
    expect(html).toContain('100 projects');
  });

  it('should highlight recommended plan', () => {
    render(
      <PricingPage plans={mockPlans} onSelectPlan={vi.fn()} />
    );
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('should call onSelectPlan when button clicked', async () => {
    const onSelectPlan = vi.fn();
    render(
      <PricingPage plans={mockPlans} onSelectPlan={onSelectPlan} />
    );
    await screen.getByTestId('select-basic').click();
    expect(onSelectPlan).toHaveBeenCalledWith('basic');
  });

  it('should render select buttons for all plans', () => {
    render(
      <PricingPage plans={mockPlans} onSelectPlan={vi.fn()} />
    );
    expect(screen.getByTestId('select-basic')).toBeInTheDocument();
    expect(screen.getByTestId('select-pro')).toBeInTheDocument();
  });
});
