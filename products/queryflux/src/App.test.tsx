import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

vi.mock('./services/api', () => ({
  authAPI: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    logout: vi.fn(),
  },
  serverMetricsAPI: {
    getGlobal: vi.fn().mockResolvedValue({
      totalQueries: 0,
      totalErrors: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
    }),
  },
  api: {
    connections: {
      getAll: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });

  it('shows Dashboard heading by default (redirects to /dashboard)', async () => {
    render(<App />);
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { name: /Dashboard/i });
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('contains nav links for Dashboard, Connections, Query Editor, Settings', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Connections/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Query Editor/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });
});
