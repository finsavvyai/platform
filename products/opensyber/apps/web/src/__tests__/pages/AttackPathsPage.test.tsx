import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AttackPathsPage from '@/app/dashboard/attack-paths/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/app/dashboard/attack-paths/AttackPathsClient', () => ({
  AttackPathsClient: ({ sessions, crownJewels }: any) => (
    <div data-testid="attack-paths-client">
      <span data-testid="sessions-count">{sessions.length}</span>
      <span data-testid="crown-count">{crownJewels.length}</span>
    </div>
  ),
}));

describe('AttackPathsPage', () => {
  it('renders client component with empty data when no token', async () => {
    const result = await AttackPathsPage();
    render(result);
    expect(
      screen.getByTestId('attack-paths-client'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('sessions-count')).toHaveTextContent('0');
    expect(screen.getByTestId('crown-count')).toHaveTextContent('0');
  });
});
