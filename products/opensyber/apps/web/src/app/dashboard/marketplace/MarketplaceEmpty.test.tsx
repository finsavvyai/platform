/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketplaceEmpty } from './MarketplaceEmpty';

describe('MarketplaceEmpty', () => {
  it('renders marketplace launching message', () => {
    render(<MarketplaceEmpty />);
    expect(screen.getByText('Marketplace launching soon')).toBeDefined();
  });

  it('shows SDK docs link', () => {
    render(<MarketplaceEmpty />);
    const link = screen.getByText('Read the SDK Docs');
    expect(link.closest('a')?.getAttribute('href')).toBe('/docs/skills');
  });

  it('shows getting started link', () => {
    render(<MarketplaceEmpty />);
    const link = screen.getByText('Getting Started Guide');
    expect(link.closest('a')?.getAttribute('href')).toBe(
      '/dashboard/getting-started',
    );
  });

  it('renders coming soon skill placeholders', () => {
    render(<MarketplaceEmpty />);
    expect(screen.getByText('SAST Scanner')).toBeDefined();
    expect(screen.getByText('Secret Detector')).toBeDefined();
    expect(screen.getByText('SBOM Generator')).toBeDefined();
  });

  it('shows Coming soon label for each placeholder', () => {
    render(<MarketplaceEmpty />);
    const labels = screen.getAllByText('Coming soon');
    expect(labels.length).toBe(3);
  });
});
