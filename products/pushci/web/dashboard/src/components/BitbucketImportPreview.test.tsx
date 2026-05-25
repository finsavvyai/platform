// Tests for BitbucketImportPreview.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BitbucketImportPreview from './BitbucketImportPreview';
import type { ImportPreview } from '../hooks/useBitbucketBridge';

const sample: ImportPreview = {
  preview: {
    yaml: "version: '1'\nstages:\n  - name: build\n",
    source: 'pipelines:\n  default:\n    - step: {script: [echo hi]}',
    pipeline: { name: 'x', stages: [], warnings: ['parallel flattened'] },
  },
};

describe('BitbucketImportPreview', () => {
  it('empty state invites the user to import', () => {
    render(<BitbucketImportPreview preview={null} onImport={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText(/click/i)).toBeInTheDocument();
  });

  it('save button is disabled until a preview is present', () => {
    render(<BitbucketImportPreview preview={null} onImport={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save to project/i })).toBeDisabled();
  });

  it('renders yaml + warnings + original source from the preview', () => {
    render(<BitbucketImportPreview preview={sample} onImport={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText(/name: build/i)).toBeInTheDocument();
    expect(screen.getByText(/parallel flattened/i)).toBeInTheDocument();
  });

  it('calls onImport and onSave when clicked', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BitbucketImportPreview preview={sample} onImport={onImport} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /re-import/i }));
    expect(onImport).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /save to project/i }));
    expect(onSave).toHaveBeenCalled();
  });

  it('shows error alert', () => {
    render(<BitbucketImportPreview preview={null} onImport={vi.fn()} onSave={vi.fn()} error="oops" />);
    expect(screen.getByRole('alert')).toHaveTextContent('oops');
  });
});
