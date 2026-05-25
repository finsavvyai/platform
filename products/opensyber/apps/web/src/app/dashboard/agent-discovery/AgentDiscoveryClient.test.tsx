import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentDiscoveryClient } from './AgentDiscoveryClient';

describe('AgentDiscoveryClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        data: [
          {
            id: 'agent_1',
            name: 'Build Copilot',
            framework: 'langchain',
            runtime: 'node',
            surfaceType: 'repo',
            locationPath: 'apps/agent',
            status: 'unsecured',
            lastSeenAt: new Date().toISOString(),
            riskScore: 82,
            riskSeverity: 'high',
            ownerUserId: null,
            ownerTeamId: null,
            protected: false,
          },
        ],
      }),
      { status: 200 },
    )));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders discovery title and table data', async () => {
    render(<AgentDiscoveryClient />);
    expect(screen.getByText('Agent Discovery')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Discovery Run' })).toBeInTheDocument();
    expect(await screen.findByText('Build Copilot')).toBeInTheDocument();
  });
});
