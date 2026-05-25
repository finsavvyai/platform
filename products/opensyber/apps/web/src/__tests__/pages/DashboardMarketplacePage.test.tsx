import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarketplacePage from '@/app/dashboard/marketplace/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/app/dashboard/marketplace/MarketplaceClient', () => ({
  MarketplaceClient: ({ skills, featured, agents }: any) => (
    <div data-testid="marketplace-client">
      <span data-testid="skills-count">{skills.length}</span>
      <span data-testid="featured-count">{featured.length}</span>
      <span data-testid="agents-count">{agents.length}</span>
    </div>
  ),
}));

describe('Dashboard MarketplacePage', () => {
  it('renders client with empty data when no token', async () => {
    const result = await MarketplacePage({ searchParams: Promise.resolve({}) });
    render(result);
    expect(
      screen.getByTestId('marketplace-client'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('skills-count')).toHaveTextContent('0');
    expect(screen.getByTestId('featured-count')).toHaveTextContent('0');
    expect(screen.getByTestId('agents-count')).toHaveTextContent('0');
  });
});
