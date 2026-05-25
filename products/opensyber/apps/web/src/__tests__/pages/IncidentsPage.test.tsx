import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import IncidentsPage from '@/app/dashboard/security/incidents/page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

describe('IncidentsPage', () => {
  it('renders heading', async () => {
    const result = await IncidentsPage();
    render(result);
    expect(screen.getByText('Incidents')).toBeInTheDocument();
  });

  it('renders description', async () => {
    const result = await IncidentsPage();
    render(result);
    expect(
      screen.getByText(/Track and manage security incidents/),
    ).toBeInTheDocument();
  });

  it('shows empty state when no incidents', async () => {
    const result = await IncidentsPage();
    render(result);
    expect(screen.getByText('No incidents')).toBeInTheDocument();
  });
});
