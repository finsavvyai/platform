import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MFASetup } from './MFASetup';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
}));

vi.mock('../components/auth/MFAVerified', () => ({
  MFAVerified: () => <div>MFA Verified</div>,
}));
vi.mock('../components/auth/MFAStart', () => ({
  MFAStart: ({ onStart, loading }: { onStart: () => void; loading: boolean }) => (
    <button onClick={onStart} disabled={loading}>Enable 2FA</button>
  ),
}));
vi.mock('../components/auth/MFASteps', () => ({
  MFASteps: ({ setup, code, onCodeChange, onVerify, loading }: any) => (
    <div>
      <span>{setup?.qr_url}</span>
      <span>{setup?.secret}</span>
      <input value={code} onChange={e => onCodeChange(e.target.value)} placeholder="Enter code" />
      <button onClick={onVerify} disabled={loading}>Verify</button>
    </div>
  ),
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('../components/ui/Card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
}));

beforeEach(() => { vi.clearAllMocks() });

describe('MFASetup', () => {
  it('renders initial start state', () => {
    render(<MFASetup />);
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByText('Enable 2FA')).toBeInTheDocument();
  });

  it('calls setup API and shows QR step', async () => {
    vi.mocked(api.post).mockResolvedValue({
      qr_url: 'otpauth://totp/test',
      secret: 'ABCDEF',
      recovery_codes: ['code1'],
    });
    render(<MFASetup />);
    await userEvent.click(screen.getByText('Enable 2FA'));
    await waitFor(() => expect(screen.getByText('otpauth://totp/test')).toBeInTheDocument());
  });

  it('shows error when setup API fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Setup failed'));
    render(<MFASetup />);
    await userEvent.click(screen.getByText('Enable 2FA'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Setup failed'));
  });

  it('verifies code and shows verified screen', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ qr_url: 'qr', secret: 'sec', recovery_codes: [] })
      .mockResolvedValueOnce({});
    render(<MFASetup />);
    await userEvent.click(screen.getByText('Enable 2FA'));
    await waitFor(() => screen.getByPlaceholderText('Enter code'));
    await userEvent.type(screen.getByPlaceholderText('Enter code'), '123456');
    await userEvent.click(screen.getByText('Verify'));
    await waitFor(() => expect(screen.getByText('MFA Verified')).toBeInTheDocument());
  });

  it('does not verify if code is less than 6 digits', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ qr_url: 'qr', secret: 'sec', recovery_codes: [] });
    render(<MFASetup />);
    await userEvent.click(screen.getByText('Enable 2FA'));
    await waitFor(() => screen.getByPlaceholderText('Enter code'));
    await userEvent.type(screen.getByPlaceholderText('Enter code'), '123');
    await userEvent.click(screen.getByText('Verify'));
    expect(api.post).toHaveBeenCalledTimes(1); // only the setup call, not verify
  });
});
