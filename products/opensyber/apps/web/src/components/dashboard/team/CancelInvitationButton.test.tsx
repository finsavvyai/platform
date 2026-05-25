/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CancelInvitationButton } from './CancelInvitationButton';

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

describe('CancelInvitationButton', () => {
  it('renders a button with cancel title', () => {
    render(<CancelInvitationButton orgId="org1" invitationId="inv1" />);
    expect(screen.getByTitle('Cancel invitation')).toBeDefined();
  });

  it('calls DELETE endpoint on click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CancelInvitationButton orgId="org1" invitationId="inv1" />);
    fireEvent.click(screen.getByTitle('Cancel invitation'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1/invitations/inv1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('reloads page on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CancelInvitationButton orgId="org1" invitationId="inv1" />);
    fireEvent.click(screen.getByTitle('Cancel invitation'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('disables button while loading', async () => {
    vi.mocked(global.fetch).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<CancelInvitationButton orgId="org1" invitationId="inv1" />);
    fireEvent.click(screen.getByTitle('Cancel invitation'));
    expect(screen.getByTitle('Cancel invitation')).toHaveProperty('disabled', true);
  });
});
