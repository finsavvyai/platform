/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RemoveMemberButton } from './RemoveMemberButton';

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

describe('RemoveMemberButton', () => {
  it('returns null for owner', () => {
    const { container } = render(
      <RemoveMemberButton orgId="org1" memberId="m1" memberName="Alice" isOwner={true} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders remove button for non-owner', () => {
    render(
      <RemoveMemberButton orgId="org1" memberId="m1" memberName="Bob" isOwner={false} />,
    );
    expect(screen.getByTitle('Remove member')).toBeDefined();
  });

  it('shows confirmation on click', () => {
    render(
      <RemoveMemberButton orgId="org1" memberId="m1" memberName="Bob" isOwner={false} />,
    );
    fireEvent.click(screen.getByTitle('Remove member'));
    expect(screen.getByText('Remove Bob?')).toBeDefined();
    expect(screen.getByText('Yes')).toBeDefined();
    expect(screen.getByText('No')).toBeDefined();
  });

  it('cancels confirmation on No click', () => {
    render(
      <RemoveMemberButton orgId="org1" memberId="m1" memberName="Bob" isOwner={false} />,
    );
    fireEvent.click(screen.getByTitle('Remove member'));
    fireEvent.click(screen.getByText('No'));
    expect(screen.getByTitle('Remove member')).toBeDefined();
  });

  it('calls DELETE and reloads on confirm', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(
      <RemoveMemberButton orgId="org1" memberId="m1" memberName="Bob" isOwner={false} />,
    );
    fireEvent.click(screen.getByTitle('Remove member'));
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1/members/m1',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows error message in confirmation on API failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' }),
    } as unknown as Response);
    render(
      <RemoveMemberButton orgId="org1" memberId="m1" memberName="Bob" isOwner={false} />,
    );
    fireEvent.click(screen.getByTitle('Remove member'));
    fireEvent.click(screen.getByText('Yes'));

    // After failure, the confirmation dialog remains visible so the user can
    // see the error and retry — window.location.reload should NOT have been called.
    await waitFor(() => {
      expect(mockReload).not.toHaveBeenCalled();
      expect(screen.getByText(/Remove Bob/)).toBeDefined();
    });
    expect(screen.getByText('Server error')).toBeDefined();
  });
});
