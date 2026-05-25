import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitLabProjectList from './GitLabProjectList';
import type { GitLabProject } from '../hooks/useGitLabBridge';

const projects: GitLabProject[] = [
  { id: 1, name: 'core-api', path: 'acme/core-api', web_url: '', default_branch: 'main' },
  { id: 2, name: 'web', path: 'acme/web', web_url: '', default_branch: 'main' },
];

describe('GitLabProjectList', () => {
  it('shows a loading skeleton when loading', () => {
    const { container } = render(
      <GitLabProjectList projects={[]} loading={true} search="" onSearchChange={() => {}} onSelect={() => {}} />,
    );
    // Skeleton rows render as non-list elements
    expect(screen.queryByRole('list')).toBeNull();
    expect(container.querySelectorAll('.shimmer').length).toBeGreaterThan(0);
  });

  it('shows an empty state with no projects', () => {
    render(
      <GitLabProjectList projects={[]} loading={false} search="" onSearchChange={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByText(/no projects available/i)).toBeInTheDocument();
  });

  it('renders projects and calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <GitLabProjectList
        projects={projects}
        loading={false}
        search=""
        onSearchChange={() => {}}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('core-api')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /core-api/i }));
    expect(onSelect).toHaveBeenCalledWith(projects[0]);
  });

  it('surfaces errors via role=alert', () => {
    render(
      <GitLabProjectList projects={[]} loading={false} error="boom" search="" onSearchChange={() => {}} onSelect={() => {}} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });
});
