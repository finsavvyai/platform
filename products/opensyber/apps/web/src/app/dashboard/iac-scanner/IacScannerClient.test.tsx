import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IacScannerClient } from './IacScannerClient';

describe('IacScannerClient', () => {
  it('renders the heading', () => {
    render(<IacScannerClient />);
    expect(screen.getByText('IaC Scanner')).toBeInTheDocument();
  });

  it('shows empty state when no scans are present', () => {
    render(<IacScannerClient />);
    expect(screen.getByText('No IaC Scans Yet')).toBeInTheDocument();
  });
});
