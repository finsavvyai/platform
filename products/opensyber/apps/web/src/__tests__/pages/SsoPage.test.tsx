import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SsoPage from '@/app/dashboard/team/sso/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@opensyber/shared', () => ({
  ROLE_HIERARCHY: { owner: 4, admin: 3, member: 2, viewer: 1 },
}));
vi.mock('@/components/dashboard/team/SsoConfigForm', () => ({
  SsoConfigForm: () => <div data-testid="sso-form" />,
}));

describe('SsoPage', () => {
  it('shows sign-in message when no token', async () => {
    const result = await SsoPage();
    render(result);
    expect(
      screen.getByText('Please sign in to manage SSO.'),
    ).toBeInTheDocument();
  });
});
