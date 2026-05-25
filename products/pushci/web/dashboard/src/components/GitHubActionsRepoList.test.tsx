// Tests for GitHubActionsRepoList — search + status chip + empty states.
// License: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubActionsRepoList from './GitHubActionsRepoList';
import type { GHARepo } from '../hooks/useGitHubActionsBridge';

const sample: GHARepo[] = [
  {
    id: 1, name: 'web', owner: 'acme', full_name: 'acme/web',
    private: false, default_branch: 'main',
    last_run: { conclusion: 'success', status: 'completed', created_at: '' },
  },
  {
    id: 2, name: 'api', owner: 'acme', full_name: 'acme/api',
    private: true, default_branch: 'main',
    last_run: { conclusion: 'failure', status: 'completed', created_at: '' },
  },
];

describe('GitHubActionsRepoList', () => {
  it('renders each repo with its conclusion chip', () => {
    render(<GitHubActionsRepoList repos={sample} loading={false} selectedFullName={null} onSelect={vi.fn()} />);
    expect(screen.getByText('acme/web')).toBeInTheDocument();
    expect(screen.getByText('acme/api')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('failure')).toBeInTheDocument();
  });

  it('filters by full_name via the search input', async () => {
    render(<GitHubActionsRepoList repos={sample} loading={false} selectedFullName={null} onSelect={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/filter repos/i), 'api');
    expect(screen.queryByText('acme/web')).not.toBeInTheDocument();
    expect(screen.getByText('acme/api')).toBeInTheDocument();
  });

  it('calls onSelect when a repo is clicked', async () => {
    const onSelect = vi.fn();
    render(<GitHubActionsRepoList repos={sample} loading={false} selectedFullName={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('acme/web'));
    expect(onSelect).toHaveBeenCalledWith(sample[0]);
  });

  it('renders the empty state when no repos', () => {
    render(<GitHubActionsRepoList repos={[]} loading={false} selectedFullName={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/no repositories visible/i)).toBeInTheDocument();
  });

  it('renders the error alert', () => {
    render(<GitHubActionsRepoList repos={[]} loading={false} error="nope" selectedFullName={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('nope');
  });
});
