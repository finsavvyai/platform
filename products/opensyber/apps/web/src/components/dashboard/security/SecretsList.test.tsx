/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SecretsList } from './SecretsList';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
  global.alert = vi.fn();
  global.confirm = vi.fn();
});

const secrets = [
  { id: 's1', key: 'GITHUB_TOKEN', createdAt: '2026-01-15T10:00:00Z' },
  { id: 's2', key: 'SLACK_WEBHOOK', createdAt: '2026-02-01T08:00:00Z' },
];

describe('SecretsList', () => {
  it('shows empty state when no secrets', () => {
    render(<SecretsList instanceId="inst_1" initialSecrets={[]} />);
    expect(screen.getByText('No secrets stored yet.')).toBeDefined();
  });

  it('renders secret keys with masked values', () => {
    render(<SecretsList instanceId="inst_1" initialSecrets={secrets} />);
    expect(screen.getByText('GITHUB_TOKEN')).toBeDefined();
    expect(screen.getByText('SLACK_WEBHOOK')).toBeDefined();
    expect(screen.getAllByText('••••••••')).toHaveLength(2);
  });

  it('shows confirmation dialog on delete click', () => {
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    render(<SecretsList instanceId="inst_1" initialSecrets={secrets} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]!);

    expect(global.confirm).toHaveBeenCalledWith(
      'Delete secret "GITHUB_TOKEN"? This cannot be undone.',
    );
  });

  it('does nothing when confirm is cancelled', () => {
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    render(<SecretsList instanceId="inst_1" initialSecrets={secrets} />);

    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls DELETE API when confirmed', async () => {
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    render(<SecretsList instanceId="inst_1" initialSecrets={secrets} />);
    fireEvent.click(screen.getAllByRole('button')[0]!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/instances/inst_1/secrets/GITHUB_TOKEN',
        { method: 'DELETE' },
      );
    });
  });

  it('removes secret from list on successful delete', async () => {
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    render(<SecretsList instanceId="inst_1" initialSecrets={secrets} />);
    fireEvent.click(screen.getAllByRole('button')[0]!);

    await waitFor(() => {
      expect(screen.queryByText('GITHUB_TOKEN')).toBeNull();
    });
    expect(screen.getByText('SLACK_WEBHOOK')).toBeDefined();
  });

  it('shows empty state after deleting last secret', async () => {
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    render(<SecretsList instanceId="inst_1" initialSecrets={[secrets[0]!]} />);
    fireEvent.click(screen.getAllByRole('button')[0]!);

    await waitFor(() => {
      expect(screen.getByText('No secrets stored yet.')).toBeDefined();
    });
  });

  it('shows in-UI error on network error', async () => {
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

    render(<SecretsList instanceId="inst_1" initialSecrets={secrets} />);
    fireEvent.click(screen.getAllByRole('button')[0]!);

    // Error displays in-UI rather than via blocking alert(). Secret should
    // remain in the list since the delete failed.
    await waitFor(() => {
      expect(screen.getByText('fail')).toBeDefined();
    });
    expect(screen.getByText('GITHUB_TOKEN')).toBeDefined();
  });

  it('disables button while deleting', async () => {
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    let resolve: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(<SecretsList instanceId="inst_1" initialSecrets={secrets} />);
    const button = screen.getAllByRole('button')[0]!;
    fireEvent.click(button);

    expect(button.closest('button')?.disabled).toBe(true);

    resolve!({ ok: true });
    await waitFor(() => {
      expect(screen.queryByText('GITHUB_TOKEN')).toBeNull();
    });
  });
});
