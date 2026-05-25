/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeleteNotificationChannelButton } from './DeleteNotificationChannelButton';

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockReload.mockClear();
  global.fetch = vi.fn();
  global.alert = vi.fn();
});

describe('DeleteNotificationChannelButton', () => {
  it('renders delete button', () => {
    render(<DeleteNotificationChannelButton channelId="ch1" />);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('shows confirmation on click', () => {
    render(<DeleteNotificationChannelButton channelId="ch1" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Delete?')).toBeDefined();
    expect(screen.getByText('Yes')).toBeDefined();
    expect(screen.getByText('No')).toBeDefined();
  });

  it('cancels confirmation on No click', () => {
    render(<DeleteNotificationChannelButton channelId="ch1" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('No'));
    expect(screen.queryByText('Delete?')).toBeNull();
  });

  it('calls DELETE on confirm', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<DeleteNotificationChannelButton channelId="ch1" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/user/notification-channels/ch1',
        { method: 'DELETE' },
      );
    });
  });

  it('reloads on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<DeleteNotificationChannelButton channelId="ch1" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows alert on error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Forbidden' }),
    } as unknown as Response);
    render(<DeleteNotificationChannelButton channelId="ch1" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Forbidden');
    });
  });

  it('shows alert on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));
    render(<DeleteNotificationChannelButton channelId="ch1" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Network error');
    });
  });
});
