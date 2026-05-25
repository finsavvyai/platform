import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BehaviorAnalyticsClient } from './BehaviorAnalyticsClient';

describe('BehaviorAnalyticsClient', () => {
  it('renders page title and description', () => {
    render(<BehaviorAnalyticsClient />);
    expect(screen.getByText('User Behavior Analytics')).toBeInTheDocument();
    expect(screen.getByText(/Detects anomalous user behavior/)).toBeInTheDocument();
  });

  it('renders empty state when no data', async () => {
    render(<BehaviorAnalyticsClient />);
    expect(await screen.findByText('No Behavior Analytics Data Yet')).toBeInTheDocument();
  });
});
