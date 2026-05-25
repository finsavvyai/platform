/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

vi.mock('@/components/dashboard/security/ExportAuditButton', () => ({
  ExportAuditButton: () => <button>Export</button>,
}));

vi.mock('./DateRangeFilter', () => ({
  DateRangeFilter: () => <div>Date Filter</div>,
}));

describe('LogsPage', () => {
  it('exports correct metadata', async () => {
    const mod = await import('./page');
    expect(mod.metadata).toEqual({ title: 'Audit Logs' });
  });

  it('exports a default async function', async () => {
    const mod = await import('./page');
    expect(typeof mod.default).toBe('function');
  });
});
