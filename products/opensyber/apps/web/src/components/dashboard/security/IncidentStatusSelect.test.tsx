/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IncidentStatusSelect } from './IncidentStatusSelect';

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

describe('IncidentStatusSelect', () => {
  it('renders select with current status', () => {
    render(
      <IncidentStatusSelect incidentId="inc1" instanceId="i1" currentStatus="open" />,
    );
    const select = screen.getByDisplayValue('Open') as HTMLSelectElement;
    expect(select.value).toBe('open');
  });

  it('renders all status options', () => {
    render(
      <IncidentStatusSelect incidentId="inc1" instanceId="i1" currentStatus="open" />,
    );
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByText('Investigating')).toBeDefined();
    expect(screen.getByText('Contained')).toBeDefined();
    expect(screen.getByText('Resolved')).toBeDefined();
    expect(screen.getByText('Closed')).toBeDefined();
  });

  it('calls PATCH when status changes', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(
      <IncidentStatusSelect incidentId="inc1" instanceId="i1" currentStatus="open" />,
    );
    fireEvent.change(screen.getByDisplayValue('Open'), {
      target: { value: 'investigating' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/incidents/inc1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'investigating' }),
        }),
      );
    });
  });

  it('does not call fetch when selecting same status', () => {
    render(
      <IncidentStatusSelect incidentId="inc1" instanceId="i1" currentStatus="open" />,
    );
    fireEvent.change(screen.getByDisplayValue('Open'), { target: { value: 'open' } });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reloads on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(
      <IncidentStatusSelect incidentId="inc1" instanceId="i1" currentStatus="open" />,
    );
    fireEvent.change(screen.getByDisplayValue('Open'), {
      target: { value: 'resolved' },
    });

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows alert on error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Update failed' }),
    } as unknown as Response);
    render(
      <IncidentStatusSelect incidentId="inc1" instanceId="i1" currentStatus="open" />,
    );
    fireEvent.change(screen.getByDisplayValue('Open'), {
      target: { value: 'resolved' },
    });

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Update failed');
    });
  });

  it('shows alert on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));
    render(
      <IncidentStatusSelect incidentId="inc1" instanceId="i1" currentStatus="open" />,
    );
    fireEvent.change(screen.getByDisplayValue('Open'), {
      target: { value: 'resolved' },
    });

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Network error');
    });
  });
});
