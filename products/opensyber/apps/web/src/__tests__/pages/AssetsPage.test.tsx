import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AssetsPage from '@/app/dashboard/assets/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/app/dashboard/assets/AssetsClient', () => ({
  AssetsClient: ({ initialAssets }: any) => (
    <div data-testid="assets-client">
      <span data-testid="asset-count">{initialAssets.length}</span>
    </div>
  ),
}));

describe('AssetsPage', () => {
  it('renders client component with empty data when no token', async () => {
    const result = await AssetsPage();
    render(result);
    expect(screen.getByTestId('assets-client')).toBeInTheDocument();
    expect(screen.getByTestId('asset-count')).toHaveTextContent('0');
  });
});
