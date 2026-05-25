import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Webhooks } from './Webhooks';
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
vi.mock('../components/webhooks/WebhookForm', () => ({
  WebhookForm: ({ onSave, onCancel }: any) => (
    <div>
      <span>WebhookForm</span>
      <button onClick={onSave}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));
vi.mock('../components/webhooks/IncomingWebhookCard', () => ({
  IncomingWebhookCard: () => <div>IncomingWebhookCard</div>,
}));

const mockHook = { id: 'wh1', url: 'https://example.com/hook', events: ['alert.opened'], active: true, created_at: '2026-01-01' };

beforeEach(() => { vi.clearAllMocks() });

describe('Webhooks', () => {
  it('shows loading initially', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    render(<Webhooks />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders incoming webhook card', async () => {
    vi.mocked(api.get).mockResolvedValue({ subscriptions: [] });
    render(<Webhooks />);
    await waitFor(() => expect(screen.getByText('IncomingWebhookCard')).toBeInTheDocument());
  });

  it('shows empty state when no subscriptions', async () => {
    vi.mocked(api.get).mockResolvedValue({ subscriptions: [] });
    render(<Webhooks />);
    await waitFor(() => expect(screen.getByText(/no outgoing subscriptions/i)).toBeInTheDocument());
  });

  it('renders webhook subscriptions', async () => {
    vi.mocked(api.get).mockResolvedValue({ subscriptions: [mockHook] });
    render(<Webhooks />);
    await waitFor(() => expect(screen.getByText('https://example.com/hook')).toBeInTheDocument());
    expect(screen.getByText('alert.opened')).toBeInTheDocument();
  });

  it('shows webhook form on add subscription click', async () => {
    vi.mocked(api.get).mockResolvedValue({ subscriptions: [] });
    render(<Webhooks />);
    await waitFor(() => screen.getByText(/no outgoing subscriptions/i));
    await userEvent.click(screen.getByRole('button', { name: /add subscription/i }));
    expect(screen.getByText('WebhookForm')).toBeInTheDocument();
  });

  it('closes form on cancel', async () => {
    vi.mocked(api.get).mockResolvedValue({ subscriptions: [] });
    render(<Webhooks />);
    await waitFor(() => screen.getByText(/no outgoing subscriptions/i));
    await userEvent.click(screen.getByRole('button', { name: /add subscription/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('WebhookForm')).not.toBeInTheDocument();
  });

  it('deletes webhook after confirm', async () => {
    vi.mocked(api.get).mockResolvedValue({ subscriptions: [mockHook] });
    vi.mocked(api.del).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Webhooks />);
    await waitFor(() => screen.getByText('https://example.com/hook'));
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/webhooks/subscriptions/wh1'));
  });

  it('shows error on load failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network down'));
    render(<Webhooks />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network down'));
  });

  it('sends test event', async () => {
    vi.mocked(api.get).mockResolvedValue({ subscriptions: [] });
    vi.mocked(api.post).mockResolvedValue({});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Webhooks />);
    await waitFor(() => screen.getByRole('button', { name: /send test event/i }));
    await userEvent.click(screen.getByRole('button', { name: /send test event/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/webhooks/test', {}));
  });
});
