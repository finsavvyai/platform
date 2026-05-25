import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TxnScreening } from './TxnScreening';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
}));

vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));

vi.mock('../components/screening/TxnResultCard', () => ({
  TxnResultCard: ({ result }: any) => <div>Decision: {result.decision}</div>,
}));

const mockResult = {
  decision: 'CLEAR',
  txn_id: 'txn-1',
  risk_flags: [],
  sender_hits: [],
  receiver_hits: [],
  case_id: '',
  processing_ms: 55,
};

beforeEach(() => { vi.clearAllMocks() });

describe('TxnScreening', () => {
  it('renders page title and form', () => {
    render(<TxnScreening />);
    expect(screen.getByText('Transaction Screening')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sender name/i)).toBeInTheDocument();
  });

  it('screen button disabled when sender name empty', () => {
    render(<TxnScreening />);
    expect(screen.getByRole('button', { name: /screen transaction/i })).toBeDisabled();
  });

  it('screen button enabled after typing sender name', async () => {
    render(<TxnScreening />);
    await userEvent.type(screen.getByPlaceholderText(/sender name/i), 'Alice');
    expect(screen.getByRole('button', { name: /screen transaction/i })).not.toBeDisabled();
  });

  it('shows result card on success', async () => {
    vi.mocked(api.post).mockResolvedValue(mockResult);
    render(<TxnScreening />);
    await userEvent.type(screen.getByPlaceholderText(/sender name/i), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: /screen transaction/i }));
    await waitFor(() => expect(screen.getByText('Decision: CLEAR')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/txn/screen', expect.objectContaining({ sender_name: 'Alice' }));
  });

  it('shows error on API failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Sanctions check failed'));
    render(<TxnScreening />);
    await userEvent.type(screen.getByPlaceholderText(/sender name/i), 'Bob');
    await userEvent.click(screen.getByRole('button', { name: /screen transaction/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sanctions check failed'));
  });

  it('sends amount_cents and currency fields', async () => {
    vi.mocked(api.post).mockResolvedValue(mockResult);
    render(<TxnScreening />);
    await userEvent.type(screen.getByPlaceholderText(/sender name/i), 'Alice');
    await userEvent.type(screen.getByPlaceholderText(/amount/i), '50000');
    await userEvent.click(screen.getByRole('button', { name: /screen transaction/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const call = vi.mocked(api.post).mock.calls[0][1] as any;
    expect(call.amount_cents).toBe(50000);
    expect(call.currency).toBe('USD');
  });

  it('shows generic error message on non-Error rejection', async () => {
    vi.mocked(api.post).mockRejectedValue('timeout');
    render(<TxnScreening />);
    await userEvent.type(screen.getByPlaceholderText(/sender name/i), 'Bob');
    await userEvent.click(screen.getByRole('button', { name: /screen transaction/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Screening failed'));
  });

  it('fills in all form fields', async () => {
    vi.mocked(api.post).mockResolvedValue(mockResult);
    render(<TxnScreening />);
    await userEvent.type(screen.getByPlaceholderText(/sender name/i), 'Alice');
    await userEvent.type(screen.getByPlaceholderText(/sender country/i), 'US');
    await userEvent.type(screen.getByPlaceholderText(/receiver name/i), 'Bob');
    await userEvent.type(screen.getByPlaceholderText(/receiver country/i), 'GB');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'EUR');
    expect(screen.getByRole('combobox')).toHaveValue('EUR');
  });
});
