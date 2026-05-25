/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the TokenForge React hook so tests don't need the real provider.
// The real hook reads context; mocking it to report `isBound: true` means
// the form renders without the "Verifying this device…" banner.
vi.mock('@opensyber/tokenforge/react', () => ({
  useTokenForge: () => ({
    isBound: true,
    isReady: true,
    deviceId: 'test-device',
    trustScore: 100,
  }),
}));

import { AddSecretForm } from './AddSecretForm';

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

describe('AddSecretForm', () => {
  it('renders "Add Secret" button initially', () => {
    render(<AddSecretForm instanceId="inst_1" />);
    expect(screen.getByText('Add Secret')).toBeDefined();
  });

  it('shows form when "Add Secret" is clicked', () => {
    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));
    expect(screen.getByText('Add New Secret')).toBeDefined();
    expect(screen.getByPlaceholderText('GITHUB_TOKEN')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter secret value...')).toBeDefined();
  });

  it('hides form when Cancel is clicked', () => {
    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Add Secret')).toBeDefined();
    expect(screen.queryByText('Add New Secret')).toBeNull();
  });

  it('converts key to uppercase and strips invalid chars', () => {
    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));

    const keyInput = screen.getByPlaceholderText('GITHUB_TOKEN');
    fireEvent.change(keyInput, { target: { value: 'my-api.key!' } });
    expect((keyInput as HTMLInputElement).value).toBe('MY_API_KEY_');
  });

  it('calls POST API with key and value on submit', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));

    fireEvent.change(screen.getByPlaceholderText('GITHUB_TOKEN'), {
      target: { value: 'API_KEY' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter secret value...'), {
      target: { value: 'sk-12345' },
    });
    fireEvent.click(screen.getByText('Store Secret'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/instances/inst_1/secrets',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'API_KEY', value: 'sk-12345' }),
        }),
      );
    });
  });

  it('reloads page on successful submit', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));
    fireEvent.change(screen.getByPlaceholderText('GITHUB_TOKEN'), {
      target: { value: 'KEY' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter secret value...'), {
      target: { value: 'val' },
    });
    fireEvent.click(screen.getByText('Store Secret'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows "Storing..." while saving', async () => {
    let resolve: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));
    fireEvent.change(screen.getByPlaceholderText('GITHUB_TOKEN'), {
      target: { value: 'KEY' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter secret value...'), {
      target: { value: 'val' },
    });
    fireEvent.click(screen.getByText('Store Secret'));

    expect(screen.getByText('Storing...')).toBeDefined();

    resolve!({ ok: true });
    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows inline error on API error with message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Duplicate key' }),
    });

    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));
    fireEvent.change(screen.getByPlaceholderText('GITHUB_TOKEN'), {
      target: { value: 'KEY' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter secret value...'), {
      target: { value: 'val' },
    });
    fireEvent.click(screen.getByText('Store Secret'));

    await waitFor(() => {
      expect(screen.getByText('Duplicate key')).toBeDefined();
    });
  });

  it('shows fallback inline error when error has no message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.reject(new Error('parse error')),
    });

    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));
    fireEvent.change(screen.getByPlaceholderText('GITHUB_TOKEN'), {
      target: { value: 'KEY' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter secret value...'), {
      target: { value: 'val' },
    });
    fireEvent.click(screen.getByText('Store Secret'));

    await waitFor(() => {
      expect(screen.getByText('Failed to store secret.')).toBeDefined();
    });
  });

  it('shows inline error on network error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));

    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));
    fireEvent.change(screen.getByPlaceholderText('GITHUB_TOKEN'), {
      target: { value: 'KEY' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter secret value...'), {
      target: { value: 'val' },
    });
    fireEvent.click(screen.getByText('Store Secret'));

    await waitFor(() => {
      expect(screen.getByText('Network error. Check your connection and try again.')).toBeDefined();
    });
  });

  it('disables submit when key or value is empty', () => {
    render(<AddSecretForm instanceId="inst_1" />);
    fireEvent.click(screen.getByText('Add Secret'));

    const submit = screen.getByText('Store Secret').closest('button')!;
    expect(submit.disabled).toBe(true);
  });
});
