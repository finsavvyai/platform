import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ViolationsPage from '@/app/dashboard/agents/violations/page';

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));
vi.mock('@/components/dashboard/ViolationsSkeleton', () => ({
  ViolationsSkeleton: () => <div data-testid="skeleton" />,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ViolationsPage', () => {
  it('renders heading', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ violations: [] }),
    });

    render(<ViolationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Policy Violations')).toBeInTheDocument();
    });
  });

  it('shows empty state when no violations', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ violations: [] }),
    });

    render(<ViolationsPage />);
    await waitFor(() => {
      expect(screen.getByText('No violations')).toBeInTheDocument();
    });
  });

  it('renders severity and status filters', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ violations: [] }),
    });

    render(<ViolationsPage />);
    await waitFor(() => {
      expect(screen.getByText('All Severities')).toBeInTheDocument();
      expect(screen.getByText('All Status')).toBeInTheDocument();
    });
  });
});
