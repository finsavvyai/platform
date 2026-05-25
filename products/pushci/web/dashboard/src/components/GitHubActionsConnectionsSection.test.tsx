// Tests for GitHubActionsConnectionsSection — list + select/delete.
// License: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubActionsConnectionsSection from './GitHubActionsConnectionsSection';
import type { GitHubActionsConnection } from '../hooks/useGitHubActionsBridge';

const conns: GitHubActionsConnection[] = [
  {
    id: 'c1', label: 'Work', tokenPreview: 'ghp_…abcd',
    scopes: ['repo', 'workflow'], created_at: '', updated_at: '',
  },
  {
    id: 'c2', label: 'Personal', tokenPreview: 'ghu_…wxyz',
    scopes: ['actions:read'], created_at: '', updated_at: '',
  },
];

describe('GitHubActionsConnectionsSection', () => {
  it('renders the empty-state message when no connections', () => {
    render(
      <GitHubActionsConnectionsSection
        connections={[]} loading={false} activeConnId={null}
        onSelect={vi.fn()} onDelete={vi.fn()} onConnect={vi.fn()} connecting={false}
      />,
    );
    expect(screen.getByText(/no github accounts connected yet/i)).toBeInTheDocument();
  });

  it('lists connections with redacted token preview', () => {
    render(
      <GitHubActionsConnectionsSection
        connections={conns} loading={false} activeConnId="c1"
        onSelect={vi.fn()} onDelete={vi.fn()} onConnect={vi.fn()} connecting={false}
      />,
    );
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('ghp_…abcd')).toBeInTheDocument();
    expect(screen.getByText('ghu_…wxyz')).toBeInTheDocument();
  });

  it('invokes onSelect and onDelete for the right connection', async () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <GitHubActionsConnectionsSection
        connections={conns} loading={false} activeConnId="c1"
        onSelect={onSelect} onDelete={onDelete} onConnect={vi.fn()} connecting={false}
      />,
    );
    await userEvent.click(screen.getByText('Personal'));
    expect(onSelect).toHaveBeenCalledWith('c2');
    await userEvent.click(screen.getByLabelText('Remove Work'));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });
});
