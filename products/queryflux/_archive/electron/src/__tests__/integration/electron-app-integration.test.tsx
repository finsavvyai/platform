import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppElectron } from '../../renderer/App-Electron';

// Mock Electron APIs
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

const mockElectronAPI = {
  app: {
    version: jest.fn().mockResolvedValue('1.0.0'),
    quit: jest.fn(),
    minimize: jest.fn(),
    maximize: jest.fn(),
    toggleFullscreen: jest.fn(),
  },
  database: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    executeQuery: jest.fn(),
    getSchema: jest.fn(),
    getStoredConnections: jest.fn().mockResolvedValue({ success: true, data: [] }),
    getActiveConnections: jest.fn().mockResolvedValue({ success: true, data: [] }),
  },
  ai: {
    query: jest.fn(),
    explain: jest.fn(),
    optimize: jest.fn(),
  },
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  },
  updater: {
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    installUpdate: jest.fn(),
  },
  on: mockIpcRenderer.on,
  removeAllListeners: mockIpcRenderer.removeAllListeners,
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('Electron App Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders app with welcome screen', () => {
    render(<AppElectron />);

    expect(screen.getByText('QueryFlux')).toBeInTheDocument();
    expect(screen.getByText('Welcome to QueryFlux Desktop')).toBeInTheDocument();
    expect(screen.getByText('Connect to your databases and start querying with AI-powered assistance')).toBeInTheDocument();
    expect(screen.getByText('Create Your First Connection')).toBeInTheDocument();
    expect(screen.getByText('Try AI Assistant')).toBeInTheDocument();
  });

  test('shows electron-only notice when not in Electron', () => {
    Object.defineProperty(window, 'electronAPI', {
      value: undefined,
      writable: true,
    });

    render(<AppElectron />);

    expect(screen.getByText('Desktop Application Required')).toBeInTheDocument();
    expect(screen.getByText('This version of QueryFlux requires the desktop application for full functionality')).toBeInTheDocument();
    expect(screen.getByText('Desktop Features:')).toBeInTheDocument();
    expect(screen.getByText('Direct database connections')).toBeInTheDocument();
    expect(screen.getByText('Download QueryFlux Desktop')).toBeInTheDocument();
  });

  test('handles connection creation flow', async () => {
    mockElectronAPI.database.connect.mockResolvedValue({
      success: true,
      connectionId: 'conn-123',
    });
    mockElectronAPI.database.getStoredConnections.mockResolvedValue({
      success: true,
      data: [],
    });
    mockElectronAPI.database.getActiveConnections.mockResolvedValue({
      success: true,
      data: [{
        id: 'active-123',
        connectionId: 'conn-123',
        status: 'connected',
      }],
    });

    render(<AppElectron />);

    // Click create connection button
    const createButton = screen.getByText('Create Your First Connection');
    fireEvent.click(createButton);

    // Should open connection dialog
    await waitFor(() => {
      expect(screen.getByText('New Database Connection')).toBeInTheDocument();
    });

    // Select database type
    const postgresqlButton = screen.getByText('PostgreSQL');
    fireEvent.click(postgresqlButton);

    // Fill connection form
    await waitFor(() => {
      const nameInput = screen.getByLabelText('Connection Name');
      fireEvent.change(nameInput, { target: { value: 'Test Connection' } });

      const hostInput = screen.getByLabelText('Host');
      fireEvent.change(hostInput, { target: { value: 'localhost' } });

      const databaseInput = screen.getByLabelText('Database Name');
      fireEvent.change(databaseInput, { target: { value: 'testdb' } });

      const usernameInput = screen.getByLabelText('Username');
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
    });

    // Test connection
    const testButton = screen.getByText('Test Connection');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockElectronAPI.database.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postgresql',
          host: 'localhost',
          database: 'testdb',
          username: 'testuser',
          password: 'testpass',
        })
      );
    });

    // Connect
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);

    await waitFor(() => {
      // Should show query editor
      expect(screen.getByText('SQL Query Editor')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your SQL query here...')).toBeInTheDocument();
    });
  });

  test('handles query execution', async () => {
    // Setup connected state
    mockElectronAPI.database.getStoredConnections.mockResolvedValue({
      success: true,
      data: [{
        id: 'conn-123',
        name: 'Test DB',
        type: 'postgresql',
        host: 'localhost',
        lastUsed: Date.now(),
      }],
    });

    mockElectronAPI.database.getActiveConnections.mockResolvedValue({
      success: true,
      data: [{
        id: 'active-123',
        connectionId: 'conn-123',
        status: 'connected',
      }],
    });

    mockElectronAPI.database.executeQuery.mockResolvedValue({
      success: true,
      data: {
        columns: ['id', 'name', 'email'],
        rows: [
          [1, 'John Doe', 'john@example.com'],
          [2, 'Jane Smith', 'jane@example.com'],
        ],
        rowCount: 2,
      },
    });

    render(<AppElectron />);

    // Wait for query editor to appear
    await waitFor(() => {
      expect(screen.getByText('SQL Query Editor')).toBeInTheDocument();
    });

    // Enter query
    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, {
      target: { value: 'SELECT id, name, email FROM users LIMIT 10' },
    });

    // Execute query
    const executeButton = screen.getByText('Execute (Ctrl+Enter)');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockElectronAPI.database.executeQuery).toHaveBeenCalledWith({
        connectionId: 'conn-123',
        query: 'SELECT id, name, email FROM users LIMIT 10',
        params: [],
      });
    });

    // Verify results
    await waitFor(() => {
      expect(screen.getByText('Query Results')).toBeInTheDocument();
      expect(screen.getByText('2 rows')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });
  });

  test('handles AI assistant integration', async () => {
    mockElectronAPI.ai.query.mockResolvedValue({
      success: true,
      sql: 'SELECT * FROM users WHERE created_at > NOW() - INTERVAL \'7 days\'',
      explanation: 'This query retrieves users created in the last 7 days',
    });

    render(<AppElectron />);

    // Open AI Assistant
    const aiButton = screen.getByText('Try AI Assistant');
    fireEvent.click(aiButton);

    await waitFor(() => {
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Describe what you want to do in natural language/)).toBeInTheDocument();
    });

    // Enter natural language query
    const textarea = screen.getByPlaceholderText(/Describe what you want to do/);
    fireEvent.change(textarea, {
      target: { value: 'Show me users who signed up in the last week' },
    });

    // Convert to SQL
    const convertButton = screen.getByText('Convert to SQL');
    fireEvent.click(convertButton);

    await waitFor(() => {
      expect(mockElectronAPI.ai.query).toHaveBeenCalledWith(
        'Show me users who signed up in the last week'
      );
    });
  });

  test('handles window controls', () => {
    render(<AppElectron />);

    // Test minimize
    const minimizeButton = screen.getByLabelText('Minimize');
    fireEvent.click(minimizeButton);
    expect(mockElectronAPI.app.minimize).toHaveBeenCalled();

    // Test maximize
    const maximizeButton = screen.getByLabelText('Maximize');
    fireEvent.click(maximizeButton);
    expect(mockElectronAPI.app.maximize).toHaveBeenCalled();

    // Test close
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(mockElectronAPI.app.quit).toHaveBeenCalled();
  });

  test('handles settings modal', async () => {
    render(<AppElectron />);

    // Find and click settings (might need to access through menu)
    // For now, let's check if settings can be opened
    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Dark')).toBeInTheDocument();
    });

    // Change theme
    const themeSelect = screen.getByDisplayValue('Dark');
    fireEvent.change(themeSelect, { target: { value: 'light' } });

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  test('handles connection errors gracefully', async () => {
    mockElectronAPI.database.connect.mockResolvedValue({
      success: false,
      error: 'Connection refused: ECONNREFUSED',
    });

    render(<AppElectron />);

    // Attempt to create connection
    const createButton = screen.getByText('Create Your First Connection');
    fireEvent.click(createButton);

    await waitFor(() => {
      const postgresqlButton = screen.getByText('PostgreSQL');
      fireEvent.click(postgresqlButton);
    });

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Connection Name');
      fireEvent.change(nameInput, { target: { value: 'Test Connection' } });
    });

    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText(/Connection refused: ECONNREFUSED/)).toBeInTheDocument();
    });
  });

  test('handles keyboard shortcuts', async () => {
    mockElectronAPI.database.executeQuery.mockResolvedValue({
      success: true,
      data: { columns: [], rows: [], rowCount: 0 },
    });

    render(<AppElectron />);

    // Wait for query editor
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your SQL query here...')).toBeInTheDocument();
    });

    // Enter query
    const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
    fireEvent.change(queryInput, { target: { value: 'SELECT 1' } });

    // Test Ctrl+Enter shortcut
    fireEvent.keyDown(queryInput, {
      key: 'Enter',
      ctrlKey: true,
    });

    await waitFor(() => {
      expect(mockElectronAPI.database.executeQuery).toHaveBeenCalled();
    });
  });

  test('persists and retrieves connections', async () => {
    const existingConnections = [{
      id: 'conn-123',
      name: 'Existing DB',
      type: 'postgresql',
      host: 'existing.db.com',
      lastUsed: Date.now() - 1000000,
    }];

    mockElectronAPI.database.getStoredConnections.mockResolvedValue({
      success: true,
      data: existingConnections,
    });

    mockElectronAPI.database.getActiveConnections.mockResolvedValue({
      success: true,
      data: [{
        id: 'active-123',
        connectionId: 'conn-123',
        status: 'connected',
      }],
    });

    render(<AppElectron />);

    await waitFor(() => {
      expect(screen.getByText('Existing DB')).toBeInTheDocument();
      expect(screen.getByText('SQL Query Editor')).toBeInTheDocument();
    });
  });

  test('exports query results', async () => {
    mockElectronAPI.database.executeQuery.mockResolvedValue({
      success: true,
      data: {
        columns: ['id', 'name'],
        rows: [[1, 'Test'], [2, 'Another']],
        rowCount: 2,
      },
    });

    // Mock file download
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    const mockAnchor = {
      href: '',
      download: '',
      click: jest.fn(),
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);

    render(<AppElectron />);

    // Execute query
    await waitFor(() => {
      const queryInput = screen.getByPlaceholderText('Enter your SQL query here...');
      fireEvent.change(queryInput, { target: { value: 'SELECT * FROM test' } });

      const executeButton = screen.getByText('Execute (Ctrl+Enter)');
      fireEvent.click(executeButton);
    });

    // Export results
    await waitFor(() => {
      const exportButton = screen.getByText('Export CSV');
      fireEvent.click(exportButton);

      expect(mockAnchor.download).toMatch(/query_results_\d{4}-\d{2}-\d{2}\.csv/);
      expect(mockAnchor.click).toHaveBeenCalled();
    });
  });

  test('handles real-time events', async () => {
    render(<AppElectron />);

    // Simulate database connected event
    const mockEventHandler = mockIpcRenderer.on.mock.calls.find(
      ([channel]) => channel === 'database:connected'
    )?.[1];

    if (mockEventHandler) {
      mockEventHandler({}, {
        connectionId: 'conn-123',
        databaseName: 'testdb',
      });

      await waitFor(() => {
        // Should show connection notification
        expect(screen.getByText(/Database Connected/)).toBeInTheDocument();
      });
    }

    // Simulate query completed event
    const queryEventHandler = mockIpcRenderer.on.mock.calls.find(
      ([channel]) => channel === 'query:completed'
    )?.[1];

    if (queryEventHandler) {
      queryEventHandler({}, {
        connectionId: 'conn-123',
        query: 'SELECT 1',
        duration: 45,
        rowsAffected: 1,
      });

      // Should update query history
      await waitFor(() => {
        // Query should be added to history
        expect(screen.queryByText('SELECT 1')).toBeInTheDocument();
      });
    }
  });

  test('handles app update notifications', async () => {
    mockElectronAPI.updater.checkForUpdates.mockResolvedValue({
      available: true,
      version: '1.1.0',
      releaseNotes: 'Bug fixes and performance improvements',
    });

    render(<AppElectron />);

    // Update check happens on app initialization
    await waitFor(() => {
      expect(mockElectronAPI.app.version).toHaveBeenCalled();
      expect(mockElectronAPI.updater.checkForUpdates).toHaveBeenCalled();
    });

    // Simulate update available event
    const updateEventHandler = mockIpcRenderer.on.mock.calls.find(
      ([channel]) => channel === 'update:available'
    )?.[1];

    if (updateEventHandler) {
      updateEventHandler({}, {
        version: '1.1.0',
        releaseNotes: 'Bug fixes and performance improvements',
        mandatory: false,
      });

      await waitFor(() => {
        expect(screen.getByText(/Update Available/)).toBeInTheDocument();
        expect(screen.getByText(/Version 1.1.0 is now available/)).toBeInTheDocument();
      });
    }
  });
});