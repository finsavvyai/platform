/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportReportButton } from './ExportReportButton';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('ExportReportButton', () => {
  it('renders the export button', () => {
    render(<ExportReportButton instanceId="inst-1" reportId="rpt-1" />);
    expect(screen.getByText('Export CSV')).toBeDefined();
  });

  it('calls fetch with correct URL on click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://example.com/report.csv' }),
    } as unknown as Response);

    render(<ExportReportButton instanceId="inst-1" reportId="rpt-1" />);
    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/inst-1/compliance-reports/rpt-1/export?format=csv',
      );
    });
  });

  it('disables button during loading', async () => {
    let resolvePromise: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((r) => { resolvePromise = r as (v: unknown) => void; }),
    );

    render(<ExportReportButton instanceId="inst-1" reportId="rpt-1" />);
    fireEvent.click(screen.getByText('Export CSV'));

    expect(screen.getByText('Export CSV')).toHaveProperty('disabled', true);
    resolvePromise!({ ok: true, json: () => Promise.resolve({}) });
  });

  it('handles fetch error gracefully', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));

    render(<ExportReportButton instanceId="inst-1" reportId="rpt-1" />);
    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toHaveProperty('disabled', false);
    });
  });
});
