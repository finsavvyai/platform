// Tests for BitbucketWorkspaceList.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BitbucketWorkspaceList from './BitbucketWorkspaceList';
import type { BitbucketRepo, BitbucketWorkspace } from '../hooks/useBitbucketBridge';

const workspaces: BitbucketWorkspace[] = [
  { slug: 'acme', name: 'Acme Corp' },
  { slug: 'labs', name: 'Labs' },
];

const repos: BitbucketRepo[] = [
  { slug: 'web', name: 'web', full_name: 'acme/web', is_private: true },
];

describe('BitbucketWorkspaceList', () => {
  it('renders skeletons while loading workspaces', () => {
    const { container } = render(
      <BitbucketWorkspaceList
        workspaces={[]} repos={[]} selectedWorkspace={null} selectedRepo={null}
        loadingWorkspaces loadingRepos={false}
        onSelectWorkspace={vi.fn()} onSelectRepo={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('.shimmer').length).toBeGreaterThan(0);
  });

  it('calls onSelectWorkspace when a workspace button is clicked', async () => {
    const onSelectWorkspace = vi.fn();
    render(
      <BitbucketWorkspaceList
        workspaces={workspaces} repos={[]}
        selectedWorkspace={null} selectedRepo={null}
        loadingWorkspaces={false} loadingRepos={false}
        onSelectWorkspace={onSelectWorkspace} onSelectRepo={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('Acme Corp'));
    expect(onSelectWorkspace).toHaveBeenCalledWith('acme');
  });

  it('shows a prompt until a workspace is selected', () => {
    render(
      <BitbucketWorkspaceList
        workspaces={workspaces} repos={[]}
        selectedWorkspace={null} selectedRepo={null}
        loadingWorkspaces={false} loadingRepos={false}
        onSelectWorkspace={vi.fn()} onSelectRepo={vi.fn()}
      />,
    );
    expect(screen.getByText(/select a workspace/i)).toBeInTheDocument();
  });

  it('renders repos and marks private ones', async () => {
    const onSelectRepo = vi.fn();
    render(
      <BitbucketWorkspaceList
        workspaces={workspaces} repos={repos}
        selectedWorkspace="acme" selectedRepo={null}
        loadingWorkspaces={false} loadingRepos={false}
        onSelectWorkspace={vi.fn()} onSelectRepo={onSelectRepo}
      />,
    );
    expect(screen.getByText('acme/web')).toBeInTheDocument();
    expect(screen.getByText(/private/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText('acme/web'));
    expect(onSelectRepo).toHaveBeenCalledWith('web');
  });

  it('shows an alert when repo fetch errors', () => {
    render(
      <BitbucketWorkspaceList
        workspaces={workspaces} repos={[]}
        selectedWorkspace="acme" selectedRepo={null}
        loadingWorkspaces={false} loadingRepos={false}
        error="boom"
        onSelectWorkspace={vi.fn()} onSelectRepo={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });
});
