import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamPage from '@/app/dashboard/team/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@opensyber/shared', () => ({
  ROLE_HIERARCHY: { owner: 4, admin: 3, member: 2, viewer: 1 },
}));
vi.mock('@/components/dashboard/team/CreateOrgButton', () => ({
  CreateOrgButton: () => <button data-testid="create-org">Create Organization</button>,
}));
vi.mock('@/components/dashboard/team/InviteMemberButton', () => ({
  InviteMemberButton: () => <button>Invite</button>,
}));
vi.mock('@/components/dashboard/team/MemberTable', () => ({
  MemberTable: () => <div data-testid="member-table" />,
}));
vi.mock('@/components/dashboard/team/PendingInvitations', () => ({
  PendingInvitations: () => <div data-testid="pending" />,
}));

describe('TeamPage', () => {
  it('renders create org button when no token', async () => {
    const result = await TeamPage();
    render(result);
    expect(screen.getByTestId('create-org')).toBeInTheDocument();
  });
});
