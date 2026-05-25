// Tests for BitbucketConnectionsSection.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BitbucketConnectionsSection from './BitbucketConnectionsSection';
import type { BitbucketConnection } from '../hooks/useBitbucketBridge';

const conns: BitbucketConnection[] = [
  { id: 'c1', label: 'Work', authType: 'app-password', secretPreview: 'ATBB…abcd', created_at: '', updated_at: '' },
];

describe('BitbucketConnectionsSection', () => {
  it('shows empty state when no connections', () => {
    render(
      <BitbucketConnectionsSection connections={[]} loading={false} activeConnId={null}
        onSelect={vi.fn()} onDelete={vi.fn()} onConnect={vi.fn().mockResolvedValue(undefined)} connecting={false} />,
    );
    expect(screen.getByText(/no bitbucket connections yet/i)).toBeInTheDocument();
  });

  it('renders saved connections and fires onSelect / onDelete', async () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <BitbucketConnectionsSection connections={conns} loading={false} activeConnId={null}
        onSelect={onSelect} onDelete={onDelete} onConnect={vi.fn().mockResolvedValue(undefined)} connecting={false} />,
    );
    await userEvent.click(screen.getByText('Work'));
    expect(onSelect).toHaveBeenCalledWith('c1');
    await userEvent.click(screen.getByRole('button', { name: /remove work/i }));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });

  it('renders loading message while loading', () => {
    render(
      <BitbucketConnectionsSection connections={[]} loading activeConnId={null}
        onSelect={vi.fn()} onDelete={vi.fn()} onConnect={vi.fn().mockResolvedValue(undefined)} connecting={false} />,
    );
    expect(screen.getByText(/loading connections/i)).toBeInTheDocument();
  });
});
