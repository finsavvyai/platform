/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertActionButtons } from './AlertActionButtons';

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

describe('AlertActionButtons', () => {
  it('renders acknowledge and resolve buttons for open alerts', () => {
    render(<AlertActionButtons alertId="a1" instanceId="i1" currentStatus="open" />);
    expect(screen.getByText('Acknowledge')).toBeDefined();
    expect(screen.getByText('Resolve')).toBeDefined();
  });

  it('renders only resolve button for acknowledged alerts', () => {
    render(<AlertActionButtons alertId="a1" instanceId="i1" currentStatus="acknowledged" />);
    expect(screen.queryByText('Acknowledge')).toBeNull();
    expect(screen.getByText('Resolve')).toBeDefined();
  });

  it('renders nothing for resolved alerts', () => {
    const { container } = render(
      <AlertActionButtons alertId="a1" instanceId="i1" currentStatus="resolved" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('calls PATCH with acknowledged status on acknowledge click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<AlertActionButtons alertId="a1" instanceId="i1" currentStatus="open" />);
    fireEvent.click(screen.getByText('Acknowledge'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/alerts/a1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'acknowledged' }),
        }),
      );
    });
  });

  it('calls PATCH with resolved status on resolve click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<AlertActionButtons alertId="a1" instanceId="i1" currentStatus="open" />);
    fireEvent.click(screen.getByText('Resolve'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/alerts/a1',
        expect.objectContaining({
          body: JSON.stringify({ status: 'resolved' }),
        }),
      );
    });
  });

  it('reloads page on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<AlertActionButtons alertId="a1" instanceId="i1" currentStatus="open" />);
    fireEvent.click(screen.getByText('Resolve'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows alert on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Not found' }),
    } as unknown as Response);
    render(<AlertActionButtons alertId="a1" instanceId="i1" currentStatus="open" />);
    fireEvent.click(screen.getByText('Resolve'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Not found');
    });
  });

  it('shows alert on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));
    render(<AlertActionButtons alertId="a1" instanceId="i1" currentStatus="open" />);
    fireEvent.click(screen.getByText('Resolve'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Network error');
    });
  });
});
