/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateAlertRuleModal } from './CreateAlertRuleModal';

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

describe('CreateAlertRuleModal', () => {
  it('renders new rule button', () => {
    render(<CreateAlertRuleModal instanceId="i1" />);
    expect(screen.getByText('New Rule')).toBeDefined();
  });

  it('opens modal on button click', () => {
    render(<CreateAlertRuleModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Rule'));
    expect(screen.getByText('Create Alert Rule')).toBeDefined();
  });

  it('closes modal on cancel', () => {
    render(<CreateAlertRuleModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Rule'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Create Alert Rule')).toBeNull();
  });

  it('shows validation error when name is empty', async () => {
    render(<CreateAlertRuleModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Rule'));
    fireEvent.click(screen.getByText('Create Rule'));
    expect(screen.getByText('Name is required')).toBeDefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits form with correct data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CreateAlertRuleModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Rule'));

    const nameInput = screen.getByPlaceholderText('e.g. Brute force detector');
    fireEvent.change(nameInput, { target: { value: 'Test Rule' } });
    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/alert-rules',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Rule',
            eventType: 'brute_force_attempt',
            severityFilter: null,
            threshold: 1,
            windowMinutes: 60,
            cooldownMinutes: 30,
          }),
        }),
      );
    });
  });

  it('reloads on successful creation', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CreateAlertRuleModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Rule'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Brute force detector'), {
      target: { value: 'Rule' },
    });
    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows API error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Duplicate name' }),
    } as unknown as Response);
    render(<CreateAlertRuleModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Rule'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Brute force detector'), {
      target: { value: 'Rule' },
    });
    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(screen.getByText('Duplicate name')).toBeDefined();
    });
  });

  it('shows network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));
    render(<CreateAlertRuleModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Rule'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Brute force detector'), {
      target: { value: 'Rule' },
    });
    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  it('shows creating state during request', async () => {
    let resolvePromise: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise<Response>((resolve) => { resolvePromise = resolve as (v: unknown) => void; }),
    );
    render(<CreateAlertRuleModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Rule'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Brute force detector'), {
      target: { value: 'Rule' },
    });
    fireEvent.click(screen.getByText('Create Rule'));

    expect(screen.getByText('Creating...')).toBeDefined();
    resolvePromise!({ ok: true });
    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });
});
