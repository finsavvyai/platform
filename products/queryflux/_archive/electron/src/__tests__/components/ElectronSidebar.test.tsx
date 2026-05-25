import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ElectronSidebar } from '../../renderer/components/ElectronSidebar';
import { useAppStore } from '../../renderer/stores';
import { useElectronDatabase } from '../../renderer/hooks/useElectronDatabase';

// Mock the hooks
jest.mock('../../renderer/stores');
jest.mock('../../renderer/hooks/useElectronDatabase');

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;
const mockUseElectronDatabase = useElectronDatabase as jest.MockedFunction<typeof useElectronDatabase>;

describe('ElectronSidebar', () => {
  const mockOnConnectionSelect = jest.fn();
  const mockOnNewConnection = jest.fn();
  const mockOnSettings = jest.fn();

  const mockConnections = [
    {
      id: 'conn-1',
      name: 'Production DB',
      type: 'postgresql',
      host: 'prod.example.com',
      database: 'production',
      lastUsed: Date.now() - 1000000,
    },
    {
      id: 'conn-2',
      name: 'Development DB',
      type: 'mysql',
      host: 'localhost',
      database: 'dev_db',
      lastUsed: Date.now() - 5000000,
    },
  ];

  const mockActiveConnections = [
    { id: 'active-1', connectionId: 'conn-1', status: 'connected' as const },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAppStore.mockReturnValue({
      theme: {
        colors: {
          background: '#1a1a1a',
          foreground: '#2a2a2a',
          text: '#ffffff',
          textSecondary: '#a0a0a0',
          border: '#404040',
          accent: '#6366f1',
        },
      },
      sidebarCollapsed: false,
      setSidebarCollapsed: jest.fn(),
      connections: mockConnections,
      activeConnections: mockActiveConnections,
      selectedConnectionId: 'conn-1',
    } as any);

    mockUseElectronDatabase.mockReturnValue({
      disconnect: jest.fn().mockResolvedValue({ success: true }),
      isElectron: true,
    } as any);
  });

  test('renders sidebar with connections', () => {
    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    expect(screen.getByText('Database Connections')).toBeInTheDocument();
    expect(screen.getByText('Production DB')).toBeInTheDocument();
    expect(screen.getByText('Development DB')).toBeInTheDocument();
    expect(screen.getByText('New Connection')).toBeInTheDocument();
  });

  test('shows connection status indicators', () => {
    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    // Check for connected status
    const productionDB = screen.getByText('Production DB');
    const statusIndicator = productionDB.parentElement?.querySelector('.status-indicator');
    expect(statusIndicator).toBeInTheDocument();
  });

  test('calls onConnectionSelect when connection is clicked', () => {
    render(
      <ElectronSidebar
        connectionId="conn-2"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    const connectionButton = screen.getByText('Production DB');
    fireEvent.click(connectionButton);

    expect(mockOnConnectionSelect).toHaveBeenCalledWith('conn-1');
  });

  test('calls onNewConnection when new connection button is clicked', () => {
    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    const newConnectionButton = screen.getByText('New Connection');
    fireEvent.click(newConnectionButton);

    expect(mockOnNewConnection).toHaveBeenCalled();
  });

  test('calls onSettings when settings button is clicked', () => {
    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);

    expect(mockOnSettings).toHaveBeenCalled();
  });

  test('displays empty state when no connections exist', () => {
    mockUseAppStore.mockReturnValue({
      ...mockUseAppStore(),
      connections: [],
      activeConnections: [],
    } as any);

    render(
      <ElectronSidebar
        connectionId={null}
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    expect(screen.getByText(/No database connections yet/)).toBeInTheDocument();
    expect(screen.getByText(/Create your first connection to get started/)).toBeInTheDocument();
  });

  test('highlights selected connection', () => {
    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    const productionDB = screen.getByText('Production DB');
    const connectionItem = productionDB.closest('.connection-item');
    expect(connectionItem).toHaveClass('selected');
  });

  test('shows connection type badges', () => {
    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('MySQL')).toBeInTheDocument();
  });

  test('can disconnect from active connection', async () => {
    const mockDisconnect = jest.fn().mockResolvedValue({ success: true });
    mockUseElectronDatabase.mockReturnValue({
      ...mockUseElectronDatabase(),
      disconnect: mockDisconnect,
    } as any);

    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    // Find disconnect button (usually appears on hover)
    const disconnectButton = screen.getByLabelText('Disconnect');
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith('conn-1');
    });
  });

  test('collapses and expands sidebar', () => {
    const mockSetSidebarCollapsed = jest.fn();
    mockUseAppStore.mockReturnValue({
      ...mockUseAppStore(),
      sidebarCollapsed: false,
      setSidebarCollapsed: mockSetSidebarCollapsed,
    } as any);

    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    const collapseButton = screen.getByLabelText('Toggle sidebar');
    fireEvent.click(collapseButton);

    expect(mockSetSidebarCollapsed).toHaveBeenCalledWith(true);
  });

  test('shows collapsed view when sidebarCollapsed is true', () => {
    mockUseAppStore.mockReturnValue({
      ...mockUseAppStore(),
      sidebarCollapsed: true,
    } as any);

    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    // In collapsed state, only icons should be visible
    expect(screen.queryByText('Production DB')).not.toBeInTheDocument();
    // But icons for connections should still be visible
    const connectionIcons = screen.getAllByTestId('connection-icon');
    expect(connectionIcons.length).toBeGreaterThan(0);
  });

  test('sorts connections by last used date', () => {
    const connectionsWithDifferentDates = [
      {
        id: 'conn-old',
        name: 'Old Connection',
        type: 'postgresql',
        lastUsed: Date.now() - 10000000, // Oldest
      },
      {
        id: 'conn-recent',
        name: 'Recent Connection',
        type: 'mysql',
        lastUsed: Date.now() - 1000, // Most recent
      },
      {
        id: 'conn-middle',
        name: 'Middle Connection',
        type: 'mongodb',
        lastUsed: Date.now() - 1000000, // Middle
      },
    ];

    mockUseAppStore.mockReturnValue({
      ...mockUseAppStore(),
      connections: connectionsWithDifferentDates,
    } as any);

    render(
      <ElectronSidebar
        connectionId="conn-recent"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    const connectionItems = screen.getAllByTestId('connection-item');
    expect(connectionItems[0]).toHaveTextContent('Recent Connection');
    expect(connectionItems[1]).toHaveTextContent('Middle Connection');
    expect(connectionItems[2]).toHaveTextContent('Old Connection');
  });

  test('displays connection host information', () => {
    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    expect(screen.getByText('prod.example.com')).toBeInTheDocument();
    expect(screen.getByText('localhost')).toBeInTheDocument();
  });

  test('shows error state for failed connections', () => {
    mockUseAppStore.mockReturnValue({
      ...mockUseAppStore(),
      activeConnections: [
        {
          id: 'active-error',
          connectionId: 'conn-2',
          status: 'error',
          error: 'Connection refused',
        },
      ],
    } as any);

    render(
      <ElectronSidebar
        connectionId="conn-2"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    expect(screen.getByText('Connection refused')).toBeInTheDocument();
  });

  test('filters connections by search term', async () => {
    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search connections...');
    fireEvent.change(searchInput, { target: { value: 'Production' } });

    await waitFor(() => {
      expect(screen.getByText('Production DB')).toBeInTheDocument();
      expect(screen.queryByText('Development DB')).not.toBeInTheDocument();
    });
  });

  test('shows connection groups or folders', () => {
    const groupedConnections = [
      {
        id: 'conn-1',
        name: 'Prod DB',
        group: 'Production',
        type: 'postgresql',
      },
      {
        id: 'conn-2',
        name: 'Staging DB',
        group: 'Production',
        type: 'postgresql',
      },
      {
        id: 'conn-3',
        name: 'Dev DB',
        group: 'Development',
        type: 'mysql',
      },
    ];

    mockUseAppStore.mockReturnValue({
      ...mockUseAppStore(),
      connections: groupedConnections,
    } as any);

    render(
      <ElectronSidebar
        connectionId="conn-1"
        onConnectionSelect={mockOnConnectionSelect}
        onNewConnection={mockOnNewConnection}
        onSettings={mockOnSettings}
      />
    );

    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
  });
});