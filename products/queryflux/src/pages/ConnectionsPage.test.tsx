import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionsPage } from './ConnectionsPage';

const mockMutateAsync = vi.fn();
const mockDeleteMutate = vi.fn();
const mockCreateMutateAsync = vi.fn();

const { mockUseConnections, mockUseDeleteConnection, mockUseTestConnection, mockUseCreateConnection } =
  vi.hoisted(() => ({
    mockUseConnections: vi.fn(),
    mockUseDeleteConnection: vi.fn(),
    mockUseTestConnection: vi.fn(),
    mockUseCreateConnection: vi.fn(),
  }));

vi.mock('../hooks/useConnections', () => ({
  useConnections: mockUseConnections,
  useDeleteConnection: mockUseDeleteConnection,
  useTestConnection: mockUseTestConnection,
  useCreateConnection: mockUseCreateConnection,
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ConnectionsPage />
    </QueryClientProvider>
  );
}

const connectionsList = [
  { id: 'c1', name: 'Production DB', type: 'postgresql', host: 'db.example.com', port: 5432, database: 'prod' },
  { id: 'c2', name: 'Staging DB', type: 'mysql', host: 'staging.local', port: 3306 },
];

describe('ConnectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConnections.mockReturnValue({ data: undefined, isLoading: false });
    mockUseDeleteConnection.mockReturnValue({ mutate: mockDeleteMutate });
    mockUseTestConnection.mockReturnValue({ mutateAsync: mockMutateAsync });
    mockUseCreateConnection.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    });
  });

  it('renders heading and description', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Database Connections/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Manage your database connections')
    ).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseConnections.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    // Component uses Unicode ellipsis character
    expect(screen.getByText(/Loading connections/)).toBeInTheDocument();
  });

  it('shows empty state when no connections', () => {
    renderPage();
    expect(screen.getByText('No connections yet')).toBeInTheDocument();
    expect(
      screen.getByText('Get started by creating your first database connection')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Create Connection/i })
    ).toBeInTheDocument();
  });

  it('renders connection cards with details', () => {
    mockUseConnections.mockReturnValue({ data: connectionsList, isLoading: false });
    renderPage();
    expect(screen.getByText('Production DB')).toBeInTheDocument();
    expect(screen.getByText('postgresql')).toBeInTheDocument();
    // Host and port are rendered together as "host:port"
    expect(screen.getByText('db.example.com:5432')).toBeInTheDocument();
    expect(screen.getByText('prod')).toBeInTheDocument();
    expect(screen.getByText('Staging DB')).toBeInTheDocument();
    expect(screen.getByText('mysql')).toBeInTheDocument();
  });

  it('shows Test buttons for each connection', () => {
    mockUseConnections.mockReturnValue({ data: connectionsList, isLoading: false });
    renderPage();
    const testButtons = screen.getAllByRole('button', { name: /Test/i });
    expect(testButtons).toHaveLength(2);
  });

  it('calls handleTest and shows Testing state', async () => {
    mockMutateAsync.mockImplementation(
      () => new Promise((r) => setTimeout(r, 100))
    );
    mockUseConnections.mockReturnValue({ data: connectionsList, isLoading: false });
    renderPage();

    const testButtons = screen.getAllByRole('button', { name: /Test/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      // Component uses Unicode ellipsis: "Testing\u2026"
      expect(screen.getByText(/Testing/)).toBeInTheDocument();
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(connectionsList[0]);
  });

  it('calls handleDelete with confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockUseConnections.mockReturnValue({ data: connectionsList, isLoading: false });
    renderPage();

    // Find delete buttons by their Trash2 icon (svg inside button)
    const allButtons = screen.getAllByRole('button');
    const deleteButtons = allButtons.filter(
      (btn) => btn.querySelector('svg.lucide-trash-2') !== null
    );
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith('Delete this connection?');
    expect(mockDeleteMutate).toHaveBeenCalledWith('c1');
  });

  it('does not delete when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mockUseConnections.mockReturnValue({ data: connectionsList, isLoading: false });
    renderPage();

    const allButtons = screen.getAllByRole('button');
    const deleteButtons = allButtons.filter(
      (btn) => btn.querySelector('svg.lucide-trash-2') !== null
    );
    fireEvent.click(deleteButtons[0]);

    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it('does not test a connection without id', async () => {
    const noIdConn = [{ name: 'No ID', type: 'sqlite' }];
    mockUseConnections.mockReturnValue({ data: noIdConn, isLoading: false });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Test/i }));
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('shows New Connection button in header', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /New Connection/i })
    ).toBeInTheDocument();
  });
});
