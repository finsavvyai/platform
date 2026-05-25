import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitLabImportPreviewCard from './GitLabImportPreview';
import type { GitLabImportPreview } from '../hooks/useGitLabBridge';

const preview: GitLabImportPreview = {
  pipeline: {
    stages: ['test', 'deploy'],
    jobs: [{ name: 'unit', stage: 'test', script: ['npm test'] }],
  },
  yaml: 'version: 1\nchecks:\n  - npm test\n',
  source: 'stages:\n  - test\n\ninclude:\n  - remote: x\n',
};

describe('GitLabImportPreviewCard', () => {
  it('renders a skeleton when loading', () => {
    const { container } = render(
      <GitLabImportPreviewCard preview={null} loading={true} saving={false} onAccept={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelectorAll('.shimmer').length).toBeGreaterThan(0);
  });

  it('shows a helpful empty state before any import', () => {
    render(
      <GitLabImportPreviewCard preview={null} loading={false} saving={false} onAccept={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText(/select a project/i)).toBeInTheDocument();
  });

  it('derives warnings from the source and renders the yaml preview', () => {
    render(
      <GitLabImportPreviewCard preview={preview} loading={false} saving={false} onAccept={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByTestId('pushci-yaml').textContent).toContain('npm test');
    expect(screen.getByText(/include: directives/i)).toBeInTheDocument();
  });

  it('calls onAccept with the yaml', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <GitLabImportPreviewCard preview={preview} loading={false} saving={false} onAccept={onAccept} onCancel={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: /accept & save/i }));
    expect(onAccept).toHaveBeenCalledWith(preview.yaml);
  });
});
