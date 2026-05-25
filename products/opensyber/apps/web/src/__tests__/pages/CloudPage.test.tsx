import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CloudAccountsPage from '@/app/dashboard/cloud/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));
vi.mock('@/app/dashboard/cloud/ConnectAccountModal', () => ({
  ConnectAccountModal: () => <div data-testid="connect-modal" />,
}));
vi.mock('@/app/dashboard/cloud/types', () => ({
  STATUS_COLORS: {},
  PROVIDER_LABELS: { aws: 'AWS' },
  PROVIDER_COLORS: { aws: '' },
}));
vi.mock('@/components/dashboard/CloudSkeleton', () => ({
  CloudSkeleton: () => <div data-testid="cloud-skeleton" />,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CloudAccountsPage', () => {
  it('renders heading after loading', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: [] }),
    });

    render(<CloudAccountsPage />);
    await waitFor(() => {
      expect(screen.getByText('Cloud Security')).toBeInTheDocument();
    });
  });

  it('shows empty state when no accounts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: [] }),
    });

    render(<CloudAccountsPage />);
    await waitFor(() => {
      expect(
        screen.getByText('No cloud accounts connected'),
      ).toBeInTheDocument();
    });
  });

  it('shows Get Started button in empty state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: [] }),
    });

    render(<CloudAccountsPage />);
    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });
  });

  it('renders accounts table when data exists', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 'a1',
              provider: 'aws',
              name: 'Prod AWS',
              status: 'connected',
              lastScanAt: '2026-03-01',
            },
          ],
        }),
    });

    render(<CloudAccountsPage />);
    await waitFor(() => {
      expect(screen.getByText('Prod AWS')).toBeInTheDocument();
    });
  });

  it('renders setup wizard and quick connect buttons', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: [] }),
    });

    render(<CloudAccountsPage />);
    await waitFor(() => {
      expect(screen.getByText('Setup Wizard')).toBeInTheDocument();
      expect(screen.getByText('Quick Connect')).toBeInTheDocument();
    });
  });
});
