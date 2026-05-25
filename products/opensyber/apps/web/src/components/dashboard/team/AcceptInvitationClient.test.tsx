/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u-test' } }, status: 'authenticated' }),
}));

import { AcceptInvitationClient } from './AcceptInvitationClient';

Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AcceptInvitationClient', () => {
  it('shows loading state initially', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));
    render(<AcceptInvitationClient token="tok123" />);
    expect(screen.getByText('Accepting invitation...')).toBeDefined();
  });

  it('shows success state on 200 response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ orgId: 'org-abc' }),
    } as unknown as Response);

    render(<AcceptInvitationClient token="tok123" />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to the team!')).toBeDefined();
    });
  });

  it('shows expired state on 410 response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 410,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    render(<AcceptInvitationClient token="tok123" />);

    await waitFor(() => {
      expect(screen.getByText('Invitation Expired')).toBeDefined();
    });
  });

  it('shows already member state on 409 response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    render(<AcceptInvitationClient token="tok123" />);

    await waitFor(() => {
      expect(screen.getByText('Already a Member')).toBeDefined();
    });
  });

  it('shows error state on other failures', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    } as unknown as Response);

    render(<AcceptInvitationClient token="tok123" />);

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeDefined();
      expect(screen.getByText('Server error')).toBeDefined();
    });
  });

  it('shows network error on fetch failure', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network'));

    render(<AcceptInvitationClient token="tok123" />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  it('calls correct API endpoint', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    render(<AcceptInvitationClient token="my-token" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/invitations/my-token/accept',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
