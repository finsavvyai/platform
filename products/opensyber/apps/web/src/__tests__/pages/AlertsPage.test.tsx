import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertsPage from '@/app/dashboard/security/alerts/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

describe('AlertsPage', () => {
  it('renders heading', async () => {
    const result = await AlertsPage();
    render(result);
    expect(screen.getByText('Security Alerts')).toBeInTheDocument();
  });

  it('renders description', async () => {
    const result = await AlertsPage();
    render(result);
    expect(
      screen.getByText(/Monitor triggered alerts/),
    ).toBeInTheDocument();
  });

  it('shows empty alerts state', async () => {
    const result = await AlertsPage();
    render(result);
    expect(screen.getByText('No alerts')).toBeInTheDocument();
  });

  it('shows empty alert rules state', async () => {
    const result = await AlertsPage();
    render(result);
    expect(screen.getByText('No alert rules')).toBeInTheDocument();
  });
});
