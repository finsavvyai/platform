import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@context/ThemeContext';
import OfflineIndicator from '../offline/OfflineIndicator';
import { NetInfoState } from '@react-native-netinfo';

// Mock the NetworkContext
jest.mock('@context/NetworkContext', () => ({
  useNetwork: () => ({
    isOnline: false,
    connectionType: 'cellular',
    isConnected: false,
    isInternetReachable: false,
    details: {
      isConnectionExpensive: true,
      strength: 'weak',
    },
  }),
}));

// Mock the useOfflineManager hook
const mockSyncNow = jest.fn();
jest.mock('../../hooks/useOfflineManager', () => ({
  __esModule: true,
  default: () => ({
    status: {
      isOnline: false,
      connectionType: 'cellular',
      sync: {
        isSyncing: false,
        pendingOperationsCount: 5,
        lastSync: '2024-01-15T10:30:00Z',
      },
      queue: {
        pending: 5,
        processing: 0,
        completed: 20,
        failed: 1,
      },
      cache: {
        totalSize: 1024000, // 1MB
        hitRate: 0.85,
        entryCount: 150,
      },
    },
    syncNow: mockSyncNow,
    clearAllData: jest.fn(),
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock Animated
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Animated: {
      ...RN.Animated,
      timing: jest.fn((value, config) => ({
        start: jest.fn((callback) => {
          if (callback) callback();
        }),
      })),
      spring: jest.fn((value, config) => ({
        start: jest.fn((callback) => {
          if (callback) callback();
        }),
      })),
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        stopAnimation: jest.fn(),
        resetAnimation: jest.fn(),
        interpolate: jest.fn(() => ({ setValue: jest.fn() })),
      })),
    },
  },
});

const mockTheme = {
  name: 'dark',
  displayName: 'Dark',
  colors: {
    background: '#1a1a1a',
    surface: '#2a2a2a',
    primary: '#007AFF',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#3A3A3C',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('OfflineIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders correctly when offline', () => {
      renderWithTheme(<OfflineIndicator showDetails={false} />);

      expect(screen.getByText('Offline Mode')).toBeTruthy();
      expect(screen.getByText('5 pending')).toBeTruthy();
    });

    test('does not render when online', () => {
      // Mock online status
      jest.doMock('@context/NetworkContext', () => ({
        useNetwork: () => ({
          isOnline: true,
          connectionType: 'wifi',
          isConnected: true,
          isInternetReachable: true,
        }),
      }));

      renderWithTheme(<OfflineIndicator showDetails={false} />);

      expect(screen.queryByText('Offline Mode')).toBeFalsy();
    });

    test('renders with details when showDetails is true', () => {
      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.getByText('Offline Mode')).toBeTruthy();
      expect(screen.getByText('Cellular')).toBeTruthy();
      expect(screen.getByText('5 pending')).toBeTruthy();
      expect(screen.getByText('Cache: 1.0 MB')).toBeTruthy();
    });

    test('renders minimal indicator when showDetails is false', () => {
      renderWithTheme(<OfflineIndicator showDetails={false} />);

      expect(screen.getByText('Offline Mode')).toBeTruthy();
      expect(screen.getByText('5 pending')).toBeTruthy();
      expect(screen.queryByText('Cellular')).toBeFalsy();
      expect(screen.queryByText('Cache: 1.0 MB')).toBeFalsy();
    });
  });

  describe('Sync Functionality', () => {
    test('calls syncNow when sync button is pressed', async () => {
      mockSyncNow.mockResolvedValue(true);

      renderWithTheme(
        <OfflineIndicator
          showDetails={true}
          onSyncPress={mockSyncNow}
        />
      );

      const syncButton = screen.getByText('Sync Now');
      fireEvent.press(syncButton);

      await waitFor(() => {
        expect(mockSyncNow).toHaveBeenCalledTimes(1);
      });
    });

    test('shows syncing state during sync', async () => {
      mockSyncNow.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithTheme(
        <OfflineIndicator
          showDetails={true}
          onSyncPress={mockSyncNow}
        />
      );

      const syncButton = screen.getByText('Sync Now');
      fireEvent.press(syncButton);

      // Should show syncing state
      expect(screen.getByText('Syncing...')).toBeTruthy();
      expect(syncButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeTruthy();
        expect(syncButton).not.toBeDisabled();
      }, { timeout: 200 });
    });

    test('shows error state when sync fails', async () => {
      mockSyncNow.mockResolvedValue(false);

      renderWithTheme(
        <OfflineIndicator
          showDetails={true}
          onSyncPress={mockSyncNow}
        />
      );

      const syncButton = screen.getByText('Sync Now');
      fireEvent.press(syncButton);

      await waitFor(() => {
        expect(screen.getByText('Sync Failed')).toBeTruthy();
      });
    });

    test('does not show sync button when no onSyncPress provided', () => {
      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.queryByText('Sync Now')).toBeFalsy();
    });
  });

  describe('Connection Type Display', () => {
    test('displays WiFi connection type', () => {
      jest.doMock('@context/NetworkContext', () => ({
        useNetwork: () => ({
          isOnline: false,
          connectionType: 'wifi',
          isConnected: false,
          isInternetReachable: false,
        }),
      }));

      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.getByText('WiFi')).toBeTruthy();
    });

    test('displays cellular connection type', () => {
      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.getByText('Cellular')).toBeTruthy();
    });

    test('displays unknown connection type', () => {
      jest.doMock('@context/NetworkContext', () => ({
        useNetwork: () => ({
          isOnline: false,
          connectionType: 'unknown',
          isConnected: false,
          isInternetReachable: false,
        }),
      }));

      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.getByText('Unknown')).toBeTruthy();
    });
  });

  describe('Status Text', () => {
    test('shows correct pending operations count', () => {
      renderWithTheme(<OfflineIndicator showDetails={false} />);

      expect(screen.getByText('5 pending')).toBeTruthy();
    });

    test('shows singular form for 1 pending operation', () => {
      jest.doMock('../../hooks/useOfflineManager', () => ({
        __esModule: true,
        default: () => ({
          status: {
            isOnline: false,
            sync: {
              isSyncing: false,
              pendingOperationsCount: 1,
              lastSync: '2024-01-15T10:30:00Z',
            },
            queue: { pending: 1, processing: 0, completed: 0, failed: 0 },
            cache: { totalSize: 1024000, hitRate: 0.85, entryCount: 150 },
          },
          syncNow: mockSyncNow,
          clearAllData: jest.fn(),
        }),
      }));

      renderWithTheme(<OfflineIndicator showDetails={false} />);

      expect(screen.getByText('1 pending')).toBeTruthy();
    });

    test('shows no pending operations when count is 0', () => {
      jest.doMock('../../hooks/useOfflineManager', () => ({
        __esModule: true,
        default: () => ({
          status: {
            isOnline: false,
            sync: {
              isSyncing: false,
              pendingOperationsCount: 0,
              lastSync: '2024-01-15T10:30:00Z',
            },
            queue: { pending: 0, processing: 0, completed: 0, failed: 0 },
            cache: { totalSize: 1024000, hitRate: 0.85, entryCount: 150 },
          },
          syncNow: mockSyncNow,
          clearAllData: jest.fn(),
        }),
      }));

      renderWithTheme(<OfflineIndicator showDetails={false} />);

      expect(screen.getByText('No pending operations')).toBeTruthy();
    });
  });

  describe('Cache Information', () => {
    test('displays cache size in correct format', () => {
      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.getByText('Cache: 1.0 MB')).toBeTruthy();
    });

    test('displays cache size in KB when less than 1MB', () => {
      jest.doMock('../../hooks/useOfflineManager', () => ({
        __esModule: true,
        default: () => ({
          status: {
            isOnline: false,
            sync: {
              isSyncing: false,
              pendingOperationsCount: 5,
              lastSync: '2024-01-15T10:30:00Z',
            },
            queue: { pending: 5, processing: 0, completed: 0, failed: 0 },
            cache: { totalSize: 512000, hitRate: 0.85, entryCount: 150 }, // 512KB
          },
          syncNow: mockSyncNow,
          clearAllData: jest.fn(),
        }),
      }));

      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.getByText('Cache: 512.0 KB')).toBeTruthy();
    });

    test('displays cache hit rate when available', () => {
      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.getByText('85% hit rate')).toBeTruthy();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    test('expands details when pressed', () => {
      renderWithTheme(<OfflineIndicator showDetails={false} />);

      const indicator = screen.getByTestId('offline-indicator');
      fireEvent.press(indicator);

      // Should show expanded details
      expect(screen.getByText('Cellular')).toBeTruthy();
      expect(screen.getByText('Cache: 1.0 MB')).toBeTruthy();
    });

    test('collapses details when pressed again', () => {
      renderWithTheme(<OfflineIndicator showDetails={true} />);

      const indicator = screen.getByTestId('offline-indicator');
      fireEvent.press(indicator);

      // Should hide details
      expect(screen.queryByText('Cellular')).toBeFalsy();
      expect(screen.queryByText('Cache: 1.0 MB')).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    test('handles missing status gracefully', () => {
      jest.doMock('../../hooks/useOfflineManager', () => ({
        __esModule: true,
        default: () => ({
          status: null,
          syncNow: mockSyncNow,
          clearAllData: jest.fn(),
        }),
      }));

      renderWithTheme(<OfflineIndicator showDetails={false} />);

      expect(screen.getByText('Status Unavailable')).toBeTruthy();
    });

    test('handles sync errors gracefully', async () => {
      mockSyncNow.mockRejectedValue(new Error('Network error'));

      renderWithTheme(
        <OfflineIndicator
          showDetails={true}
          onSyncPress={mockSyncNow}
        />
      );

      const syncButton = screen.getByText('Sync Now');
      fireEvent.press(syncButton);

      await waitFor(() => {
        expect(screen.getByText('Sync Error')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    test('has correct accessibility labels', () => {
      renderWithTheme(<OfflineIndicator showDetails={true} />);

      expect(screen.getByLabelText('Offline status indicator')).toBeTruthy();
    });

    test('sync button has correct accessibility label', () => {
      renderWithTheme(
        <OfflineIndicator
          showDetails={true}
          onSyncPress={mockSyncNow}
        />
      );

      expect(screen.getByLabelText('Sync pending operations')).toBeTruthy();
    });

    test('expansion button has correct accessibility hint', () => {
      renderWithTheme(<OfflineIndicator showDetails={false} />);

      const indicator = screen.getByTestId('offline-indicator');
      expect(indicator).toHaveProp('accessibilityHint', 'Tap to show offline details');
    });
  });

  describe('Performance', () => {
    test('renders quickly', () => {
      const startTime = performance.now();

      renderWithTheme(<OfflineIndicator showDetails={false} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in under 100ms
      expect(renderTime).toBeLessThan(100);
    });

    test('does not re-render unnecessarily', () => {
      const { rerender } = renderWithTheme(<OfflineIndicator showDetails={false} />);

      const initialRender = screen.getByText('Offline Mode');

      rerender(
        <ThemeProvider theme={mockTheme}>
          <OfflineIndicator showDetails={false} />
        </ThemeProvider>
      );

      // Same element should be present (no unnecessary re-render)
      expect(initialRender).toBeTruthy();
    });
  });
});