import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PoliciesPage from '@/app/dashboard/agents/policies/page';

vi.mock('@/app/dashboard/agents/policies/types', () => ({
  RULE_TYPE_LABELS: { file_access: 'File Access' },
  RULE_TYPE_COLORS: { file_access: '' },
  SEV_COLORS: { critical: '', high: '', medium: '', low: '' },
}));
vi.mock('@/app/dashboard/agents/policies/CreatePolicyModal', () => ({
  CreatePolicyModal: () => <div data-testid="create-modal" />,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Agent PoliciesPage', () => {
  it('renders heading', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ policies: [] }),
    });

    render(<PoliciesPage />);
    await waitFor(() => {
      expect(screen.getByText('Agent Policies')).toBeInTheDocument();
    });
  });

  it('shows empty state when no policies', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ policies: [] }),
    });

    render(<PoliciesPage />);
    await waitFor(() => {
      expect(
        screen.getByText('No policies configured'),
      ).toBeInTheDocument();
    });
  });

  it('renders create policy button', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ policies: [] }),
    });

    render(<PoliciesPage />);
    await waitFor(() => {
      expect(screen.getByText('Create Policy')).toBeInTheDocument();
    });
  });
});
