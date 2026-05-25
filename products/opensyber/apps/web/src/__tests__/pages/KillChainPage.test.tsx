import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KillChainPage from '@/app/dashboard/kill-chain/page';

describe('KillChainPage', () => {
  it('renders heading', async () => {
    const result = await KillChainPage();
    render(result);
    expect(
      screen.getByText('Kill Chain Correlation'),
    ).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    const result = await KillChainPage();
    render(result);
    expect(
      screen.getByText('No Kill Chain Data Yet'),
    ).toBeInTheDocument();
  });

  it('renders empty state description', async () => {
    const result = await KillChainPage();
    render(result);
    expect(
      screen.getByText(
        'Deploy an agent to start detecting multi-stage attack patterns. Data will appear here automatically.',
      ),
    ).toBeInTheDocument();
  });
});
