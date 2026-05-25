import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompositeAlertsClient } from './CompositeAlertsClient';

describe('CompositeAlertsClient', () => {
  it('renders page title and description', () => {
    render(<CompositeAlertsClient />);
    expect(screen.getByText('Composite Alerts')).toBeInTheDocument();
    expect(screen.getByText(/Automatically correlates multiple low-severity/)).toBeInTheDocument();
  });

  it('shows empty state when no alerts are present', () => {
    render(<CompositeAlertsClient />);
    expect(screen.getByText('No Composite Alerts Yet')).toBeInTheDocument();
  });
});
