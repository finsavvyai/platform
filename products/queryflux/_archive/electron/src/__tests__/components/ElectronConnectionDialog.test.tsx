import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ElectronConnectionDialog } from '../../renderer/components/ElectronConnectionDialog';
import { useElectronDatabase } from '../../renderer/hooks/useElectronDatabase';
import { useElectronStorage } from '../../renderer/hooks/useElectronStorage';
import { useAppStore } from '../../renderer/stores';

// Mock the hooks
jest.mock('../../renderer/hooks/useElectronDatabase');
jest.mock('../../renderer/hooks/useElectronStorage');
jest.mock('../../renderer/stores');

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    database: {
      testConnection: jest.fn(),
      connect: jest.fn(),
    },
  },
  writable: true,
});

const mockUseElectronDatabase = useElectronDatabase as jest.MockedFunction<typeof useElectronDatabase>;
const mockUseElectronStorage = useElectronStorage as jest.MockedFunction<typeof useElectronStorage>;
const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

describe('ElectronConnectionDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConnect = jest.fn();
  const mockTestConnection = jest.fn();
  const mockConnect = jest.fn();
  const mockStoreData = jest.fn();
  const mockRetrieveData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseElectronDatabase.mockReturnValue({
      testConnection: mockTestConnection,
      connect: mockConnect,
      isElectron: true,
      isLoading: false,
      error: null,
      clearError: jest.fn(),
    } as any);

    mockUseElectronStorage.mockReturnValue({
      store: mockStoreData,
      retrieve: mockRetrieveData,
    } as any);

    mockUseAppStore.mockReturnValue({
      theme: {
        colors: {
          background: '#1a1a1a',
          foreground: '#2a2a2a',
          text: '#ffffff',
          textSecondary: '#a0a0a0',
          border: '#404040',
        },
      },
    } as any);
  });

  test('renders dialog when isOpen is true', () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getByText('New Database Connection')).toBeInTheDocument();
    expect(screen.getByText('Choose your database type to get started')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    render(
      <ElectronConnectionDialog
        isOpen={false}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    expect(screen.queryByText('New Database Connection')).not.toBeInTheDocument();
  });

  test('displays database type selector', () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('MySQL')).toBeInTheDocument();
    expect(screen.getByText('MongoDB')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
  });

  test('selecting database type shows connection form', async () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('localhost')).toBeInTheDocument();
      expect(screen.getByDisplayValue('5432')).toBeInTheDocument();
    });
  });

  test('fills form fields and submits connection', async () => {
    mockRetrieveData.mockResolvedValue([]);
    mockTestConnection.mockResolvedValue({ success: true, testTime: 100 });
    mockConnect.mockResolvedValue({ success: true, connectionId: 'conn-123' });

    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Select PostgreSQL
    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Connection Name')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText('Connection Name');
    const hostInput = screen.getByLabelText('Host');
    const databaseInput = screen.getByLabelText('Database Name');
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');

    fireEvent.change(nameInput, { target: { value: 'Test Connection' } });
    fireEvent.change(hostInput, { target: { value: 'test.db.com' } });
    fireEvent.change(databaseInput, { target: { value: 'testdb' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'testpass' } });

    // Test connection
    const testButton = screen.getByText('Test Connection');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalledWith({
        type: 'postgresql',
        host: 'test.db.com',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        ssl: false,
        connectionString: undefined,
      });
    });

    // Connect
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
      expect(mockStoreData).toHaveBeenCalled();
      expect(mockOnConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Connection',
          type: 'postgresql',
        })
      );
    });
  });

  test('shows error when connection test fails', async () => {
    mockTestConnection.mockResolvedValue({
      success: false,
      error: 'Connection refused',
    });

    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Select PostgreSQL
    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Connection Name')).toBeInTheDocument();
    });

    // Fill minimal required fields
    const nameInput = screen.getByLabelText('Connection Name');
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    // Test connection
    const testButton = screen.getByText('Test Connection');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
    });
  });

  test('closes dialog when close button is clicked', () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('switches between manual, URL, and Docker input modes', async () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Select PostgreSQL
    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    await waitFor(() => {
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    // Switch to URL mode
    const urlButton = screen.getByText('URL');
    fireEvent.click(urlButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/postgresql:\/\//)).toBeInTheDocument();
    });

    // Switch back to Manual
    const manualButton = screen.getByText('Manual');
    fireEvent.click(manualButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Host')).toBeInTheDocument();
    });
  });

  test('handles connection URL parsing', async () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Select PostgreSQL
    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    await waitFor(() => {
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    // Switch to URL mode
    const urlButton = screen.getByText('URL');
    fireEvent.click(urlButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/postgresql:\/\//)).toBeInTheDocument();
    });

    // Enter connection URL
    const urlInput = screen.getByPlaceholderText(/postgresql:\/\//);
    fireEvent.change(urlInput, {
      target: {
        value: 'postgresql://user:pass@myhost:5555/mydb?ssl=true',
      },
    });

    // Switch back to manual to verify parsed values
    const manualButton = screen.getByText('Manual');
    fireEvent.click(manualButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('myhost')).toBeInTheDocument();
      expect(screen.getByDisplayValue('5555')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mydb')).toBeInTheDocument();
      expect(screen.getByDisplayValue('user')).toBeInTheDocument();
      expect(screen.getByDisplayValue('pass')).toBeInTheDocument();
    });
  });

  test('shows electron-only notice when not in Electron', () => {
    mockUseElectronDatabase.mockReturnValue({
      ...mockUseElectronDatabase(),
      isElectron: false,
    } as any);

    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getByText(/This feature is only available in the Electron app/)).toBeInTheDocument();
  });

  test('validates required fields before submission', async () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Select PostgreSQL
    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Connection Name')).toBeInTheDocument();
    });

    // Try to connect without filling required fields
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText(/Please fill in all required fields/)).toBeInTheDocument();
    });

    expect(mockConnect).not.toHaveBeenCalled();
  });

  test('handles SQLite database file selection', async () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Select SQLite
    const sqliteButton = screen.getByText('SQLite');
    fireEvent.click(sqliteButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Database File')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('/path/to/database.db')).toBeInTheDocument();
    });
  });

  test('toggles SSL option', async () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Select PostgreSQL
    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    await waitFor(() => {
      expect(screen.getByText('Use SSL/TLS')).toBeInTheDocument();
    });

    const sslCheckbox = screen.getByLabelText('Use SSL/TLS');
    fireEvent.click(sslCheckbox);

    // Verify SSL is enabled (would be reflected in form data)
    expect(sslCheckbox).toBeChecked();
  });

  test('switches between basic and advanced settings', async () => {
    render(
      <ElectronConnectionDialog
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Select PostgreSQL
    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    await waitFor(() => {
      expect(screen.getByText('Basic Settings')).toBeInTheDocument();
    });

    // Switch to Advanced
    const advancedButton = screen.getByText('Advanced Options');
    fireEvent.click(advancedButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/postgresql:\/\//)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/{"ssl": true}/)).toBeInTheDocument();
    });
  });
});