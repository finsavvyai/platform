/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportAuditButton } from './ExportAuditButton';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('ExportAuditButton', () => {
  it('renders the export button', () => {
    render(<ExportAuditButton instanceId="inst-1" />);
    expect(screen.getByText('Export Audit CSV')).toBeDefined();
  });

  it('renders two date inputs', () => {
    const { container } = render(<ExportAuditButton instanceId="inst-1" />);
    const inputs = container.querySelectorAll('input[type="date"]');
    expect(inputs.length).toBe(2);
  });

  it('calls fetch with correct URL on export', async () => {
    const mockOpen = vi.fn();
    vi.stubGlobal('open', mockOpen);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://example.com/export.csv' }),
    } as unknown as Response);

    render(<ExportAuditButton instanceId="inst-1" />);
    fireEvent.click(screen.getByText('Export Audit CSV'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/proxy/security/instances/inst-1/audit/export'),
      );
    });
  });

  it('disables button while loading', async () => {
    let resolvePromise: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((r) => { resolvePromise = r as (v: unknown) => void; }),
    );

    render(<ExportAuditButton instanceId="inst-1" />);
    fireEvent.click(screen.getByText('Export Audit CSV'));

    expect(screen.getByText('Export Audit CSV')).toHaveProperty('disabled', true);
    resolvePromise!({ ok: true, json: () => Promise.resolve({}) });
  });
});
