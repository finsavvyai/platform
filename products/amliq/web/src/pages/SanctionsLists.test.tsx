import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SanctionsLists } from './SanctionsLists';
import * as useListsModule from '../hooks/useLists';
import { api } from '../api/client';

vi.mock('../hooks/useLists');
vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title, description }: any) => <><h1>{title}</h1><p>{description}</p></>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));
vi.mock('../components/lists/ListCard', () => ({
  ListCard: ({ list }: any) => <div>List: {list.name}</div>,
}));

const mockList = {
  id: 'l1', name: 'OFAC SDN', entity_count: 12000,
  source_url: '', custom_url: '', parser_type: 'csv',
  last_synced: 0, sync_enabled: true, threshold: 0.8,
};
const mockHook = { lists: [mockList], loading: false, error: null, refetch: vi.fn(), triggerSync: vi.fn() };

beforeEach(() => { vi.clearAllMocks() });

function renderPage() {
  return render(<MemoryRouter><SanctionsLists /></MemoryRouter>);
}

describe('SanctionsLists', () => {
  it('shows loading spinner', () => {
    vi.spyOn(useListsModule, 'useLists').mockReturnValue({ ...mockHook, loading: true });
    renderPage();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders list cards', () => {
    vi.spyOn(useListsModule, 'useLists').mockReturnValue(mockHook);
    renderPage();
    expect(screen.getByText('List: OFAC SDN')).toBeInTheDocument();
  });

  it('shows total entity count in description', () => {
    vi.spyOn(useListsModule, 'useLists').mockReturnValue(mockHook);
    renderPage();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
  });

  it('shows error when useLists returns error', () => {
    vi.spyOn(useListsModule, 'useLists').mockReturnValue({ ...mockHook, lists: [], error: new Error('API fail') });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('API fail');
  });

  it('triggers reload and shows message', async () => {
    vi.spyOn(useListsModule, 'useLists').mockReturnValue(mockHook);
    vi.mocked(api.post).mockResolvedValue({});
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /reload all lists/i }));
    await waitFor(() => expect(screen.getByText(/reload started/i)).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/admin/lists/refresh', {});
  });

  it('shows error message when reload fails', async () => {
    vi.spyOn(useListsModule, 'useLists').mockReturnValue(mockHook);
    vi.mocked(api.post).mockRejectedValue(new Error('Reload failed'));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /reload all lists/i }));
    await waitFor(() => expect(screen.getByText(/error: reload failed/i)).toBeInTheDocument());
  });

  it('browse marketplace button navigates', async () => {
    vi.spyOn(useListsModule, 'useLists').mockReturnValue(mockHook);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /browse marketplace/i }));
  });

  it('shows error with String() when reload throws non-Error', async () => {
    vi.spyOn(useListsModule, 'useLists').mockReturnValue(mockHook);
    vi.mocked(api.post).mockRejectedValue('quota exceeded');
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /reload all lists/i }));
    await waitFor(() => expect(screen.getByText(/Error: quota exceeded/i)).toBeInTheDocument());
  });

  it('setTimeout triggers refetch after successful reload', async () => {
    const refetch = vi.fn();
    vi.spyOn(useListsModule, 'useLists').mockReturnValue({ ...mockHook, refetch });
    vi.mocked(api.post).mockResolvedValue({});
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /reload all lists/i }));
    await waitFor(() => expect(screen.getByText(/reload started/i)).toBeInTheDocument());
    const cb = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 3000)?.[0] as (() => void) | undefined;
    cb?.();
    expect(refetch).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
