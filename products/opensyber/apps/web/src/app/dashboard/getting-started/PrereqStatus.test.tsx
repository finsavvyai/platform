/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PrereqStatus from './PrereqStatus';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PrereqStatus', () => {
  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any;
    render(<PrereqStatus />);
    expect(screen.getByText('Checking prerequisites...')).toBeDefined();
  });

  it('renders prerequisite checks after loading', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: '1', status: 'running', gatewayToken: 'token123' }],
        }),
      }),
    ) as any;

    render(<PrereqStatus />);
    await waitFor(() => {
      expect(screen.getByText('Before You Start')).toBeDefined();
    });
    expect(screen.getByText(/Instance deployed/)).toBeDefined();
    expect(screen.getByText(/Gateway token configured/)).toBeDefined();
    expect(screen.getByText(/Agent running/)).toBeDefined();
  });

  it('shows action links for unmet prerequisites', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      }),
    ) as any;

    render(<PrereqStatus />);
    await waitFor(() => {
      expect(screen.getByText('Before You Start')).toBeDefined();
    });
    expect(screen.getAllByText(/Go to Dashboard/).length).toBeGreaterThan(0);
  });

  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('fail'))) as any;
    render(<PrereqStatus />);
    await waitFor(() => {
      expect(screen.getByText('Before You Start')).toBeDefined();
    });
  });
});
