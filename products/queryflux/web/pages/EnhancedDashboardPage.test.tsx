import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EnhancedDashboardPage } from './EnhancedDashboardPage';

const mockConnections = [
  { id: 'c1', name: 'Production PostgreSQL', type: 'postgresql' },
  { id: 'c2', name: 'Analytics MySQL', type: 'mysql' },
];

const { mockUseConnections } = vi.hoisted(() => ({
  mockUseConnections: vi.fn(),
}));

vi.mock('../hooks/useConnections', () => ({
  useConnections: mockUseConnections,
}));

vi.mock('../services/api', () => ({
  serverMetricsAPI: {
    getGlobal: vi.fn().mockResolvedValue({
      totalQueries: 1200,
      totalErrors: 12,
      avgMs: 42,
      p50Ms: 30,
      p95Ms: 120,
      p99Ms: 180,
      maxMs: 250,
    }),
  },
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EnhancedDashboardPage />
    </QueryClientProvider>
  );
}

describe('EnhancedDashboardPage', () => {
  beforeEach(() => {
    mockUseConnections.mockReturnValue({
      data: mockConnections,
      isLoading: false,
    });
  });

  it('renders Dashboard heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Dashboard/i })
    ).toBeInTheDocument();
  });

  it('shows metric cards', () => {
    renderPage();
    expect(
      screen.getAllByText('Active Connections').length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Queries Run')).toBeInTheDocument();
    expect(screen.getByText('Avg Query Time')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
  });

  it('shows query activity section', () => {
    renderPage();
    expect(screen.getByText('Query Activity')).toBeInTheDocument();
    expect(
      screen.getByText('Backend query statistics')
    ).toBeInTheDocument();
  });

  it('shows active connections section', () => {
    renderPage();
    expect(
      screen.getAllByText('Active Connections').length
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText('Your connected databases')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Production PostgreSQL')
    ).toBeInTheDocument();
    expect(screen.getByText('Analytics MySQL')).toBeInTheDocument();
  });

  it('shows query latency section', () => {
    renderPage();
    expect(screen.getByText('Query Latency')).toBeInTheDocument();
  });
});
