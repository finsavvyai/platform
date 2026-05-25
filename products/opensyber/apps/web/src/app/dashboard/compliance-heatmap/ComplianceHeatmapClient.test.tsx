import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComplianceHeatmapClient } from './ComplianceHeatmapClient';

describe('ComplianceHeatmapClient', () => {
  it('renders page title', () => {
    render(<ComplianceHeatmapClient />);
    expect(screen.getByText('Compliance Heatmap')).toBeInTheDocument();
  });

  it('renders empty state when no data', async () => {
    render(<ComplianceHeatmapClient />);
    expect(await screen.findByText('No Compliance Data Yet')).toBeInTheDocument();
  });
});
