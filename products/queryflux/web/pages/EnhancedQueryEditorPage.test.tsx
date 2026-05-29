import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EnhancedQueryEditorPage } from './EnhancedQueryEditorPage';

const mockMutate = vi.fn();
const mockSaveMutate = vi.fn();

const mockSchemas = [{
  name: 'public',
  tables: [
    { name: 'users', rowCount: 100, columns: [
      { name: 'id', type: 'int', nullable: false, isPrimaryKey: true },
      { name: 'email', type: 'varchar', nullable: false, isPrimaryKey: false },
    ]},
    { name: 'products', rowCount: 50, columns: [
      { name: 'name', type: 'varchar', nullable: true, isPrimaryKey: false },
    ]},
  ],
}];

const { mockUseConnectionStore, mockUseExecuteQuery } = vi.hoisted(() => ({
  mockUseConnectionStore: vi.fn(),
  mockUseExecuteQuery: vi.fn(),
}));

vi.mock('../stores/connectionStore', () => ({
  useConnectionStore: mockUseConnectionStore,
}));

vi.mock('../hooks/useSchema', () => ({
  useSchema: vi.fn(() => ({
    data: mockSchemas,
    isLoading: false,
    refetch: vi.fn(),
  })),
  schemaKeys: { byConnection: (id: string) => ['schema', id] },
}));

vi.mock('../hooks/useQueries', () => ({
  useExecuteQuery: mockUseExecuteQuery,
  useSaveQuery: vi.fn(() => ({ mutate: mockSaveMutate })),
}));

vi.mock('../hooks/useNlpQuery', () => ({
  useNlpQuery: vi.fn(() => ({
    mutate: vi.fn(),
    data: null,
    isPending: false,
    error: null,
  })),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EnhancedQueryEditorPage />
    </QueryClientProvider>
  );
}

describe('EnhancedQueryEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConnectionStore.mockImplementation(
      (selector: (s: Record<string, unknown>) => unknown) =>
        selector({ activeConnectionId: 'conn-1', connections: [] })
    );
    mockUseExecuteQuery.mockReturnValue({
      mutate: mockMutate,
      data: null,
      isPending: false,
      error: null,
    });
  });

  it('renders the query editor textarea', () => {
    renderPage();
    expect(screen.getByDisplayValue('SELECT * FROM users LIMIT 10;')).toBeInTheDocument();
  });

  it('shows schema sidebar by default', () => {
    renderPage();
    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
  });

  it('toggle button hides and shows schema sidebar', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    await user.click(screen.getByTitle('Hide schema'));
    expect(screen.queryByText('Schema Explorer')).not.toBeInTheDocument();
    await user.click(screen.getByTitle('Show schema'));
    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
  });

  it('calls executeQuery.mutate on Execute click', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Execute/i }));
    expect(mockMutate).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      sql: 'SELECT * FROM users LIMIT 10;',
    });
  });

  it('calls saveQuery.mutate on Save click', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(mockSaveMutate).toHaveBeenCalledWith({
      sql: 'SELECT * FROM users LIMIT 10;',
      connectionId: 'conn-1',
      name: 'Untitled',
    });
  });

  it('shows no-connection warning when activeConnectionId is null', () => {
    const noConn = (sel: (s: Record<string, unknown>) => unknown) => sel({ activeConnectionId: null, connections: [] });
    mockUseConnectionStore.mockImplementation(noConn);
    renderPage();
    expect(screen.getByText(/No connection selected/)).toBeInTheDocument();
  });

  it('does not execute when no connection is active', () => {
    const noConn = (sel: (s: Record<string, unknown>) => unknown) => sel({ activeConnectionId: null, connections: [] });
    mockUseConnectionStore.mockImplementation(noConn);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Execute/i }));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('does not save when no connection is active', () => {
    const noConn = (sel: (s: Record<string, unknown>) => unknown) => sel({ activeConnectionId: null, connections: [] });
    mockUseConnectionStore.mockImplementation(noConn);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(mockSaveMutate).not.toHaveBeenCalled();
  });

  it('dialect selector defaults to postgresql with no connection match', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: 'SQL dialect' });
    expect((select as HTMLSelectElement).value).toBe('postgresql');
  });

  it('dialect selector defaults to mysql for mysql connection type', () => {
    mockUseConnectionStore.mockImplementation(
      (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
          activeConnectionId: 'conn-mysql',
          connections: [{ id: 'conn-mysql', type: 'mysql', name: 'MySQL DB' }],
        })
    );
    renderPage();
    const select = screen.getByRole('combobox', { name: 'SQL dialect' });
    expect((select as HTMLSelectElement).value).toBe('mysql');
  });

  it('dialect selector defaults to mongodb for mongodb connection type', () => {
    mockUseConnectionStore.mockImplementation(
      (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
          activeConnectionId: 'conn-mongo',
          connections: [{ id: 'conn-mongo', type: 'mongodb', name: 'Mongo DB' }],
        })
    );
    renderPage();
    const select = screen.getByRole('combobox', { name: 'SQL dialect' });
    expect((select as HTMLSelectElement).value).toBe('mongodb');
  });

  it('transforms and displays query results', () => {
    mockUseExecuteQuery.mockReturnValue({
      mutate: mockMutate,
      data: {
        columns: ['id', 'email'],
        rows: [{ id: 1, email: 'a@b.com' }, { id: 2, email: 'c@d.com' }],
        rowCount: 2,
        executionTime: 15,
      },
      isPending: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText((_content, el) =>
      el?.tagName === 'SPAN' && el.textContent === '2 rows'
    )).toBeInTheDocument();
    expect(screen.getByText((_content, el) =>
      el?.tagName === 'SPAN' && el.textContent === 'in 15ms'
    )).toBeInTheDocument();
  });

  it('displays error message from executeQuery', () => {
    mockUseExecuteQuery.mockReturnValue({
      mutate: mockMutate,
      data: null,
      isPending: false,
      error: { message: 'Syntax error near SELECT' },
    });
    renderPage();
    expect(screen.getByText(/Syntax error near SELECT/)).toBeInTheDocument();
  });

  it('fires table click handler from schema tree', () => {
    renderPage();
    fireEvent.click(screen.getByText('public'));
    fireEvent.click(screen.getByText('users'));
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('fires column click handler from schema tree', () => {
    renderPage();
    fireEvent.click(screen.getByText('public'));
    fireEvent.click(screen.getByText('users'));
    fireEvent.click(screen.getByText('email'));
    expect(screen.getByText('email')).toBeInTheDocument();
  });
});
