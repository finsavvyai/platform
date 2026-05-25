import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataExposureClient } from './DataExposureClient';

describe('DataExposureClient', () => {
  it('renders page title and description', () => {
    render(<DataExposureClient />);
    expect(screen.getByText('Data Exposure')).toBeInTheDocument();
    expect(screen.getByText(/Discovers and classifies sensitive data/)).toBeInTheDocument();
  });

  it('shows empty state when no data is present', () => {
    render(<DataExposureClient />);
    expect(screen.getByText('No Data Exposure Data Yet')).toBeInTheDocument();
  });
});
