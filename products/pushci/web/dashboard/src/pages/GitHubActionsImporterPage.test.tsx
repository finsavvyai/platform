// Orchestrator tests for GitHubActionsImporterPage. useGitHubActionsBridge
// is mocked so the state machine is exercised end-to-end without network.
// License: Apache-2.0
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubActionsImporterPage from './GitHubActionsImporterPage';
import type { GitHubActionsBridgeClient } from '../hooks/useGitHubActionsBridge';

const mockClient: GitHubActionsBridgeClient = {
  connect: vi.fn(),
  listConnections: vi.fn(),
  deleteConnection: vi.fn().mockResolvedValue(undefined),
  listRepos: vi.fn(),
  listWorkflows: vi.fn(),
  listRuns: vi.fn(),
  getRun: vi.fn(),
  dispatch: vi.fn(),
};

vi.mock('../hooks/useGitHubActionsBridge', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useGitHubActionsBridge')>('../hooks/useGitHubActionsBridge');
  return { ...actual, useGitHubActionsBridge: () => mockClient };
});

beforeEach(() => {
  Object.values(mockClient).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset?.());
  (mockClient.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 'c1', label: 'Work', tokenPreview: 'ghp_…abcd', scopes: [], created_at: '', updated_at: '' },
  ]);
  (mockClient.listRepos as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 1, name: 'web', owner: 'acme', full_name: 'acme/web', private: false, default_branch: 'main' },
  ]);
  (mockClient.listWorkflows as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 10, name: 'CI', path: '.github/workflows/ci.yml', state: 'active', has_workflow_dispatch: true },
  ]);
  (mockClient.listRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
    {
      id: 101, run_number: 42, head_branch: 'main', head_sha: 'abcdef1234567890',
      status: 'completed', conclusion: 'success', event: 'push',
      created_at: '2026-04-17T00:00:00Z', workflow_id: 10,
    },
  ]);
  (mockClient.getRun as ReturnType<typeof vi.fn>).mockResolvedValue({
    run: {
      id: 101, run_number: 42, head_branch: 'main', head_sha: 'abcdef1234567890',
      status: 'completed', conclusion: 'success', event: 'push',
      created_at: '2026-04-17T00:00:00Z', workflow_id: 10,
    },
    jobs: [{ id: 1, name: 'build', status: 'completed', conclusion: 'success', steps: [] }],
  });
  (mockClient.dispatch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe('GitHubActionsImporterPage', () => {
  it('loads connections then repos and lets the user pick one', async () => {
    render(<GitHubActionsImporterPage />);
    await screen.findByText('Work');
    await waitFor(() => expect(mockClient.listRepos).toHaveBeenCalledWith('c1'));
    await screen.findByText('acme/web');
  });

  it('fetches workflows, runs, and run detail after selecting a repo and run', async () => {
    render(<GitHubActionsImporterPage />);
    await userEvent.click(await screen.findByText('acme/web'));
    await waitFor(() => expect(mockClient.listWorkflows).toHaveBeenCalledWith('c1', 'acme', 'web'));
    await waitFor(() => expect(mockClient.listRuns).toHaveBeenCalled());
    await userEvent.click(await screen.findByLabelText(/run 42/i));
    await waitFor(() => expect(mockClient.getRun).toHaveBeenCalledWith('c1', 'acme', 'web', 101));
    await screen.findByText(/Run #42/);
  });

  it('dispatches the selected workflow', async () => {
    render(<GitHubActionsImporterPage />);
    await userEvent.click(await screen.findByText('acme/web'));
    await userEvent.click(await screen.findByText('CI'));
    await userEvent.click(await screen.findByRole('button', { name: /dispatch workflow/i }));
    await waitFor(() => expect(mockClient.dispatch).toHaveBeenCalledWith('c1', 'acme', 'web', {
      workflowId: 10, ref: 'main', inputs: {},
    }));
  });
});
