/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u-test' } }, status: 'authenticated' }),
}));

import { RestartButton } from './RestartButton';

afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('RestartButton', () => {
  it('renders the restart button', () => {
    render(<RestartButton instanceId="inst-1" />);
    expect(screen.getByText('Restart')).toBeDefined();
  });

  it('shows success message after restart', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    render(<RestartButton instanceId="inst-1" />);
    fireEvent.click(screen.getByText('Restart'));

    await waitFor(() => {
      expect(screen.getByText('Restart initiated')).toBeDefined();
    });
  });

  it('shows error message on failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Server error' }),
    } as unknown as Response);

    render(<RestartButton instanceId="inst-1" />);
    fireEvent.click(screen.getByText('Restart'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeDefined();
    });
  });

  it('shows network error on fetch failure', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('offline'));

    render(<RestartButton instanceId="inst-1" />);
    fireEvent.click(screen.getByText('Restart'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  it('shows Restarting text while loading', async () => {
    let resolvePromise: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((r) => { resolvePromise = r as (v: unknown) => void; }),
    );

    render(<RestartButton instanceId="inst-1" />);
    fireEvent.click(screen.getByText('Restart'));

    expect(screen.getByText('Restarting...')).toBeDefined();
    resolvePromise!({ ok: true, json: () => Promise.resolve({}) });
  });

  it('calls fetch with correct POST endpoint', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    render(<RestartButton instanceId="inst-42" />);
    fireEvent.click(screen.getByText('Restart'));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/proxy/instances/inst-42/restart',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
