/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateIncidentModal } from './CreateIncidentModal';

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

describe('CreateIncidentModal', () => {
  it('renders report incident button', () => {
    render(<CreateIncidentModal instanceId="i1" />);
    expect(screen.getByText('Report Incident')).toBeDefined();
  });

  it('opens modal on button click', () => {
    render(<CreateIncidentModal instanceId="i1" />);
    fireEvent.click(screen.getByText('Report Incident'));
    expect(screen.getAllByText('Report Incident').length).toBeGreaterThanOrEqual(2);
  });

  it('closes modal on cancel', () => {
    render(<CreateIncidentModal instanceId="i1" />);
    fireEvent.click(screen.getByText('Report Incident'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getAllByText('Report Incident')).toHaveLength(1);
  });

  it('shows validation error when title is empty', () => {
    render(<CreateIncidentModal instanceId="i1" />);
    fireEvent.click(screen.getByText('Report Incident'));
    const submitBtn = screen.getAllByText('Report Incident').find(
      (el) => el.tagName === 'BUTTON' && el.closest('.fixed'),
    )!;
    fireEvent.click(submitBtn);
    expect(screen.getByText('Title is required')).toBeDefined();
  });

  it('submits with correct data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CreateIncidentModal instanceId="i1" />);
    fireEvent.click(screen.getByText('Report Incident'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Unauthorized access detected'), {
      target: { value: 'Test Incident' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe what happened...'), {
      target: { value: 'Details here' },
    });

    const submitBtn = screen.getAllByText('Report Incident').find(
      (el) => el.tagName === 'BUTTON' && el.closest('.fixed'),
    )!;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/incidents',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            title: 'Test Incident',
            description: 'Details here',
            severity: 'medium',
          }),
        }),
      );
    });
  });

  it('reloads on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CreateIncidentModal instanceId="i1" />);
    fireEvent.click(screen.getByText('Report Incident'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Unauthorized access detected'), {
      target: { value: 'Test' },
    });
    const submitBtn = screen.getAllByText('Report Incident').find(
      (el) => el.tagName === 'BUTTON' && el.closest('.fixed'),
    )!;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Server error' }),
    } as unknown as Response);
    render(<CreateIncidentModal instanceId="i1" />);
    fireEvent.click(screen.getByText('Report Incident'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Unauthorized access detected'), {
      target: { value: 'Test' },
    });
    const submitBtn = screen.getAllByText('Report Incident').find(
      (el) => el.tagName === 'BUTTON' && el.closest('.fixed'),
    )!;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeDefined();
    });
  });

  it('renders severity options', () => {
    render(<CreateIncidentModal instanceId="i1" />);
    fireEvent.click(screen.getByText('Report Incident'));
    expect(screen.getByText('Critical')).toBeDefined();
    expect(screen.getByText('High')).toBeDefined();
    expect(screen.getByText('Medium')).toBeDefined();
    expect(screen.getByText('Low')).toBeDefined();
  });
});
