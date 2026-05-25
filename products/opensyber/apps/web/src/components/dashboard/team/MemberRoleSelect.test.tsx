/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemberRoleSelect } from './MemberRoleSelect';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('MemberRoleSelect', () => {
  it('renders static label for owner', () => {
    render(
      <MemberRoleSelect
        orgId="org1"
        memberId="m1"
        currentRole="owner"
        currentUserRole="admin"
        isOwner={true}
      />,
    );
    expect(screen.getByText('Owner')).toBeDefined();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('renders select for non-owner', () => {
    render(
      <MemberRoleSelect
        orgId="org1"
        memberId="m1"
        currentRole="developer"
        currentUserRole="admin"
        isOwner={false}
      />,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('developer');
  });

  it('calls PATCH on role change', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(
      <MemberRoleSelect
        orgId="org1"
        memberId="m1"
        currentRole="developer"
        currentUserRole="admin"
        isOwner={false}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'viewer' },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1/members/m1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ role: 'viewer' }),
        }),
      );
    });
  });

  it('reverts role on API failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as Response);
    render(
      <MemberRoleSelect
        orgId="org1"
        memberId="m1"
        currentRole="developer"
        currentUserRole="admin"
        isOwner={false}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'viewer' },
    });

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('developer');
    });
  });
});
