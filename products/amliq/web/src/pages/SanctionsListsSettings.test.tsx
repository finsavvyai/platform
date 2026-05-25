import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SanctionsListsSettings } from './SanctionsListsSettings';
import * as AuthContext from '../context/AuthContext';

vi.mock('../api/client', () => ({
  fetchApi: vi.fn(),
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Spinner</div>,
}));

import { fetchApi } from '../api/client';

const mockUser = { id: '1', email: 'a@b.com', role: 'admin', tenant_id: 'tenant-1' };

const mockRows = [
  { list_id: 'ofac-sdn', parser_type: 'csv', mandatory: true, sync_enabled: true, sync_schedule: '0 */6 * * *', threshold: 0.8 },
  { list_id: 'eu-consolidated', parser_type: 'xml', mandatory: false, sync_enabled: false, sync_schedule: '0 12 * * *', threshold: 0.75 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: mockUser,
    loading: false,
    isAuthenticated: true,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
  });
});

describe('SanctionsListsSettings', () => {
  it('shows loading spinner initially', () => {
    vi.mocked(fetchApi).mockReturnValue(new Promise(() => {}));
    render(<SanctionsListsSettings />);
    expect(screen.getByText('Spinner')).toBeInTheDocument();
  });

  it('renders list rows after load', async () => {
    vi.mocked(fetchApi).mockResolvedValue(mockRows);
    render(<SanctionsListsSettings />);
    await waitFor(() => expect(screen.getByText('ofac-sdn')).toBeInTheDocument());
    expect(screen.getByText('eu-consolidated')).toBeInTheDocument();
  });

  it('mandatory list has disabled checkbox', async () => {
    vi.mocked(fetchApi).mockResolvedValue(mockRows);
    render(<SanctionsListsSettings />);
    await waitFor(() => screen.getByText('ofac-sdn'));
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeDisabled();
    expect(checkboxes[1]).not.toBeDisabled();
  });

  it('shows error message when fetch fails', async () => {
    vi.mocked(fetchApi).mockRejectedValue(new Error('Network error'));
    render(<SanctionsListsSettings />);
    await waitFor(() => expect(screen.getByText(/Error: Network error/)).toBeInTheDocument());
  });

  it('saves and shows saved message', async () => {
    vi.mocked(fetchApi).mockResolvedValueOnce(mockRows).mockResolvedValueOnce(mockRows);
    render(<SanctionsListsSettings />);
    await waitFor(() => screen.getByText('ofac-sdn'));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument());
  });

  it('shows error when save fails', async () => {
    vi.mocked(fetchApi).mockResolvedValueOnce(mockRows).mockRejectedValueOnce(new Error('Save failed'));
    render(<SanctionsListsSettings />);
    await waitFor(() => screen.getByText('ofac-sdn'));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(screen.getByText(/Error: Save failed/)).toBeInTheDocument());
  });

  it('updates cron schedule input', async () => {
    vi.mocked(fetchApi).mockResolvedValue(mockRows);
    render(<SanctionsListsSettings />);
    await waitFor(() => screen.getByText('eu-consolidated'));
    const cronInput = screen.getByLabelText('eu-consolidated cron');
    await userEvent.clear(cronInput);
    await userEvent.type(cronInput, '0 6 * * *');
    expect(cronInput).toHaveValue('0 6 * * *');
  });

  it('updates threshold input', async () => {
    vi.mocked(fetchApi).mockResolvedValue(mockRows);
    render(<SanctionsListsSettings />);
    await waitFor(() => screen.getByText('eu-consolidated'));
    const thresholdInput = screen.getByLabelText('eu-consolidated threshold');
    await userEvent.clear(thresholdInput);
    await userEvent.type(thresholdInput, '0.9');
    expect(thresholdInput).toHaveValue(0.9);
  });

  it('skips fetch when no tenantId', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      loginWithToken: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(fetchApi).mockResolvedValue([]);
    render(<SanctionsListsSettings />);
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it('shows error with String() when save throws non-Error', async () => {
    vi.mocked(fetchApi).mockResolvedValueOnce(mockRows).mockRejectedValueOnce('quota exceeded');
    render(<SanctionsListsSettings />);
    await waitFor(() => screen.getByText('ofac-sdn'));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(screen.getByText(/Error: quota exceeded/)).toBeInTheDocument());
  });
});
