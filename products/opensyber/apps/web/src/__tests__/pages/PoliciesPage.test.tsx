import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PoliciesPage from '@/app/dashboard/security/policies/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

describe('PoliciesPage (Security)', () => {
  it('renders heading', async () => {
    const result = await PoliciesPage();
    render(result);
    expect(screen.getByText('Security Policies')).toBeInTheDocument();
  });

  it('renders description', async () => {
    const result = await PoliciesPage();
    render(result);
    expect(
      screen.getByText(/Manage security policies/),
    ).toBeInTheDocument();
  });

  it('shows empty state when no policies', async () => {
    const result = await PoliciesPage();
    render(result);
    expect(screen.getByText('No policies')).toBeInTheDocument();
  });
});
