import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BatchJobs } from './BatchJobs';
import * as useApiModule from '../hooks/useApi';

vi.mock('../hooks/useApi');
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title, action }: any) => <><h1>{title}</h1>{action}</>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));
vi.mock('../components/batch/BatchJobCard', () => ({
  BatchJobCard: ({ job }: any) => <div>Job: {job.id} — {job.status}</div>,
}));

const mockJob = {
  batch_id: 'batch-1', status: 'completed', entity_count: 100,
  created_at: '2026-01-01T00:00:00Z', progress: 100, processed_entities: 100,
};

beforeEach(() => { vi.clearAllMocks() });

describe('BatchJobs', () => {
  it('shows loading spinner', () => {
    vi.spyOn(useApiModule, 'useApi').mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    render(<BatchJobs />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('shows empty state when no jobs', () => {
    vi.spyOn(useApiModule, 'useApi').mockReturnValue({ data: { jobs: [] }, loading: false, error: null, refetch: vi.fn() });
    render(<BatchJobs />);
    expect(screen.getByText(/no batch jobs yet/i)).toBeInTheDocument();
  });

  it('renders job list', () => {
    vi.spyOn(useApiModule, 'useApi').mockReturnValue({ data: { jobs: [mockJob] }, loading: false, error: null, refetch: vi.fn() });
    render(<BatchJobs />);
    expect(screen.getByText(/job: batch-1 — completed/i)).toBeInTheDocument();
  });

  it('shows error message', () => {
    vi.spyOn(useApiModule, 'useApi').mockReturnValue({ data: null, loading: false, error: new Error('Load failed'), refetch: vi.fn() });
    render(<BatchJobs />);
    expect(screen.getByText(/load failed/i)).toBeInTheDocument();
  });

  it('page title is rendered', () => {
    vi.spyOn(useApiModule, 'useApi').mockReturnValue({ data: { jobs: [] }, loading: false, error: null, refetch: vi.fn() });
    render(<BatchJobs />);
    // i18n returns key in test env — just verify PageHeader renders
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
});
