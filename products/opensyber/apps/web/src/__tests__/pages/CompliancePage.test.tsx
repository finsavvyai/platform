import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompliancePage from '@/app/dashboard/security/compliance/page';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockRejectedValue(new Error('no token')),
}));
vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));
vi.mock('@/components/dashboard/security/ExportReportButton', () => ({
  ExportReportButton: () => <button>Export</button>,
}));

describe('CompliancePage', () => {
  it('renders heading', async () => {
    const result = await CompliancePage();
    render(result);
    expect(screen.getByText('Compliance Reports')).toBeInTheDocument();
  });

  it('renders description', async () => {
    const result = await CompliancePage();
    render(result);
    expect(
      screen.getByText(/View compliance assessment reports/),
    ).toBeInTheDocument();
  });

  it('shows empty state when no reports', async () => {
    const result = await CompliancePage();
    render(result);
    expect(
      screen.getByText('No compliance reports'),
    ).toBeInTheDocument();
  });
});
