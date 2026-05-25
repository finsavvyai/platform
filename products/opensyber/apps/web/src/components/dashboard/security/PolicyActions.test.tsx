/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PolicyActions } from './PolicyActions';

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

describe('PolicyActions', () => {
  it('renders pause button when active', () => {
    render(<PolicyActions policyId="p1" instanceId="i1" isActive={true} />);
    expect(screen.getByText('Pause')).toBeDefined();
  });

  it('renders activate button when inactive', () => {
    render(<PolicyActions policyId="p1" instanceId="i1" isActive={false} />);
    expect(screen.getByText('Activate')).toBeDefined();
  });

  it('calls PATCH to toggle active state', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<PolicyActions policyId="p1" instanceId="i1" isActive={true} />);
    fireEvent.click(screen.getByText('Pause'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/policies/p1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isActive: false }),
        }),
      );
    });
  });

  it('shows delete confirmation', () => {
    render(<PolicyActions policyId="p1" instanceId="i1" isActive={true} />);
    const trashBtn = screen.getByText('Pause').parentElement!.querySelector('button:last-child')!;
    fireEvent.click(trashBtn);
    expect(screen.getByText('Delete this policy?')).toBeDefined();
  });

  it('cancels delete confirmation', () => {
    render(<PolicyActions policyId="p1" instanceId="i1" isActive={true} />);
    const trashBtn = screen.getByText('Pause').parentElement!.querySelector('button:last-child')!;
    fireEvent.click(trashBtn);
    fireEvent.click(screen.getByText('No'));
    expect(screen.getByText('Pause')).toBeDefined();
  });

  it('calls DELETE on confirm', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<PolicyActions policyId="p1" instanceId="i1" isActive={true} />);
    const trashBtn = screen.getByText('Pause').parentElement!.querySelector('button:last-child')!;
    fireEvent.click(trashBtn);
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/policies/p1',
        { method: 'DELETE' },
      );
    });
  });

  it('reloads on successful delete', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<PolicyActions policyId="p1" instanceId="i1" isActive={true} />);
    const trashBtn = screen.getByText('Pause').parentElement!.querySelector('button:last-child')!;
    fireEvent.click(trashBtn);
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows alert on toggle error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));
    render(<PolicyActions policyId="p1" instanceId="i1" isActive={true} />);
    fireEvent.click(screen.getByText('Pause'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Network error');
    });
  });
});
