/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddIncidentComment } from './AddIncidentComment';

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

describe('AddIncidentComment', () => {
  it('renders comment form', () => {
    render(<AddIncidentComment incidentId="inc1" instanceId="i1" />);
    expect(screen.getByText('Add Comment')).toBeDefined();
    expect(screen.getByPlaceholderText('Add a comment or evidence...')).toBeDefined();
  });

  it('disables submit button when content is empty', () => {
    render(<AddIncidentComment incidentId="inc1" instanceId="i1" />);
    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', true);
  });

  it('enables submit button when content is entered', () => {
    render(<AddIncidentComment incidentId="inc1" instanceId="i1" />);
    fireEvent.change(screen.getByPlaceholderText('Add a comment or evidence...'), {
      target: { value: 'A comment' },
    });
    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', false);
  });

  it('calls POST with correct data on submit', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<AddIncidentComment incidentId="inc1" instanceId="i1" />);
    fireEvent.change(screen.getByPlaceholderText('Add a comment or evidence...'), {
      target: { value: 'Investigation update' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/incidents/inc1/events',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ eventType: 'comment', content: 'Investigation update' }),
        }),
      );
    });
  });

  it('clears input and reloads on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<AddIncidentComment incidentId="inc1" instanceId="i1" />);
    fireEvent.change(screen.getByPlaceholderText('Add a comment or evidence...'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows alert on error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    } as unknown as Response);
    render(<AddIncidentComment incidentId="inc1" instanceId="i1" />);
    fireEvent.change(screen.getByPlaceholderText('Add a comment or evidence...'), {
      target: { value: 'comment' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Unauthorized');
    });
  });

  it('does not submit when content is whitespace only', () => {
    render(<AddIncidentComment incidentId="inc1" instanceId="i1" />);
    fireEvent.change(screen.getByPlaceholderText('Add a comment or evidence...'), {
      target: { value: '   ' },
    });
    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', true);
  });
});
