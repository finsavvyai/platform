import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResetPassword } from './ResetPassword';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
}));

function renderWithToken(token: string | null = 'valid-token') {
  const search = token ? `?token=${token}` : '';
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/forgot-password" element={<div>Forgot</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks() });

describe('ResetPassword', () => {
  it('shows invalid link message when no token', () => {
    renderWithToken(null);
    expect(screen.getByText('Invalid reset link')).toBeInTheDocument();
  });

  it('renders password form when token present', () => {
    renderWithToken('tok123');
    expect(screen.getByPlaceholderText(/new password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderWithToken('tok123');
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'password1');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'password2');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('do not match');
  });

  it('shows error when password too short', async () => {
    renderWithToken('tok123');
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'short');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('8 characters');
  });

  it('calls API and shows success state', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    renderWithToken('tok123');
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'newpassword1');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'newpassword1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(screen.getByText('Password updated')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/auth/reset-password', { token: 'tok123', password: 'newpassword1' });
  });

  it('shows API error message on failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Token expired'));
    renderWithToken('tok123');
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'newpassword1');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'newpassword1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Token expired'));
  });
});
