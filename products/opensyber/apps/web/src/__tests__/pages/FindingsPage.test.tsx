import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FindingsPage from '@/app/dashboard/cloud/findings/page';

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));
vi.mock('@/components/dashboard/FindingsSkeleton', () => ({
  FindingsSkeleton: () => <div data-testid="skeleton" />,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('FindingsPage', () => {
  it('renders heading after loading', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          findings: [],
          summary: { critical: 0, high: 0, medium: 0, low: 0 },
        }),
    });

    render(<FindingsPage />);
    await waitFor(() => {
      expect(screen.getByText('CSPM Findings')).toBeInTheDocument();
    });
  });

  it('shows empty state when no findings', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          findings: [],
          summary: { critical: 0, high: 0, medium: 0, low: 0 },
        }),
    });

    render(<FindingsPage />);
    await waitFor(() => {
      expect(screen.getByText('No findings')).toBeInTheDocument();
    });
  });

  it('renders severity filter', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          findings: [],
          summary: { critical: 0, high: 0, medium: 0, low: 0 },
        }),
    });

    render(<FindingsPage />);
    await waitFor(() => {
      expect(screen.getByText('All Severities')).toBeInTheDocument();
    });
  });

  it('renders summary cards', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          findings: [],
          summary: { critical: 2, high: 5, medium: 10, low: 3 },
        }),
    });

    render(<FindingsPage />);
    await waitFor(() => {
      // Summary cards have labels that also appear in dropdowns,
      // so verify at least 2 of each (card + dropdown option)
      expect(screen.getAllByText('Critical').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('High').length).toBeGreaterThanOrEqual(2);
    });
  });
});
