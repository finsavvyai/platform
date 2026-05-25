import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CryptoScreening } from './CryptoScreening';
import { api } from '../api/client';
import { screeningApi } from '../api/screening';

vi.mock('../api/client', () => {
  class FakeApiError extends Error {
    status: number
    code: string
    constructor(code: string, msg: string, status: number) {
      super(msg)
      this.code = code
      this.status = status
    }
  }
  return { api: { post: vi.fn() }, ApiError: FakeApiError }
});

vi.mock('../api/screening', () => ({
  screeningApi: { getQuota: vi.fn() },
}));

vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));

vi.mock('../components/screening/CryptoResultCard', () => ({
  CryptoResultCard: ({ result }: any) => <div>Decision: {result.decision}</div>,
}));

vi.mock('../components/screening/ScreeningQuotaBanner', () => ({
  ScreeningQuotaBanner: () => <div data-testid="quota-banner" />,
}));

vi.mock('../components/screening/LimitReachedBanner', () => ({
  LimitReachedBanner: () => <div data-testid="limit-reached" />,
}));

const VALID_ETH = '0x' + 'a'.repeat(40)
const mockResult = {
  decision: 'CLEAR',
  wallet_address: VALID_ETH,
  chain: 'ETH',
  hits: [],
  risk_flags: [],
  processing_us: 42,
};

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(screeningApi.getQuota).mockResolvedValue({
    used: 0, limit: 100, remaining: 100,
    plan_name: 'Free', has_subscription: false,
  })
});

describe('CryptoScreening', () => {
  it('renders page title and wallet input', () => {
    render(<CryptoScreening />);
    expect(screen.getByText('Crypto Screening')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/0x7d/i)).toBeInTheDocument();
  });

  it('screen button disabled when address empty', () => {
    render(<CryptoScreening />);
    expect(screen.getByRole('button', { name: /screen wallet/i })).toBeDisabled();
  });

  it('screen button enabled after typing address', async () => {
    render(<CryptoScreening />);
    await userEvent.type(screen.getByPlaceholderText(/0x7d/i), VALID_ETH);
    expect(screen.getByRole('button', { name: /screen wallet/i })).not.toBeDisabled();
  });

  it('shows result card on success', async () => {
    vi.mocked(api.post).mockResolvedValue(mockResult);
    render(<CryptoScreening />);
    await userEvent.type(screen.getByPlaceholderText(/0x7d/i), VALID_ETH);
    await userEvent.click(screen.getByRole('button', { name: /screen wallet/i }));
    await waitFor(() => expect(screen.getByText('Decision: CLEAR')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/crypto/screen', { wallet_address: VALID_ETH, chain: 'ETH' });
  });

  it('shows error on API failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Bad wallet'));
    render(<CryptoScreening />);
    await userEvent.type(screen.getByPlaceholderText(/0x7d/i), VALID_ETH);
    await userEvent.click(screen.getByRole('button', { name: /screen wallet/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Bad wallet'));
  });

  it('does not screen when address is only whitespace', async () => {
    render(<CryptoScreening />);
    await userEvent.type(screen.getByPlaceholderText(/0x7d/i), '   ');
    expect(screen.getByRole('button', { name: /screen wallet/i })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects malformed address before calling API', async () => {
    render(<CryptoScreening />);
    await userEvent.type(screen.getByPlaceholderText(/0x7d/i), '0xnothex');
    await userEvent.click(screen.getByRole('button', { name: /screen wallet/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid ETH/i)
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('disables screen button when quota exhausted', async () => {
    vi.mocked(screeningApi.getQuota).mockResolvedValue({
      used: 100, limit: 100, remaining: 0,
      plan_name: 'Free', has_subscription: false,
    })
    render(<CryptoScreening />);
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent(/Quota exhausted/i)
    );
  });
});
