import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { APIKeys } from './APIKeys';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), del: vi.fn() },
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));
vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: any) => <p>{title}</p>,
}));
vi.mock('../components/apikeys/NewKeyBanner', () => ({
  NewKeyBanner: ({ keyValue }: any) => <p>New key: {keyValue}</p>,
}));
vi.mock('../components/apikeys/KeyRow', () => ({
  KeyRow: ({ apiKey, onRevoke }: any) => (
    <div>
      <span>{apiKey.prefix}</span>
      <button onClick={() => onRevoke(apiKey.id)}>Revoke</button>
    </div>
  ),
}));

const mockKey = { id: 'k1', product: 'api', prefix: 'amliq_', rate_limit: 100, created_at: '2026-01-01', revoked: false };

beforeEach(() => { vi.clearAllMocks() });

describe('APIKeys', () => {
  it('shows loading initially', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    render(<APIKeys />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('shows empty state when no keys', async () => {
    vi.mocked(api.get).mockResolvedValue({ keys: [] });
    render(<APIKeys />);
    await waitFor(() => expect(screen.getByText('No API keys yet')).toBeInTheDocument());
  });

  it('renders key list', async () => {
    vi.mocked(api.get).mockResolvedValue({ keys: [mockKey] });
    render(<APIKeys />);
    await waitFor(() => expect(screen.getByText('amliq_')).toBeInTheDocument());
  });

  it('generates new key and shows banner', async () => {
    vi.mocked(api.get).mockResolvedValue({ keys: [] });
    vi.mocked(api.post).mockResolvedValue({ key: 'amliq_secret_abc123' });
    render(<APIKeys />);
    await waitFor(() => screen.getByText('No API keys yet'));
    await userEvent.click(screen.getByRole('button', { name: /generate key/i }));
    await waitFor(() => expect(screen.getByText(/new key:/i)).toHaveTextContent('amliq_secret_abc123'));
  });

  it('shows error on generate failure', async () => {
    vi.mocked(api.get).mockResolvedValue({ keys: [] });
    vi.mocked(api.post).mockRejectedValue(new Error('Quota exceeded'));
    render(<APIKeys />);
    await waitFor(() => screen.getByText('No API keys yet'));
    await userEvent.click(screen.getByRole('button', { name: /generate key/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Quota exceeded'));
  });

  it('revokes key after confirm', async () => {
    vi.mocked(api.get).mockResolvedValue({ keys: [mockKey] });
    vi.mocked(api.del).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<APIKeys />);
    await waitFor(() => screen.getByText('amliq_'));
    await userEvent.click(screen.getByRole('button', { name: /revoke/i }));
    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/keys/k1'));
  });

  it('skips revoke when confirm is cancelled', async () => {
    vi.mocked(api.get).mockResolvedValue({ keys: [mockKey] });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<APIKeys />);
    await waitFor(() => screen.getByText('amliq_'));
    await userEvent.click(screen.getByRole('button', { name: /revoke/i }));
    expect(api.del).not.toHaveBeenCalled();
  });

  it('shows error on load failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Load failed'));
    render(<APIKeys />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Load failed'));
  });
});
