/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: any[]) => { mockRedirect(...args); throw new Error('REDIRECT'); },
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { name: 'Admin', email: 'admin@ex.com' } }),
}));

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn().mockResolvedValue({ user: { isAdmin: true } }),
}));

import AdminLayout from './layout';

beforeEach(() => {
  vi.clearAllMocks();
  mockRedirect.mockClear();
});

describe('AdminLayout', () => {
  it('renders sidebar with navigation items', async () => {
    const jsx = await AdminLayout({ children: <div>Content</div> });
    render(jsx);
    expect(screen.getByText('Admin Panel')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Users')).toBeDefined();
    expect(screen.getByText('Organizations')).toBeDefined();
    expect(screen.getByText('Instances')).toBeDefined();
    expect(screen.getByText('Skills')).toBeDefined();
    expect(screen.getByText('Billing')).toBeDefined();
    expect(screen.getByText('Events')).toBeDefined();
  });

  it('renders children in main area', async () => {
    const jsx = await AdminLayout({ children: <div>Test Content</div> });
    render(jsx);
    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('shows admin user info in sidebar', async () => {
    const jsx = await AdminLayout({ children: <div>Content</div> });
    render(jsx);
    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('admin@ex.com')).toBeDefined();
  });

  it('renders back to dashboard link', async () => {
    const jsx = await AdminLayout({ children: <div>Content</div> });
    render(jsx);
    const backLink = screen.getByText(/Back to Dashboard/);
    expect(backLink).toBeDefined();
  });

  it('redirects non-admin users', async () => {
    const { apiClient } = await import('@/lib/api');
    vi.mocked(apiClient).mockResolvedValueOnce({ user: { isAdmin: false } });

    await expect(
      AdminLayout({ children: <div>Content</div> }),
    ).rejects.toThrow('REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects when no session', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce(null as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(
      AdminLayout({ children: <div>Content</div> }),
    ).rejects.toThrow('REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
