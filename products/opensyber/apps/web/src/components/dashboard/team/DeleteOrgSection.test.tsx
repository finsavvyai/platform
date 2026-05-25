/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u-test' } }, status: 'authenticated' }),
}));

import { DeleteOrgSection } from './DeleteOrgSection';

Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
  localStorage.clear();
});

describe('DeleteOrgSection', () => {
  it('renders danger zone with org name', () => {
    render(<DeleteOrgSection orgId="org1" orgName="Acme" />);
    expect(screen.getByText('Danger Zone')).toBeDefined();
    expect(screen.getByText('Acme')).toBeDefined();
  });

  it('disables delete button when confirmation text does not match', () => {
    render(<DeleteOrgSection orgId="org1" orgName="Acme" />);
    const button = screen.getByText('Delete Organization');
    expect(button).toHaveProperty('disabled', true);
  });

  it('enables delete button when confirmation text matches', () => {
    render(<DeleteOrgSection orgId="org1" orgName="Acme" />);
    fireEvent.change(screen.getByPlaceholderText('Acme'), {
      target: { value: 'Acme' },
    });
    const button = screen.getByText('Delete Organization');
    expect(button).toHaveProperty('disabled', false);
  });

  it('calls DELETE endpoint when confirmed and clicked', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<DeleteOrgSection orgId="org1" orgName="Acme" />);
    fireEvent.change(screen.getByPlaceholderText('Acme'), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByText('Delete Organization'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('shows error on failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Cannot delete' }),
    } as unknown as Response);
    render(<DeleteOrgSection orgId="org1" orgName="Acme" />);
    fireEvent.change(screen.getByPlaceholderText('Acme'), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByText('Delete Organization'));

    await waitFor(() => {
      expect(screen.getByText('Cannot delete')).toBeDefined();
    });
  });
});
