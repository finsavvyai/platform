import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillingPortal } from '../src/components/BillingPortal';

const mockSubscription = {
  planName: 'Professional',
  status: 'active' as const,
  nextBillingDate: '2024-04-01',
  amount: 29,
};

const mockUsage = {
  current: 45,
  limit: 100,
  unit: 'requests',
};

describe('BillingPortal', () => {
  it('should render billing portal', () => {
    render(
      <BillingPortal subscription={mockSubscription} usage={mockUsage} />
    );
    expect(screen.getByTestId('billing-portal')).toBeInTheDocument();
  });

  it('should display subscription information', () => {
    render(
      <BillingPortal subscription={mockSubscription} usage={mockUsage} />
    );
    expect(screen.getByTestId('plan-name')).toHaveTextContent('Professional');
    expect(screen.getByTestId('plan-status')).toHaveTextContent('active');
    expect(screen.getByTestId('plan-amount')).toHaveTextContent('$29/mo');
  });

  it('should display next billing date', () => {
    render(
      <BillingPortal subscription={mockSubscription} usage={mockUsage} />
    );
    expect(screen.getByTestId('billing-date')).toHaveTextContent(
      '2024-04-01'
    );
  });

  it('should display usage information', () => {
    render(
      <BillingPortal subscription={mockSubscription} usage={mockUsage} />
    );
    expect(screen.getByTestId('usage-text')).toHaveTextContent(
      '45 of 100 requests'
    );
  });

  it('should display usage bar', () => {
    render(
      <BillingPortal subscription={mockSubscription} usage={mockUsage} />
    );
    expect(screen.getByTestId('usage-bar')).toBeInTheDocument();
  });

  it('should display cancel button', () => {
    render(
      <BillingPortal subscription={mockSubscription} usage={mockUsage} />
    );
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
  });

  it('should render plan and usage sections', () => {
    render(
      <BillingPortal subscription={mockSubscription} usage={mockUsage} />
    );
    expect(screen.getByTestId('plan-section')).toBeInTheDocument();
    expect(screen.getByTestId('usage-section')).toBeInTheDocument();
  });

  it('should handle different subscription statuses', () => {
    const canceled = {
      ...mockSubscription,
      status: 'canceled' as const,
    };
    render(
      <BillingPortal subscription={canceled} usage={mockUsage} />
    );
    expect(screen.getByTestId('plan-status')).toHaveTextContent('canceled');
  });
});
