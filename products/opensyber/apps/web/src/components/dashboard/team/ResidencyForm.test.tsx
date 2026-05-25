/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResidencyForm } from './ResidencyForm';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('ResidencyForm', () => {
  it('renders all region options', () => {
    render(<ResidencyForm orgId="org1" current={null} />);
    expect(screen.getByText('Europe (EU)')).toBeDefined();
    expect(screen.getByText('United States')).toBeDefined();
    expect(screen.getByText('Asia Pacific')).toBeDefined();
  });

  it('renders strict enforcement checkbox', () => {
    render(<ResidencyForm orgId="org1" current={null} />);
    expect(screen.getByText('Strict enforcement')).toBeDefined();
  });

  it('shows warning when current config exists', () => {
    render(
      <ResidencyForm orgId="org1" current={{ region: 'eu', enforceStrict: false }} />,
    );
    expect(
      screen.getByText(/Changing your region policy will not move existing instances/),
    ).toBeDefined();
  });

  it('does not show warning when no current config', () => {
    render(<ResidencyForm orgId="org1" current={null} />);
    expect(
      screen.queryByText(/Changing your region policy/),
    ).toBeNull();
  });

  it('disables save button when no region is selected', () => {
    render(<ResidencyForm orgId="org1" current={null} />);
    const button = screen.getByText('Save Configuration').closest('button');
    expect(button).toHaveProperty('disabled', true);
  });

  it('calls PUT on save with region selected', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<ResidencyForm orgId="org1" current={null} />);

    fireEvent.click(screen.getByText('Europe (EU)'));
    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1/residency',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ region: 'eu', enforceStrict: false }),
        }),
      );
    });
  });

  it('shows success message after save', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<ResidencyForm orgId="org1" current={null} />);
    fireEvent.click(screen.getByText('United States'));
    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(screen.getByText('Residency configuration saved')).toBeDefined();
    });
  });

  it('pre-selects region from current config', () => {
    const { container } = render(
      <ResidencyForm orgId="org1" current={{ region: 'us', enforceStrict: true }} />,
    );
    const selected = container.querySelector('.border-info');
    expect(selected).toBeTruthy();
  });
});
