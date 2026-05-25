// Tests for BitbucketPipelineBrowser.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BitbucketPipelineBrowser from './BitbucketPipelineBrowser';
import type { BitbucketPipelineSummary } from '../hooks/useBitbucketBridge';

const pipelines: BitbucketPipelineSummary[] = [
  { uuid: 'a', build_number: 12, status: 'passed', created_on: '2026-04-17T12:00:00Z', duration: 65, ref: 'main', commit: 'abcdef1234' },
  { uuid: 'b', build_number: 11, status: 'failed', created_on: '2026-04-17T11:00:00Z', duration: 10, ref: 'feature/x', commit: '0000' },
];

describe('BitbucketPipelineBrowser', () => {
  it('renders empty state when no pipelines', () => {
    render(
      <BitbucketPipelineBrowser pipelines={[]} loading={false}
        onTrigger={vi.fn()} />,
    );
    expect(screen.getByText(/no pipelines found/i)).toBeInTheDocument();
  });

  it('shows build numbers, refs, and status chips', () => {
    render(
      <BitbucketPipelineBrowser pipelines={pipelines} loading={false}
        onTrigger={vi.fn()} />,
    );
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('passed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('invokes onTrigger with the chosen ref and refType', async () => {
    const onTrigger = vi.fn().mockResolvedValue(undefined);
    render(
      <BitbucketPipelineBrowser pipelines={pipelines} loading={false}
        onTrigger={onTrigger} />,
    );
    const input = screen.getByLabelText(/ref name/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'release');
    const select = screen.getByLabelText(/ref type/i);
    await userEvent.selectOptions(select, 'tag');
    await userEvent.click(screen.getByRole('button', { name: /trigger run/i }));
    expect(onTrigger).toHaveBeenCalledWith('release', 'tag');
  });

  it('displays error region when provided', () => {
    render(
      <BitbucketPipelineBrowser pipelines={[]} loading={false} error="oops"
        onTrigger={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('oops');
  });
});
