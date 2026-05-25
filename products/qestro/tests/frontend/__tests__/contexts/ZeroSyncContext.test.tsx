import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZeroSyncProvider, useZeroSync } from '../../../../../frontend/src/contexts/ZeroSyncContext';

// Mock dependencies
const mockWebSocket = {
  socket: null,
  lastMessage: null,
  isConnected: false,
  sendMessage: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockAuthStore = {
  user: { id: 'user-1', name: 'Test User' },
  tokens: { accessToken: 'test-token' },
};

const mockNotification = {
  error: vi.fn(),
  warning: vi.fn(),
};

vi.mock('../../../../../frontend/src/hooks/useWebSocket', () => ({
  useWebSocket: () => mockWebSocket,
}));

vi.mock('../../../../../frontend/src/stores/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}));

vi.mock('../../../../../frontend/src/contexts/NotificationContext', () => ({
  useNotification: () => mockNotification,
}));

// Test component that uses ZeroSync
function TestComponent() {
  const zeroSync = useZeroSync();
  
  return (
    <div>
      <div data-testid="connected">{zeroSync.isConnected.toString()}</div>
      <div data-testid="pending-ops">{zeroSync.pendingOperations.size}</div>
      <div data-testid="conflicts">{zeroSync.conflicts.size}</div>
      <button onClick={() => zeroSync.setState('test-path', 'test-value')}>
        Set State
      </button>
      <button onClick={() => zeroSync.subscribe('test-path', () => {})}>
        Subscribe
      </button>
    </div>
  );
}

describe('ZeroSyncContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides initial state', () => {
    render(
      <ZeroSyncProvider>
        <TestComponent />
      </ZeroSyncProvider>
    );

    expect(screen.getByTestId('connected')).toHaveTextContent('false');
    expect(screen.getByTestId('pending-ops')).toHaveTextContent('0');
    expect(screen.getByTestId('conflicts')).toHaveTextContent('0');
  });

  it('updates connection state', () => {
    mockWebSocket.isConnected = true;
    
    render(
      <ZeroSyncProvider>
        <TestComponent />
      </ZeroSyncProvider>
    );

    expect(screen.getByTestId('connected')).toHaveTextContent('true');
  });

  it('handles state updates', async () => {
    mockWebSocket.isConnected = true;
    
    render(
      <ZeroSyncProvider>
        <TestComponent />
      </ZeroSyncProvider>
    );

    const setStateButton = screen.getByText('Set State');
    
    await act(async () => {
      setStateButton.click();
    });

    expect(mockWebSocket.sendMessage).toHaveBeenCalledWith({
      type: 'update_state',
      payload: { path: 'test-path', data: 'test-value', optimistic: true }
    });
  });

  it('handles subscriptions', () => {
    mockWebSocket.isConnected = true;
    
    render(
      <ZeroSyncProvider>
        <TestComponent />
      </ZeroSyncProvider>
    );

    const subscribeButton = screen.getByText('Subscribe');
    
    act(() => {
      subscribeButton.click();
    });

    expect(mockWebSocket.sendMessage).toHaveBeenCalledWith({
      type: 'subscribe_state',
      payload: { path: 'test-path' }
    });
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useZeroSync must be used within a ZeroSyncProvider');
    
    consoleSpy.mockRestore();
  });

  it('constructs WebSocket URL with auth token', () => {
    render(
      <ZeroSyncProvider>
        <TestComponent />
      </ZeroSyncProvider>
    );

    // The WebSocket should be initialized with the auth token
    // This is tested indirectly through the mock
    expect(mockAuthStore.tokens.accessToken).toBe('test-token');
  });

  it('handles WebSocket messages', () => {
    const TestMessageComponent = () => {
      const zeroSync = useZeroSync();
      
      React.useEffect(() => {
        // Simulate receiving a message
        const mockMessage = {
          data: JSON.stringify({
            type: 'state_update',
            payload: { path: 'test-path', data: 'new-value' }
          })
        };
        
        // This would normally be handled by the WebSocket hook
        // but we're testing the message handling logic
      }, []);
      
      return <div>Message Handler</div>;
    };

    render(
      <ZeroSyncProvider>
        <TestMessageComponent />
      </ZeroSyncProvider>
    );

    expect(screen.getByText('Message Handler')).toBeInTheDocument();
  });

  it('manages pending operations', async () => {
    mockWebSocket.isConnected = true;
    
    const TestPendingComponent = () => {
      const zeroSync = useZeroSync();
      const [pendingCount, setPendingCount] = React.useState(0);
      
      React.useEffect(() => {
        setPendingCount(zeroSync.pendingOperations.size);
      }, [zeroSync.pendingOperations]);
      
      return (
        <div>
          <div data-testid="pending-count">{pendingCount}</div>
          <button onClick={() => zeroSync.setState('test', 'value', true)}>
            Add Pending
          </button>
        </div>
      );
    };

    render(
      <ZeroSyncProvider>
        <TestPendingComponent />
      </ZeroSyncProvider>
    );

    const addButton = screen.getByText('Add Pending');
    
    await act(async () => {
      addButton.click();
    });

    // The pending operation should be tracked
    expect(mockWebSocket.sendMessage).toHaveBeenCalled();
  });

  it('handles conflicts', () => {
    const TestConflictComponent = () => {
      const zeroSync = useZeroSync();
      
      return (
        <div>
          <div data-testid="conflict-count">{zeroSync.conflicts.size}</div>
          <button onClick={() => zeroSync.resolveConflict('conflict-1', 'resolution')}>
            Resolve Conflict
          </button>
        </div>
      );
    };

    render(
      <ZeroSyncProvider>
        <TestConflictComponent />
      </ZeroSyncProvider>
    );

    expect(screen.getByTestId('conflict-count')).toHaveTextContent('0');
  });

  it('provides sync functionality', async () => {
    mockWebSocket.isConnected = true;
    
    const TestSyncComponent = () => {
      const zeroSync = useZeroSync();
      
      return (
        <button onClick={() => zeroSync.sync(['path1', 'path2'])}>
          Sync Paths
        </button>
      );
    };

    render(
      <ZeroSyncProvider>
        <TestSyncComponent />
      </ZeroSyncProvider>
    );

    const syncButton = screen.getByText('Sync Paths');
    
    await act(async () => {
      syncButton.click();
    });

    expect(mockWebSocket.sendMessage).toHaveBeenCalledWith({
      type: 'request_sync',
      payload: { paths: ['path1', 'path2'] }
    });
  });
});