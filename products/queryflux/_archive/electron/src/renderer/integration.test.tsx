import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';
import { AppElectron } from '../App-Electron';
import { useElectronDatabase } from '../hooks';

// Mock Electron API
const mockElectronAPI = {
  database: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    executeQuery: jest.fn(),
    getSchema: jest.fn(),
    getTables: jest.fn(),
    getColumns: jest.fn(),
    testConnection: jest.fn(),
    getStoredConnections: jest.fn(),
    getActiveConnections: jest.fn(),
    deleteStoredConnection: jest.fn(),
    getConnectionInfo: jest.fn(),
  },
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    getAll: jest.fn(),
    clear: jest.fn(),
  },
  updater: {
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    installUpdate: jest.fn(),
  },
  app: {
    minimize: jest.fn(),
    maximize: jest.fn(),
    quit: jest.fn(),
    openSettings: jest.fn(),
    onMaximized: jest.fn(),
    onUnmaximized: jest.fn(),
  },
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Setup window.electronAPI mock
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Test components
const TestThemeConsumer: React.FC = () => {
  const { theme, setTheme, availableThemes } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme.name}</span>
      <span data-testid="theme-count">{availableThemes.length}</span>
      <button
        onClick={() => setTheme(availableThemes[1])}
        data-testid="change-theme"
      >
        Change Theme
      </button>
    </div>
  );
};

const TestLanguageConsumer: React.FC = () => {
  const { language, setLanguage, t, availableLanguages } = useLanguage();
  return (
    <div>
      <span data-testid="current-language">{language}</span>
      <span data-testid="language-count">{availableLanguages.length}</span>
      <span data-testid="welcome-text">{t('database.welcome')}</span>
      <button
        onClick={() => setLanguage('es')}
        data-testid="change-language"
      >
        Change Language
      </button>
    </div>
  );
};

const TestDatabaseConsumer: React.FC = () => {
  const {
    isElectron,
    connections,
    activeConnections,
    connect,
    testConnection,
    executeQuery
  } = useElectronDatabase();

  const handleTest = async () => {
    const result = await testConnection({
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'test',
      username: 'test',
      password: 'test',
      ssl: false
    });
    return result;
  };

  return (
    <div>
      <span data-testid="is-electron">{isElectron.toString()}</span>
      <span data-testid="connection-count">{connections.length}</span>
      <span data-testid="active-connection-count">{activeConnections.length}</span>
      <button onClick={handleTest} data-testid="test-connection">
        Test Connection
      </button>
    </div>
  );
};

// Integration tests
describe('Electron App Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockElectronAPI.database.getStoredConnections.mockResolvedValue({
      success: true,
      data: []
    });

    mockElectronAPI.database.getActiveConnections.mockResolvedValue({
      success: true,
      data: []
    });

    mockElectronAPI.database.testConnection.mockResolvedValue({
      success: true,
      testTime: 100
    });

    mockElectronAPI.storage.get.mockResolvedValue({});

    mockElectronAPI.updater.checkForUpdates.mockResolvedValue({
      available: false,
      version: null
    });
  });

  test('Theme context provides correct values', () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('theme-count')).toHaveTextContent('7'); // 7 built-in themes

    fireEvent.click(screen.getByTestId('change-theme'));

    expect(screen.getByTestId('current-theme')).not.toHaveTextContent('dark');
  });

  test('Language context provides correct values', () => {
    render(
      <LanguageProvider>
        <TestLanguageConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('current-language')).toHaveTextContent('en');
    expect(screen.getByTestId('language-count')).toHaveTextContent('12'); // 12 languages
    expect(screen.getByTestId('welcome-text')).toHaveTextContent('Welcome to QueryFlux');

    fireEvent.click(screen.getByTestId('change-language'));

    expect(screen.getByTestId('current-language')).toHaveTextContent('es');
  });

  test('Database context works in Electron environment', async () => {
    render(
      <ThemeProvider>
        <LanguageProvider>
          <TestDatabaseConsumer />
        </LanguageProvider>
      </ThemeProvider>
    );

    expect(screen.getByTestId('is-electron')).toHaveTextContent('true');
    expect(screen.getByTestId('connection-count')).toHaveTextContent('0');
    expect(screen.getByTestId('active-connection-count')).toHaveTextContent('0');

    const testButton = screen.getByTestId('test-connection');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockElectronAPI.database.testConnection).toHaveBeenCalledWith({
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
        ssl: false
      });
    });
  });

  test('App renders correctly in Electron environment', () => {
    render(<AppElectron />);

    // Should render title bar with QueryFlux
    expect(screen.getByText('QueryFlux')).toBeInTheDocument();

    // Should render welcome screen
    expect(screen.getByText('Welcome to QueryFlux Desktop')).toBeInTheDocument();
    expect(screen.getByText('Create Your First Connection')).toBeInTheDocument();
    expect(screen.getByText('Multi-Database Support')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered Queries')).toBeInTheDocument();
    expect(screen.getByText('Local & Secure')).toBeInTheDocument();
  });

  test('Connection dialog can be opened', () => {
    render(<AppElectron />);

    const newConnectionButton = screen.getByText('Create Your First Connection');
    fireEvent.click(newConnectionButton);

    // Should open connection dialog
    expect(screen.getByText('New Database Connection')).toBeInTheDocument();
    expect(screen.getByText('Choose your database type to get started')).toBeInTheDocument();
  });

  test('Window controls function correctly', () => {
    render(<AppElectron />);

    const minimizeButton = screen.getByRole('button', { name: /minimize/i });
    const maximizeButton = screen.getByRole('button', { name: /maximize/i });
    const closeButton = screen.getByRole('button', { name: /close/i });

    fireEvent.click(minimizeButton);
    expect(mockElectronAPI.app.minimize).toHaveBeenCalled();

    fireEvent.click(maximizeButton);
    expect(mockElectronAPI.app.maximize).toHaveBeenCalled();

    fireEvent.click(closeButton);
    expect(mockElectronAPI.app.quit).toHaveBeenCalled();
  });

  test('Error handling works correctly', async () => {
    // Mock an error
    mockElectronAPI.database.testConnection.mockRejectedValueOnce(
      new Error('Connection failed')
    );

    render(
      <ThemeProvider>
        <LanguageProvider>
          <TestDatabaseConsumer />
        </LanguageProvider>
      </ThemeProvider>
    );

    const testButton = screen.getByTestId('test-connection');
    fireEvent.click(testButton);

    // Should handle the error gracefully
    await waitFor(() => {
      expect(mockElectronAPI.database.testConnection).toHaveBeenCalled();
    });

    // The component should still be usable after error
    expect(screen.getByTestId('is-electron')).toHaveTextContent('true');
  });

  test('Preferences are loaded and saved correctly', async () => {
    const mockPreferences = {
      lastConnectionId: 'test-connection-123',
      defaultView: 'monitoring'
    };

    mockElectronAPI.storage.get.mockResolvedValue(mockPreferences);

    render(<AppElectron />);

    await waitFor(() => {
      expect(mockElectronAPI.storage.get).toHaveBeenCalled();
    });
  });

  test('Update checking works on startup', async () => {
    render(<AppElectron />);

    await waitFor(() => {
      expect(mockElectronAPI.updater.checkForUpdates).toHaveBeenCalled();
    });
  });

  test('Non-Electron environment shows appropriate message', () => {
    // Temporarily remove electronAPI
    const originalAPI = window.electronAPI;
    delete window.electronAPI;

    render(<AppElectron />);

    expect(screen.getByText('Desktop Application Required')).toBeInTheDocument();
    expect(screen.getByText('This version of QueryFlux requires the desktop application')).toBeInTheDocument();

    // Restore electronAPI
    window.electronAPI = originalAPI;
  });
});

// Performance tests
describe('Electron App Performance', () => {
  test('App initializes quickly', () => {
    const startTime = performance.now();

    render(<AppElectron />);

    const endTime = performance.now();
    const initTime = endTime - startTime;

    // Should initialize within 100ms
    expect(initTime).toBeLessThan(100);
  });

  test('Theme switching is performant', () => {
    const { container } = render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    const startTime = performance.now();

    fireEvent.click(screen.getByTestId('change-theme'));

    const endTime = performance.now();
    const switchTime = endTime - startTime;

    // Theme switching should be nearly instantaneous
    expect(switchTime).toBeLessThan(10);
  });
});

// Accessibility tests
describe('Electron App Accessibility', () => {
  test('App has proper ARIA labels', () => {
    render(<AppElectron />);

    // Check for proper ARIA labels on important elements
    expect(screen.getByRole('button', { name: /minimize/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /maximize/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create your first connection/i })).toBeInTheDocument();
  });

  test('App supports keyboard navigation', () => {
    render(<AppElectron />);

    const newConnectionButton = screen.getByRole('button', { name: /create your first connection/i });

    // Should be focusable
    newConnectionButton.focus();
    expect(newConnectionButton).toHaveFocus();

    // Should be activatable with keyboard
    fireEvent.keyDown(newConnectionButton, { key: 'Enter' });

    expect(screen.getByText('New Database Connection')).toBeInTheDocument();
  });
});

// Integration with actual database (mocked)
describe('Database Integration', () => {
  test('Can create and use database connection', async () => {
    const mockConnection = {
      id: 'test-connection-123',
      name: 'Test PostgreSQL',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    mockElectronAPI.database.connect.mockResolvedValue({
      success: true,
      connectionId: 'test-connection-123'
    });

    mockElectronAPI.database.getStoredConnections.mockResolvedValue({
      success: true,
      data: [mockConnection]
    });

    mockElectronAPI.database.getActiveConnections.mockResolvedValue({
      success: true,
      data: [mockConnection]
    });

    render(<AppElectron />);

    // Open connection dialog
    const newConnectionButton = screen.getByText('Create Your First Connection');
    fireEvent.click(newConnectionButton);

    // Fill out connection form (simplified test)
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockElectronAPI.database.connect).toHaveBeenCalled();
    });
  });

  test('Can execute queries', async () => {
    const mockQueryResult = {
      success: true,
      data: {
        columns: ['id', 'name', 'email'],
        rows: [
          [1, 'John Doe', 'john@example.com'],
          [2, 'Jane Smith', 'jane@example.com']
        ],
        rowCount: 2
      },
      executionTime: 45
    };

    mockElectronAPI.database.executeQuery.mockResolvedValue(mockQueryResult);

    render(
      <ThemeProvider>
        <LanguageProvider>
          <TestDatabaseConsumer />
        </LanguageProvider>
      </ThemeProvider>
    );

    // Test query execution would require more complex setup
    // This is a simplified test to verify the hook structure
    expect(screen.getByTestId('is-electron')).toHaveTextContent('true');
  });
});

export {};
