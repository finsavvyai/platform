/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { DeployInstanceButton } from './DeployInstanceButton';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
  mockRefresh.mockClear();
  global.fetch = vi.fn();
  global.alert = vi.fn();
});

describe('DeployInstanceButton', () => {
  it('renders deploy button initially', () => {
    render(<DeployInstanceButton />);
    expect(screen.getByText('Deploy Instance')).toBeDefined();
  });

  it('shows form when deploy button is clicked', () => {
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    expect(screen.getByText('Deploy New Instance')).toBeDefined();
    expect(screen.getByText('Instance Name')).toBeDefined();
    expect(screen.getByText('Region')).toBeDefined();
  });

  it('hides form when cancel is clicked', () => {
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    expect(screen.getByText('Deploy New Instance')).toBeDefined();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Deploy Instance')).toBeDefined();
  });

  it('has default name and region', () => {
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    const nameInput = screen.getByPlaceholderText('My Agent') as HTMLInputElement;
    expect(nameInput.value).toBe('My Agent');
    const regionSelect = screen.getByDisplayValue('EU Central (Falkenstein)') as HTMLSelectElement;
    expect(regionSelect.value).toBe('eu-central');
  });

  it('shows all region options', () => {
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    expect(screen.getByText('EU Central (Falkenstein)')).toBeDefined();
    expect(screen.getByText('US East (Ashburn)')).toBeDefined();
    expect(screen.getByText('US West (Hillsboro)')).toBeDefined();
    expect(screen.getByText('Asia Pacific (Singapore)')).toBeDefined();
  });

  it('disables deploy button and shows validation when name is empty', () => {
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    const nameInput = screen.getByPlaceholderText('My Agent');
    fireEvent.change(nameInput, { target: { value: '' } });
    const deployBtn = screen.getByText('Deploy');
    expect(deployBtn).toHaveProperty('disabled', true);
    expect(screen.getByText('Instance name is required.')).toBeDefined();
  });

  it('calls fetch with correct params on deploy', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ instance: { id: 'inst_1' } }),
    } as unknown as Response);
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    fireEvent.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/proxy/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Agent', region: 'eu-central' }),
      });
    });
  });

  it('shows success state on successful deploy', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ instance: { id: 'inst_1' } }),
    } as unknown as Response);
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    fireEvent.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/instances',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows inline error on failed deploy with retry', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Plan limit reached' }),
    } as unknown as Response);
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    fireEvent.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(screen.getByText('Plan limit reached')).toBeDefined();
      expect(screen.getByText('Retry Deploy')).toBeDefined();
    });
  });

  it('shows inline network error on fetch failure', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    fireEvent.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(screen.getByText('Network error. Check your connection and try again.')).toBeDefined();
    });
  });

  it('shows deploying state during request', async () => {
    let resolvePromise: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise<Response>((resolve) => { resolvePromise = resolve as (v: unknown) => void; }),
    );
    render(<DeployInstanceButton />);
    fireEvent.click(screen.getByText('Deploy Instance'));
    fireEvent.click(screen.getByText('Deploy'));

    expect(screen.getByText('Creating...')).toBeDefined();
    resolvePromise!({ ok: true, json: () => Promise.resolve({ instance: { id: 'inst_1' } }) });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
