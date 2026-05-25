import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SaasDiscoveryClient } from './SaasDiscoveryClient';

describe('SaasDiscoveryClient', () => {
  it('renders page title and description', () => {
    render(<SaasDiscoveryClient />);
    expect(screen.getByText('SaaS Discovery')).toBeInTheDocument();
    expect(screen.getByText(/Continuously discovers SaaS/)).toBeInTheDocument();
  });

  it('renders empty state when no data', async () => {
    render(<SaasDiscoveryClient />);
    expect(await screen.findByText('No SaaS Discovery Data Yet')).toBeInTheDocument();
  });
});
