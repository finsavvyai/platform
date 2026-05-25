import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SourceHealth } from './SourceHealth';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Spinner</div>,
}));

const healthyData = {
  all_healthy: true,
  degraded: [],
  sources: [
    { source_id: 's1', name: 'OFAC', status: 'healthy', entity_count: 10000, avg_latency_ms: 200, consecutive_failures: 0 },
  ],
};

const degradedData = {
  all_healthy: false,
  degraded: ['EU Consolidated'],
  sources: [
    { source_id: 's1', name: 'OFAC', status: 'healthy', entity_count: 10000, avg_latency_ms: 200, consecutive_failures: 0 },
    { source_id: 's2', name: 'EU Consolidated', status: 'degraded', entity_count: 5000, avg_latency_ms: 800, consecutive_failures: 3 },
  ],
};

beforeEach(() => { vi.clearAllMocks() });

describe('SourceHealth', () => {
  it('shows loading spinner initially', async () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    render(<SourceHealth />);
    expect(screen.getByText('Spinner')).toBeInTheDocument();
  });

  it('renders source count after load', async () => {
    vi.mocked(api.get).mockResolvedValue(healthyData);
    render(<SourceHealth />);
    await waitFor(() => expect(screen.getByText('1 Data Sources')).toBeInTheDocument());
    expect(screen.getByText('All systems operational')).toBeInTheDocument();
  });

  it('shows degraded warning banner', async () => {
    vi.mocked(api.get).mockResolvedValue(degradedData);
    render(<SourceHealth />);
    await waitFor(() => expect(screen.getByText(/1 source.*experiencing issues/i)).toBeInTheDocument());
  });

  it('shows error on fetch failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Unreachable'));
    render(<SourceHealth />);
    await waitFor(() => expect(screen.getByText('Unreachable')).toBeInTheDocument());
  });

  it('syncs all and refreshes', async () => {
    vi.mocked(api.get).mockResolvedValue(healthyData);
    vi.mocked(api.post).mockResolvedValue({});
    render(<SourceHealth />);
    await waitFor(() => screen.getByRole('button', { name: /sync all/i }));
    await userEvent.click(screen.getByRole('button', { name: /sync all/i }));
    expect(api.post).toHaveBeenCalledWith('/admin/lists/refresh', {});
  });

  it('page title is rendered', async () => {
    vi.mocked(api.get).mockResolvedValue(healthyData);
    render(<SourceHealth />);
    expect(screen.getByText('Source Health')).toBeInTheDocument();
  });
});
