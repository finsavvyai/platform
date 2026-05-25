/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerateComplianceReport } from './GenerateComplianceReport';

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockReload.mockClear();
  global.fetch = vi.fn();
  global.alert = vi.fn();
});

describe('GenerateComplianceReport', () => {
  it('renders framework select and generate button', () => {
    render(<GenerateComplianceReport instanceId="i1" />);
    expect(screen.getByText('Generate Report')).toBeDefined();
    expect(screen.getByText('SOC 2 Type II')).toBeDefined();
  });

  it('renders all framework options', () => {
    render(<GenerateComplianceReport instanceId="i1" />);
    expect(screen.getByText('SOC 2 Type II')).toBeDefined();
    expect(screen.getByText('ISO 27001:2022')).toBeDefined();
    expect(screen.getByText('CIS Controls v8')).toBeDefined();
  });

  it('calls POST with selected framework on generate', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<GenerateComplianceReport instanceId="i1" />);
    fireEvent.click(screen.getByText('Generate Report'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/compliance-reports',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ framework: 'soc2' }),
        }),
      );
    });
  });

  it('sends correct framework when changed', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<GenerateComplianceReport instanceId="i1" />);
    const select = screen.getByDisplayValue('SOC 2 Type II');
    fireEvent.change(select, { target: { value: 'cis' } });
    fireEvent.click(screen.getByText('Generate Report'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/compliance-reports',
        expect.objectContaining({
          body: JSON.stringify({ framework: 'cis' }),
        }),
      );
    });
  });

  it('reloads page on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<GenerateComplianceReport instanceId="i1" />);
    fireEvent.click(screen.getByText('Generate Report'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows alert on error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Generation failed' }),
    } as unknown as Response);
    render(<GenerateComplianceReport instanceId="i1" />);
    fireEvent.click(screen.getByText('Generate Report'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Generation failed');
    });
  });

  it('shows generating state during request', async () => {
    let resolvePromise: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise<Response>((resolve) => { resolvePromise = resolve as (v: unknown) => void; }),
    );
    render(<GenerateComplianceReport instanceId="i1" />);
    fireEvent.click(screen.getByText('Generate Report'));

    expect(screen.getByText('Generating...')).toBeDefined();
    resolvePromise!({ ok: true });
    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });
});
