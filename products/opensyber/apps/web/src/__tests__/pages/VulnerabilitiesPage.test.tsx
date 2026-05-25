import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import VulnerabilitiesPage from '@/app/dashboard/security/vulnerabilities/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

describe('VulnerabilitiesPage', () => {
  it('renders heading', async () => {
    const result = await VulnerabilitiesPage();
    render(result);
    expect(screen.getByText('Vulnerabilities')).toBeInTheDocument();
  });

  it('renders description', async () => {
    const result = await VulnerabilitiesPage();
    render(result);
    expect(
      screen.getByText(/Track and manage security vulnerabilities/),
    ).toBeInTheDocument();
  });

  it('shows empty state for no vulnerabilities', async () => {
    const result = await VulnerabilitiesPage();
    render(result);
    expect(
      screen.getByText('No vulnerabilities found'),
    ).toBeInTheDocument();
  });
});
