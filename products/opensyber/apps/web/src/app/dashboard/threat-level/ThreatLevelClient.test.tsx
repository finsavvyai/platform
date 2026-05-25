import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThreatLevelClient } from './ThreatLevelClient';

describe('ThreatLevelClient', () => {
  it('renders the page title', () => {
    render(<ThreatLevelClient />);
    expect(screen.getByText('Organization Threat Level')).toBeInTheDocument();
  });

  it('renders empty state when no data', async () => {
    render(<ThreatLevelClient />);
    expect(await screen.findByText('No Threat Level Data Yet')).toBeInTheDocument();
  });
});
