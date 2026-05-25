import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitLabImporterPage from './GitLabImporterPage';
import type {
  BridgeStatus,
  GitLabApi,
  GitLabConnection,
  GitLabPipelineDetail,
  GitLabProject,
} from '../hooks/useGitLabBridge';

const connection: GitLabConnection = {
  id: 'conn-1', label: 'gitlab.com', baseUrl: 'https://gitlab.com',
  privateTokenPreview: 'glpa…IJKL', created_at: '', updated_at: '',
};
const project: GitLabProject = {
  id: 7, name: 'api', path: 'acme/api', web_url: '', default_branch: 'main',
};

function makeApi(overrides: Partial<GitLabApi> = {}): GitLabApi {
  return {
    connect: vi.fn(async () => ({ connection })),
    listConnections: vi.fn(async () => ({ connections: [] })),
    deleteConnection: vi.fn(async () => ({ ok: true })),
    listProjects: vi.fn(async () => ({ projects: [project] })),
    listPipelines: vi.fn(async () => ({ pipelines: [] })),
    getPipeline: vi.fn(async () => {
      const pipeline: GitLabPipelineDetail = {
        id: 1, status: 'passed' as BridgeStatus, raw_status: 'success',
        ref: 'main', sha: 'a', web_url: '', duration: null,
      };
      return { pipeline, jobs: [] };
    }),
    trigger: vi.fn(async () => ({
      triggered: true,
      pipeline: { id: 1, web_url: '', status: 'pending' as BridgeStatus },
    })),
    import: vi.fn(async () => ({
      preview: { pipeline: { stages: [], jobs: [] }, yaml: 'ok', source: '' },
    })),
    ...overrides,
  };
}

describe('GitLabImporterPage', () => {
  it('shows the connect form when no connections exist', async () => {
    render(<GitLabImporterPage api={makeApi()} />);
    await waitFor(() =>
      expect(screen.getByRole('form', { name: /connect gitlab instance/i })).toBeInTheDocument(),
    );
  });

  it('lists projects once a connection is available', async () => {
    const api = makeApi({ listConnections: vi.fn(async () => ({ connections: [connection] })) });
    render(<GitLabImporterPage api={api} />);
    await waitFor(() => expect(screen.getByText('api')).toBeInTheDocument());
    expect(api.listProjects).toHaveBeenCalledWith('conn-1', undefined);
  });

  it('shows the pipeline preview after selecting a project', async () => {
    const user = userEvent.setup();
    const api = makeApi({ listConnections: vi.fn(async () => ({ connections: [connection] })) });
    render(<GitLabImporterPage api={api} />);
    await waitFor(() => expect(screen.getByText('api')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /api/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /trigger pipeline/i })).toBeInTheDocument(),
    );
  });
});
