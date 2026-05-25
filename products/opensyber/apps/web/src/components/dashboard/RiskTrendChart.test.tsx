/**
 * RiskTrendChart Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RiskTrendChart } from './RiskTrendChart';

// Mock fetch
global.fetch = vi.fn();

describe('RiskTrendChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton initially', () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));

    render(<RiskTrendChart endpoint="/api/test" />);
    expect(screen.getByText(/Risk Trend/)).toBeInTheDocument();
  });

  it('renders chart with data', async () => {
    const mockData = [
      { date: '2025-03-01', agentScore: 80, cspmScore: 85, combinedScore: 82, grade: 'B' },
      { date: '2025-03-02', agentScore: 82, cspmScore: 88, combinedScore: 84, grade: 'B' },
      { date: '2025-03-03', agentScore: 85, cspmScore: 90, combinedScore: 87, grade: 'B' },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<RiskTrendChart endpoint="/api/test" />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Risk Trend/)).toBeInTheDocument();
    expect(screen.getAllByText(/Combined/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Agent/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CSPM/).length).toBeGreaterThan(0);
  });

  it('shows empty state when insufficient data', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ date: '2025-03-01', agentScore: 80, cspmScore: 85, combinedScore: 82, grade: 'B' }] }),
    });

    render(<RiskTrendChart endpoint="/api/test" />);

    await waitFor(() => {
      expect(screen.getByText(/Risk trend data will appear/i)).toBeInTheDocument();
    });
  });

  it('shows error message on fetch failure', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<RiskTrendChart endpoint="/api/test" />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('uses correct endpoint with days parameter', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    render(<RiskTrendChart endpoint="/api/trend" days={7} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/trend?days=7');
    });
  });
});
