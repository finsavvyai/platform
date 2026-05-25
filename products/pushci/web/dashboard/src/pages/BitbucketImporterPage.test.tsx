// Orchestrator-level tests for BitbucketImporterPage. The useBitbucketBridge
// hook is mocked so the page's state machine is exercised end-to-end.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BitbucketImporterPage from './BitbucketImporterPage';
import type { BitbucketBridgeClient } from '../hooks/useBitbucketBridge';

const mockClient: BitbucketBridgeClient = {
  connect: vi.fn(),
  listConnections: vi.fn(),
  deleteConnection: vi.fn().mockResolvedValue(undefined),
  listWorkspaces: vi.fn(),
  listRepos: vi.fn(),
  listPipelines: vi.fn(),
  getPipeline: vi.fn(),
  triggerPipeline: vi.fn(),
  importPipeline: vi.fn(),
};

vi.mock('../hooks/useBitbucketBridge', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useBitbucketBridge')>('../hooks/useBitbucketBridge');
  return { ...actual, useBitbucketBridge: () => mockClient };
});

beforeEach(() => {
  Object.values(mockClient).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset?.());
  (mockClient.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 'c1', label: 'Work', authType: 'bearer', secretPreview: 'abcd…efgh', created_at: '', updated_at: '' },
  ]);
  (mockClient.listWorkspaces as ReturnType<typeof vi.fn>).mockResolvedValue([
    { slug: 'acme', name: 'Acme' },
  ]);
  (mockClient.listRepos as ReturnType<typeof vi.fn>).mockResolvedValue([
    { slug: 'web', name: 'web', full_name: 'acme/web' },
  ]);
  (mockClient.listPipelines as ReturnType<typeof vi.fn>).mockResolvedValue([
    { uuid: 'p1', build_number: 7, status: 'passed', created_on: '2026-04-17T00:00:00Z' },
  ]);
  (mockClient.importPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
    preview: { yaml: 'version: 1', source: 'pipelines:', pipeline: { name: 'x', stages: [], warnings: [] } },
  });
  (mockClient.triggerPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
    uuid: 'p2', build_number: 8, status: 'pending', created_on: '2026-04-17T01:00:00Z',
  });
});

describe('BitbucketImporterPage', () => {
  it('loads connections, workspaces, and then repos on selection', async () => {
    render(<BitbucketImporterPage />);
    await screen.findByText('Work');
    await waitFor(() => expect(mockClient.listWorkspaces).toHaveBeenCalledWith('c1'));
    await screen.findByText('Acme');
    await userEvent.click(screen.getByText('Acme'));
    await screen.findByText('acme/web');
    expect(mockClient.listRepos).toHaveBeenCalledWith('c1', 'acme');
  });

  it('triggers a pipeline after selecting a repo', async () => {
    render(<BitbucketImporterPage />);
    await screen.findByText('Work');
    await userEvent.click(await screen.findByText('Acme'));
    await userEvent.click(await screen.findByText('acme/web'));
    await waitFor(() => expect(mockClient.listPipelines).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole('button', { name: /trigger run/i }));
    expect(mockClient.triggerPipeline).toHaveBeenCalledWith('c1', 'acme', 'web', {
      ref: 'main', refType: 'branch',
    });
  });

  it('imports the pipeline YAML', async () => {
    render(<BitbucketImporterPage />);
    await screen.findByText('Work');
    await userEvent.click(await screen.findByText('Acme'));
    await userEvent.click(await screen.findByText('acme/web'));
    await userEvent.click(await screen.findByRole('button', { name: /^import$/i }));
    await waitFor(() => expect(mockClient.importPipeline).toHaveBeenCalledWith({
      connectionId: 'c1', workspace: 'acme', repo: 'web',
    }));
  });
});
