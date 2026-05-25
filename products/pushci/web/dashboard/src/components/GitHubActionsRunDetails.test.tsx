// Tests for GitHubActionsRunDetails — jobs + steps + logs link.
// License: Apache-2.0
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import GitHubActionsRunDetails from './GitHubActionsRunDetails';
import type { GHARunDetail } from '../hooks/useGitHubActionsBridge';

const detail: GHARunDetail = {
  run: {
    id: 101, run_number: 42, head_branch: 'main', head_sha: 'abcdef1234567890',
    status: 'completed', conclusion: 'success', event: 'push',
    created_at: '2026-04-17T00:00:00Z', workflow_id: 10,
    html_url: 'https://github.com/acme/web/actions/runs/101',
  },
  jobs: [
    {
      id: 1, name: 'build', status: 'completed', conclusion: 'success',
      html_url: 'https://github.com/acme/web/actions/runs/101/job/1',
      steps: [
        { name: 'Checkout', status: 'completed', conclusion: 'success', number: 1 },
        { name: 'Test', status: 'completed', conclusion: 'failure', number: 2 },
      ],
    },
  ],
};

describe('GitHubActionsRunDetails', () => {
  it('prompts the user to select a run when detail is null', () => {
    render(<GitHubActionsRunDetails detail={null} loading={false} />);
    expect(screen.getByText(/select a run/i)).toBeInTheDocument();
  });

  it('renders run header with chip and GitHub logs link', () => {
    render(<GitHubActionsRunDetails detail={detail} loading={false} />);
    expect(screen.getByText(/Run #42/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view logs on github/i })).toHaveAttribute(
      'href', 'https://github.com/acme/web/actions/runs/101',
    );
  });

  it('renders jobs and each step with its conclusion chip', () => {
    render(<GitHubActionsRunDetails detail={detail} loading={false} />);
    expect(screen.getByText('build')).toBeInTheDocument();
    expect(screen.getByText('Checkout')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    // 1 job chip + 2 step chips — ensure at least one failure appears.
    expect(screen.getByText('failure')).toBeInTheDocument();
  });

  it('renders the error alert when error is set', () => {
    render(<GitHubActionsRunDetails detail={null} loading={false} error="boom" />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });
});
