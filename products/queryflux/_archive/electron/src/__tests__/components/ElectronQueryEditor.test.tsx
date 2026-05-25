import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ElectronQueryEditor } from '../../renderer/components/ElectronQueryEditor';
import { useElectronDatabase } from '../../renderer/hooks/useElectronDatabase';
import { useElectronStorage } from '../../renderer/hooks/useElectronStorage';

// Mock the hooks
jest.mock('../../renderer/hooks/useElectronDatabase');
jest.mock('../../renderer/hooks/useElectronStorage');

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    database: {
      executeQuery: jest.fn(),
    },
  },
  writable: true,
});

const mockUseElectronDatabase = useElectronDatabase as jest.MockedFunction<typeof useElectronDatabase>;
const mockUseElectronStorage = useElectronStorage as jest.MockedFunction<typeof useElectronStorage>;

describe('ElectronQueryEditor', () => {
  const mockOnSaveQuery = jest.fn();
  const mockExecuteQuery = jest.fn();
  const mockUseStoredState = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseElectronDatabase.mockReturnValue({
      executeQuery: mockExecuteQuery,
      isElectron: true,
      isLoading: false,
      error: null,
      clearError: jest.fn(),
    } as any);

    mockUseElectronStorage.mockReturnValue({
      useStoredState: mockUseStoredState,
    } as any);

    mockUseStoredState.mockReturnValue([[], jest.fn()]);

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  test('renders query editor when connectionId is provided', () => {
    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    expect(screen.getByText('SQL Query Editor')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your SQL query here...')).toBeInTheDocument();
    expect(screen.getByText('Execute (Ctrl+Enter)')).toBeInTheDocument();
  });

  test('shows electron-only notice when not in Electron', () => {
    mockUseElectronDatabase.mockReturnValue({
      ...mockUseElectronDatabase(),
      isElectron: false,
    } as any);

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    expect(screen.getByText(/Electron Only Feature/)).toBeInTheDocument();
    expect(screen.getByText(/Query execution is only available in the QueryFlux desktop application/)).toBeInTheDocument();
  });

  test('executes query successfully', async () => {
    const mockResult = {
      success: true,
      data: {
        columns: ['id', 'name', 'email'],
        rows: [
          [1, 'John Doe', 'john@example.com'],
          [2, 'Jane Smith', 'jane@example.com'],
        ],
        rowCount: 2,
      },
      executionTime: 150,
    };

    mockExecuteQuery.mockResolvedValue(mockResult);

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT * FROM users LIMIT 10' },
    });

    const executeButton = screen.getByText('Execute (Ctrl+Enter)');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockExecuteQuery).toHaveBeenCalledWith('conn-123', 'SELECT * FROM users LIMIT 10');
    });

    await waitFor(() => {
      expect(screen.getByText('Query Results')).toBeInTheDocument();
      expect(screen.getByText('2 rows')).toBeInTheDocument();
      expect(screen.getByText('150ms')).toBeInTheDocument();
    });

    // Verify table headers
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();

    // Verify table data
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  test('handles query execution error', async () => {
    const errorMessage = 'Table "users" does not exist';
    mockExecuteQuery.mockRejectedValue(new Error(errorMessage));

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT * FROM users' },
    });

    const executeButton = screen.getByText('Execute (Ctrl+Enter)');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('shows loading state while executing query', async () => {
    mockExecuteQuery.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT * FROM users' },
    });

    const executeButton = screen.getByText('Execute (Ctrl+Enter)');
    fireEvent.click(executeButton);

    expect(screen.getByText('Executing...')).toBeInTheDocument();
    expect(executeButton).toBeDisabled();
  });

  test('prevents execution with empty query', () => {
    // Mock window.alert
    window.alert = jest.fn();

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const executeButton = screen.getByText('Execute (Ctrl+Enter)');
    fireEvent.click(executeButton);

    expect(window.alert).toHaveBeenCalledWith('Please enter a query to execute');
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  test('saves query dialog appears when save button is clicked', async () => {
    const savedQueries = [
      { name: 'Test Query 1', query: 'SELECT 1', timestamp: Date.now() },
    ];
    mockUseStoredState.mockReturnValue([savedQueries, jest.fn()]);

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT COUNT(*) FROM users' },
    });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Save Query')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Query name...')).toBeInTheDocument();
    });
  });

  test('saves query with name', async () => {
    const mockSetSavedQueries = jest.fn();
    mockUseStoredState.mockReturnValue([[], mockSetSavedQueries]);

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT COUNT(*) FROM users' },
    });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    const nameInput = screen.getByPlaceholderText('Query name...');
    fireEvent.change(nameInput, { target: { value: 'User Count Query' } });

    const confirmSaveButton = screen.getByText('Save');
    fireEvent.click(confirmSaveButton);

    await waitFor(() => {
      expect(mockOnSaveQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM users',
        'User Count Query'
      );
      expect(mockSetSavedQueries).toHaveBeenCalled();
    });
  });

  test('loads saved query from history', async () => {
    const savedQueries = [
      { name: 'Old Query', query: 'SELECT * FROM old_table', timestamp: Date.now() },
    ];
    mockUseStoredState.mockReturnValue([savedQueries, jest.fn()]);

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    // Check if saved queries are displayed
    expect(screen.getByText('Saved Queries')).toBeInTheDocument();
    expect(screen.getByText('Old Query')).toBeInTheDocument();

    const savedQueryButton = screen.getByText('Old Query');
    fireEvent.click(savedQueryButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('SELECT * FROM old_table')).toBeInTheDocument();
    });
  });

  test('exports results to CSV', async () => {
    const mockResult = {
      success: true,
      data: {
        columns: ['id', 'name'],
        rows: [[1, 'Test']],
        rowCount: 1,
      },
    };

    mockExecuteQuery.mockResolvedValue(mockResult);

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();

    // Mock createElement and click
    const mockAnchor = {
      href: '',
      download: '',
      click: jest.fn(),
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    // Execute query to get results
    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT * FROM test' },
    });

    const executeButton = screen.getByText('Execute (Ctrl+Enter)');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    const exportCSVButton = screen.getByText('Export CSV');
    fireEvent.click(exportCSVButton);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockAnchor.download).toMatch(/query_results_\d{4}-\d{2}-\d{2}\.csv/);
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  test('displays query type detection', async () => {
    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');

    // Test SELECT query
    fireEvent.change(queryInput, { target: { value: 'SELECT * FROM users' } });
    expect(screen.getByText('SELECT')).toBeInTheDocument();

    // Test INSERT query
    fireEvent.change(queryInput, { target: { value: 'INSERT INTO users VALUES (1, "test")' } });
    expect(screen.getByText('INSERT')).toBeInTheDocument();

    // Test UPDATE query
    fireEvent.change(queryInput, { target: { value: 'UPDATE users SET name = "test"' } });
    expect(screen.getByText('UPDATE')).toBeInTheDocument();
  });

  test('shows character count', () => {
    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT COUNT(*) FROM users WHERE id > 10' },
    });

    expect(screen.getByText('48 characters')).toBeInTheDocument();
  });

  test('auto-saves query to localStorage', () => {
    jest.useFakeTimers();

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT * FROM users' },
    });

    // Fast-forward 1 second
    jest.advanceTimersByTime(1000);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'current-query',
      'SELECT * FROM users'
    );

    jest.useRealTimers();
  });

  test('loads saved query from localStorage on mount', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('SELECT * FROM cached_query');

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    expect(screen.getByDisplayValue('SELECT * FROM cached_query')).toBeInTheDocument();
  });

  test('handles Ctrl+Enter keyboard shortcut', async () => {
    mockExecuteQuery.mockResolvedValue({
      success: true,
      data: { columns: [], rows: [], rowCount: 0 },
    });

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT 1' },
    });

    // Simulate Ctrl+Enter
    fireEvent.keyDown(queryInput, {
      key: 'Enter',
      ctrlKey: true,
    });

    await waitFor(() => {
      expect(mockExecuteQuery).toHaveBeenCalledWith('conn-123', 'SELECT 1');
    });
  });

  test('limits displayed rows to 1000', async () => {
    const largeResult = {
      success: true,
      data: {
        columns: ['id'],
        rows: Array.from({ length: 1500 }, (_, i) => [i]),
        rowCount: 1500,
      },
    };

    mockExecuteQuery.mockResolvedValue(largeResult);

    render(
      <ElectronQueryEditor
        connectionId="conn-123"
        onSaveQuery={mockOnSaveQuery}
      />
    );

    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, { target: { value: 'SELECT * FROM large_table' } });

    const executeButton = screen.getByText('Execute (Ctrl+Enter)');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByText(/Showing first 1,000 rows of 1500 total rows/)).toBeInTheDocument();
    });
  });
});