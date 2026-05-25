// Tests for GitHubActionsDispatchForm — required inputs + dispatch payload.
// License: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubActionsDispatchForm from './GitHubActionsDispatchForm';
import type { GHAWorkflow } from '../hooks/useGitHubActionsBridge';

const dispatchWf: GHAWorkflow = {
  id: 7, name: 'Deploy', path: '.github/workflows/deploy.yml',
  state: 'active', has_workflow_dispatch: true,
  inputs: [
    { name: 'env', required: true, default: 'staging' },
    { name: 'note', required: false },
  ],
};

const noDispatchWf: GHAWorkflow = {
  id: 9, name: 'CI', path: '.github/workflows/ci.yml', state: 'active',
};

describe('GitHubActionsDispatchForm', () => {
  it('prompts to select a workflow when none passed', () => {
    render(<GitHubActionsDispatchForm workflow={null} defaultRef="main" onDispatch={vi.fn()} />);
    expect(screen.getByText(/select a workflow/i)).toBeInTheDocument();
  });

  it('explains when the workflow does not declare workflow_dispatch', () => {
    render(<GitHubActionsDispatchForm workflow={noDispatchWf} defaultRef="main" onDispatch={vi.fn()} />);
    expect(screen.getByText(/does not declare/i)).toBeInTheDocument();
  });

  it('seeds defaults, disables until required is filled, and dispatches', async () => {
    const onDispatch = vi.fn().mockResolvedValue(undefined);
    render(<GitHubActionsDispatchForm workflow={dispatchWf} defaultRef="main" onDispatch={onDispatch} />);

    const envInput = screen.getByLabelText(/^env/i);
    expect(envInput).toHaveValue('staging');

    const btn = screen.getByRole('button', { name: /dispatch workflow/i });
    expect(btn).toBeEnabled();
    await userEvent.clear(envInput);
    expect(btn).toBeDisabled();
    await userEvent.type(envInput, 'prod');
    await userEvent.type(screen.getByLabelText(/^note/i), 'hotfix');
    await userEvent.click(btn);

    expect(onDispatch).toHaveBeenCalledWith({
      workflowId: 7, ref: 'main', inputs: { env: 'prod', note: 'hotfix' },
    });
  });

  it('renders success and error banners', () => {
    const { rerender } = render(
      <GitHubActionsDispatchForm workflow={dispatchWf} defaultRef="main" onDispatch={vi.fn()} error="nope" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('nope');
    rerender(
      <GitHubActionsDispatchForm workflow={dispatchWf} defaultRef="main" onDispatch={vi.fn()} successMessage="sent" />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('sent');
  });
});
