// Tests for GitHubActionsWorkflowBrowser — workflow selection + runs render.
// License: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubActionsWorkflowBrowser from './GitHubActionsWorkflowBrowser';
import type { GHARun, GHAWorkflow } from '../hooks/useGitHubActionsBridge';

const workflows: GHAWorkflow[] = [
  { id: 10, name: 'CI', path: '.github/workflows/ci.yml', state: 'active', has_workflow_dispatch: true },
  { id: 11, name: 'Release', path: '.github/workflows/release.yml', state: 'active' },
];

const runs: GHARun[] = [
  {
    id: 101, run_number: 42, head_branch: 'main', head_sha: 'abcdef1234567890',
    status: 'completed', conclusion: 'success', event: 'push',
    created_at: '2026-04-17T00:00:00Z', workflow_id: 10, duration_ms: 125000,
  },
  {
    id: 102, run_number: 43, head_branch: 'dev', head_sha: 'deadbeefcafebabe',
    status: 'in_progress', conclusion: null, event: 'pull_request',
    created_at: '2026-04-17T01:00:00Z', workflow_id: 10,
  },
];

describe('GitHubActionsWorkflowBrowser', () => {
  it('renders workflows and their dispatch label', () => {
    render(
      <GitHubActionsWorkflowBrowser
        workflows={workflows} runs={[]}
        selectedWorkflowId={null} selectedRunId={null}
        loadingWorkflows={false} loadingRuns={false}
        onSelectWorkflow={vi.fn()} onSelectRun={vi.fn()}
      />,
    );
    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('Release')).toBeInTheDocument();
    expect(screen.getByText('dispatch')).toBeInTheDocument();
  });

  it('calls onSelectWorkflow when a workflow is clicked', async () => {
    const onSelectWorkflow = vi.fn();
    render(
      <GitHubActionsWorkflowBrowser
        workflows={workflows} runs={[]}
        selectedWorkflowId={null} selectedRunId={null}
        loadingWorkflows={false} loadingRuns={false}
        onSelectWorkflow={onSelectWorkflow} onSelectRun={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('CI'));
    expect(onSelectWorkflow).toHaveBeenCalledWith(10);
  });

  it('renders each run with conclusion chip and triggers onSelectRun', async () => {
    const onSelectRun = vi.fn();
    render(
      <GitHubActionsWorkflowBrowser
        workflows={workflows} runs={runs}
        selectedWorkflowId={null} selectedRunId={null}
        loadingWorkflows={false} loadingRuns={false}
        onSelectWorkflow={vi.fn()} onSelectRun={onSelectRun}
      />,
    );
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('in progress')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/run 42 success/i));
    expect(onSelectRun).toHaveBeenCalledWith(101);
  });

  it('renders empty states', () => {
    render(
      <GitHubActionsWorkflowBrowser
        workflows={[]} runs={[]}
        selectedWorkflowId={null} selectedRunId={null}
        loadingWorkflows={false} loadingRuns={false}
        onSelectWorkflow={vi.fn()} onSelectRun={vi.fn()}
      />,
    );
    expect(screen.getByText(/no workflows/i)).toBeInTheDocument();
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });
});
