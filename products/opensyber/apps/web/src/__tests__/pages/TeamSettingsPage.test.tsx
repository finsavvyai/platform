import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamSettingsPage from '@/app/dashboard/team/settings/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@opensyber/shared', () => ({
  ROLE_HIERARCHY: { owner: 4, admin: 3, member: 2, viewer: 1 },
}));
vi.mock('@/components/dashboard/team/OrgSettingsForm', () => ({
  OrgSettingsForm: () => <div data-testid="org-form" />,
}));
vi.mock('@/components/dashboard/team/DeleteOrgSection', () => ({
  DeleteOrgSection: () => <div data-testid="delete-org" />,
}));

describe('TeamSettingsPage', () => {
  it('shows unauthorized when no token', async () => {
    const result = await TeamSettingsPage();
    render(result);
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });
});
