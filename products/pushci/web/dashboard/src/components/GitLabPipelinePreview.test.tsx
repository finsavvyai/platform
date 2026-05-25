import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitLabPipelinePreview from './GitLabPipelinePreview';
import type {
  GitLabJob,
  GitLabPipelineDetail,
  GitLabPipelineSummary,
  GitLabProject,
} from '../hooks/useGitLabBridge';

const project: GitLabProject = {
  id: 42, name: 'core-api', path: 'acme/core-api', web_url: '', default_branch: 'main',
};
const pipelines: GitLabPipelineSummary[] = [
  { id: 1001, ref: 'main', sha: 'abc', status: 'passed', raw_status: 'success', web_url: '', created_at: '', updated_at: '' },
];
const detail: GitLabPipelineDetail = { id: 1001, status: 'passed', raw_status: 'success', ref: 'main', sha: 'abc', web_url: '', duration: 120 };
const jobs: GitLabJob[] = [
  { id: 1, name: 'unit-tests', stage: 'qa', status: 'passed', raw_status: 'success', duration: 10 },
];

describe('GitLabPipelinePreview', () => {
  const baseProps = {
    project,
    pipelines,
    selectedPipeline: null as GitLabPipelineDetail | null,
    jobs: [] as GitLabJob[],
    loading: false,
    triggering: false,
    error: null as string | null,
    onSelectPipeline: vi.fn(),
    onTrigger: vi.fn(),
    onOpenImport: vi.fn(),
  };

  it('fires onTrigger with the default branch when the button is clicked', async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();
    render(<GitLabPipelinePreview {...baseProps} onTrigger={onTrigger} />);
    await user.click(screen.getByRole('button', { name: /trigger pipeline/i }));
    expect(onTrigger).toHaveBeenCalledWith('main');
  });

  it('shows jobs for the selected pipeline', () => {
    render(<GitLabPipelinePreview {...baseProps} selectedPipeline={detail} jobs={jobs} />);
    expect(screen.getByText(/jobs for pipeline #1001/i)).toBeInTheDocument();
    expect(screen.getByText('unit-tests')).toBeInTheDocument();
  });

  it('selects a pipeline when clicked in the list', async () => {
    const user = userEvent.setup();
    const onSelectPipeline = vi.fn();
    render(<GitLabPipelinePreview {...baseProps} onSelectPipeline={onSelectPipeline} />);
    await user.click(screen.getByRole('button', { name: /#1001/i }));
    expect(onSelectPipeline).toHaveBeenCalledWith(1001);
  });

  it('opens the importer via the header button', async () => {
    const user = userEvent.setup();
    const onOpenImport = vi.fn();
    render(<GitLabPipelinePreview {...baseProps} onOpenImport={onOpenImport} />);
    await user.click(screen.getByRole('button', { name: /import .gitlab-ci.yml/i }));
    expect(onOpenImport).toHaveBeenCalled();
  });
});
