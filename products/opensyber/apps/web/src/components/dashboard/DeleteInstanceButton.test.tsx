/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeleteInstanceButton } from './DeleteInstanceButton';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
  global.alert = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
});

describe('DeleteInstanceButton', () => {
  it('renders delete button initially', () => {
    render(<DeleteInstanceButton instanceId="inst_1" />);
    expect(screen.getByText('Delete Instance')).toBeDefined();
  });

  it('shows confirmation when delete is clicked', () => {
    render(<DeleteInstanceButton instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Delete Instance'));
    expect(screen.getByText(/Are you sure/)).toBeDefined();
    expect(screen.getByText('Yes, delete')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('cancels confirmation and returns to initial state', () => {
    render(<DeleteInstanceButton instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Delete Instance'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Delete Instance')).toBeDefined();
  });

  it('calls DELETE API and redirects on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
    } as Response);

    render(<DeleteInstanceButton instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Delete Instance'));
    fireEvent.click(screen.getByText('Yes, delete'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/instances/inst_1',
        { method: 'DELETE' },
      );
      expect(window.location.href).toBe('/dashboard');
    });
  });

  it('shows alert on failed delete', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Cannot delete' }),
    } as unknown as Response);

    render(<DeleteInstanceButton instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Delete Instance'));
    fireEvent.click(screen.getByText('Yes, delete'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Cannot delete');
    });
  });

  it('shows alert on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));

    render(<DeleteInstanceButton instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Delete Instance'));
    fireEvent.click(screen.getByText('Yes, delete'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Network error');
    });
  });

  it('shows Deleting... text while loading', async () => {
    let resolve: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise<Response>((r) => { resolve = r as (v: unknown) => void; }),
    );

    render(<DeleteInstanceButton instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Delete Instance'));
    fireEvent.click(screen.getByText('Yes, delete'));

    expect(screen.getByText('Deleting...')).toBeDefined();
    resolve!({ ok: true } as Response);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });
});
