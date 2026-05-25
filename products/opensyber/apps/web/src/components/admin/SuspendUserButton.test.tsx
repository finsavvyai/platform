/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuspendUserButton } from './SuspendUserButton';

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockReload.mockClear();
  global.fetch = vi.fn();
});

describe('SuspendUserButton', () => {
  it('renders Suspend for active user', () => {
    render(<SuspendUserButton userId="u1" isSuspended={false} />);
    expect(screen.getByText('Suspend')).toBeDefined();
  });

  it('renders Unsuspend for suspended user', () => {
    render(<SuspendUserButton userId="u1" isSuspended={true} />);
    expect(screen.getByText('Unsuspend')).toBeDefined();
  });

  it('calls PATCH with opposite suspension state', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<SuspendUserButton userId="u1" isSuspended={false} />);
    fireEvent.click(screen.getByText('Suspend'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/admin/users/u1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isSuspended: true }),
        }),
      );
    });
  });

  it('calls PATCH to unsuspend', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<SuspendUserButton userId="u1" isSuspended={true} />);
    fireEvent.click(screen.getByText('Unsuspend'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/admin/users/u1',
        expect.objectContaining({
          body: JSON.stringify({ isSuspended: false }),
        }),
      );
    });
  });

  it('reloads page on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<SuspendUserButton userId="u1" isSuspended={false} />);
    fireEvent.click(screen.getByText('Suspend'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('disables button while loading', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));
    render(<SuspendUserButton userId="u1" isSuspended={false} />);
    fireEvent.click(screen.getByText('Suspend'));
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
  });
});
