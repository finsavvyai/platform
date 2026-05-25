/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

vi.mock('@/components/admin/ChangePlanSelect', () => ({
  ChangePlanSelect: ({ currentPlan }: any) => <span>{currentPlan}</span>,
}));

vi.mock('@/components/admin/SuspendUserButton', () => ({
  SuspendUserButton: () => <button>Suspend</button>,
}));

vi.mock('@/components/admin/ToggleAdminButton', () => ({
  ToggleAdminButton: () => <button>Toggle Admin</button>,
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'alice@ex.com', name: 'Alice', plan: 'pro', isAdmin: false, isSuspended: false, createdAt: '2026-01-01' },
    instances: [{ id: 'i1', name: 'Agent Alpha', status: 'running', createdAt: '2026-01-15' }],
    memberships: [{ orgId: 'org1', orgName: 'Acme', role: 'admin' }],
  }),
}));

import AdminUserDetailPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminUserDetailPage', () => {
  it('renders user name and email', async () => {
    const jsx = await AdminUserDetailPage({ params: Promise.resolve({ id: 'u1' }) });
    render(jsx);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('alice@ex.com')).toBeDefined();
  });

  it('renders info cards', async () => {
    const jsx = await AdminUserDetailPage({ params: Promise.resolve({ id: 'u1' }) });
    render(jsx);
    expect(screen.getByText('pro')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('renders instances section', async () => {
    const jsx = await AdminUserDetailPage({ params: Promise.resolve({ id: 'u1' }) });
    render(jsx);
    expect(screen.getByText('Instances (1)')).toBeDefined();
    expect(screen.getByText('Agent Alpha')).toBeDefined();
  });

  it('renders organizations section', async () => {
    const jsx = await AdminUserDetailPage({ params: Promise.resolve({ id: 'u1' }) });
    render(jsx);
    expect(screen.getByText('Organizations (1)')).toBeDefined();
    expect(screen.getByText('Acme')).toBeDefined();
  });

  it('renders unauthorized when no token', async () => {
    const { getApiToken } = await import('@/lib/auth-token');
    vi.mocked(getApiToken).mockResolvedValueOnce(null);
    const jsx = await AdminUserDetailPage({ params: Promise.resolve({ id: 'u1' }) });
    render(jsx);
    expect(screen.getByText('Unauthorized')).toBeDefined();
  });
});
