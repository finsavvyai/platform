/**
 * Zero-Sync Integration Tests
 * Comprehensive integration tests for the Zero-Sync real-time synchronization system
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Import Zero-Sync components and hooks
import { ZeroSyncProvider } from '../../../frontend/src/contexts/ZeroSyncContext';
import { ZeroSyncIndicator } from '../../../frontend/src/components/molecules/ZeroSyncIndicator/ZeroSyncIndicator';
import { ZeroSyncDemo } from '../../../frontend/src/components/organisms/ZeroSyncDemo/ZeroSyncDemo';
import { useZeroSyncState, useZeroSyncCollection } from '../../../frontend/src/hooks/useZeroSyncState';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private eventListeners: { [key: string]: Function[] } = {};
  private messageQueue: string[] = [];

  constructor(url: string) {
    this.url = url;
    this.messageQueue = [];

    // Simulate connection after delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
      this.flushMessageQueue();
    }, 50);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      this.messageQueue.push(data);
      return;
    }

    // Simulate echo back
    setTimeout(() => {
      if (this.onmessage) {
        try {
          const message = JSON.parse(data);
          this.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
        } catch {
          this.onmessage(new MessageEvent('message', { data }));
        }
      }
    }, 10);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING;

    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
      }
    }, 5);
  }

  flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.readyState === MockWebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  // Helper for testing
  simulateServerMessage(data: any): void {
    if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateConnectionError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
    this.close(1006, 'Connection error');
  }
}

// Replace global WebSocket
const OriginalWebSocket = global.WebSocket;

describe('Zero-Sync Integration Tests', () => {
  const testUrl = 'ws://localhost:8080/zerosync';

  beforeEach(() => {
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = OriginalWebSocket;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('ZeroSync Context Integration', () => {
    it('provides Zero-Sync context to children', () => {
      const TestComponent = () => {
        const { isConnected } = useZeroSync();
        return <div data-testid="connection-status">{isConnected ? 'connected' : 'disconnected'}</div>;
      };

      render(
        <ZeroSyncProvider>
          <TestComponent />
        </ZeroSyncProvider>
      );

      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected');
    });

    it('connects to WebSocket when provider mounts', async () => {
      const TestComponent = () => {
        const { isConnected } = useZeroSync();
        return <div data-testid="status">{isConnected ? 'connected' : 'disconnected'}</div>;
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Initially disconnected
      expect(screen.getByTestId('status')).toHaveTextContent('disconnected');

      // Should connect after delay
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('connected');
      });
    });

    it('handles connection reconnection', async () => {
      const TestComponent = () => {
        const { isConnected, isReconnecting } = useZeroSync();
        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="reconnecting">{isReconnecting ? 'yes' : 'no'}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Initial connection
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
        expect(screen.getByTestId('reconnecting')).toHaveTextContent('no');
      });

      // Simulate disconnection
      const wsInstance = MockWebSocket.prototype as any;
      wsInstance.close();

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('no');
        // Should start reconnecting
      });
    });

    it('tracks pending operations', async () => {
      const TestComponent = () => {
        const { pendingOperations } = useZeroSync();
        return (
          <div data-testid="pending-count">
            {pendingOperations.size}
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
    });

    it('handles state conflicts', async () => {
      const TestComponent = () => {
        const { conflicts } = useZeroSync();
        return (
          <div data-testid="conflict-count">
            {conflicts.size}
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      expect(screen.getByTestId('conflict-count')).toHaveTextContent('0');
    });
  });

  describe('ZeroSync State Hook Integration', () => {
    it('synchronizes state between components', async () => {
      const TestComponent = () => {
        const [state, setState] = useZeroSyncState<string>('test-state', {
          initialValue: 'initial'
        });

        return (
          <div>
            <div data-testid="state">{state}</div>
            <button
              data-testid="update-button"
              onClick={() => setState('updated')}
            >
              Update
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      expect(screen.getByTestId('state')).toHaveTextContent('initial');

      const updateButton = screen.getByTestId('update-button');
      await userEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByTestId('state')).toHaveTextContent('updated');
      });
    });

    it('handles optimistic updates', async () => {
      const TestComponent = () => {
        const [state, setState] = useZeroSyncState<string>('optimistic-test', {
          initialValue: 'initial',
          optimistic: true
        });

        return (
          <div>
            <div data-testid="state">{state}</div>
            <button
              data-testid="optimistic-button"
              onClick={() => setState('optimistic')}
            >
              Optimistic Update
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      const optimisticButton = screen.getByTestId('optimistic-button');
      await userEvent.click(optimisticButton);

      // Should update immediately (optimistic)
      expect(screen.getByTestId('state')).toHaveTextContent('optimistic');
    });

    it('handles collection operations', async () => {
      interface TestItem {
        id: string;
        name: string;
      }

      const TestComponent = () => {
        const { items, add, remove, isLoading } = useZeroSyncCollection<TestItem>('test-collection');

        const handleAdd = async () => {
          await add({
            id: 'item-1',
            name: 'Test Item'
          });
        };

        const handleRemove = async () => {
          await remove('item-1');
        };

        return (
          <div>
            <div data-testid="items-count">{items.length}</div>
            <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
            <button data-testid="add-button" onClick={handleAdd}>
              Add Item
            </button>
            <button data-testid="remove-button" onClick={handleRemove}>
              Remove Item
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      expect(screen.getByTestId('items-count')).toHaveTextContent('0');

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('items-count')).toHaveTextContent('1');
      });

      const removeButton = screen.getByTestId('remove-button');
      await userEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByTestId('items-count')).toHaveTextContent('0');
      });
    });

    it('handles state subscription updates from server', async () => {
      const TestComponent = () => {
        const [state] = useZeroSyncState<string>('server-state', {
          initialValue: 'server-initial'
        });

        return <div data-testid="server-state">{state}</div>;
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      expect(screen.getByTestId('server-state')).toHaveTextContent('server-initial');

      // Simulate server update
      act(() => {
        vi.advanceTimersByTime(50); // Allow connection
      });

      // Get WebSocket instance and simulate server message
      const wsInstance = MockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      ws.simulateServerMessage({
        type: 'STATE_UPDATE',
        payload: {
          path: 'server-state',
          data: 'server-updated'
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('server-state')).toHaveTextContent('server-updated');
      });
    });
  });

  describe('ZeroSync Indicator Integration', () => {
    it('displays connection status correctly', async () => {
      render(
        <ZeroSyncProvider url={testUrl}>
          <ZeroSyncIndicator />
        </ZeroSyncProvider>
      );

      // Should show disconnected initially
      expect(screen.getByText('Disconnected')).toBeInTheDocument();

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(screen.getByText('Synced')).toBeInTheDocument();
      });
    });

    it('shows loading state during reconnection', async () => {
      render(
        <ZeroSyncProvider url={testUrl}>
          <ZeroSyncIndicator />
        </ZeroSyncProvider>
      );

      // Connect first
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(screen.getByText('Synced')).toBeInTheDocument();
      });

      // Disconnect and wait for reconnection
      const wsInstance = MockWebSocket.prototype as any;
      wsInstance.close();

      await waitFor(() => {
        expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
      });
    });

    it('displays pending operations count', async () => {
      const TestComponent = () => {
        const { add } = useZeroSyncCollection<{ id: string; text: string }>('test-items');

        return (
          <div>
            <ZeroSyncIndicator showDetails={true} />
            <button data-testid="add-item" onClick={() => add({ id: '1', text: 'Test' })}>
              Add Item
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Synced')).toBeInTheDocument();
      });

      const addButton = screen.getByTestId('add-item');
      await userEvent.click(addButton);

      // Should show pending operations
      await waitFor(() => {
        expect(screen.getByText('1 Pending')).toBeInTheDocument();
      });
    });

    it('displays conflicts when they occur', async () => {
      render(
        <ZeroSyncProvider url={testUrl}>
          <ZeroSyncIndicator showDetails={true} />
        </ZeroSyncProvider>
      );

      // Simulate conflict
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Get WebSocket instance and simulate conflict
      const wsInstance = MockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      ws.simulateServerMessage({
        type: 'CONFLICT_DETECTED',
        payload: {
          id: 'conflict-1',
          path: 'test-path',
          localData: { value: 'local' },
          remoteData: { value: 'remote' }
        }
      });

      await waitFor(() => {
        expect(screen.getByText('1 Conflicts')).toBeInTheDocument();
      });
    });

    it('shows error state on connection failure', async () => {
      render(
        <ZeroSyncProvider url={testUrl}>
          <ZeroSyncIndicator />
        </ZeroSyncProvider>
      );

      // Simulate connection error
      act(() => {
        vi.advanceTimersByTime(50);
      });

      const wsInstance = MockWebSocket.prototype as any;
      wsInstance.simulateConnectionError();

      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeInTheDocument();
      });
    });
  });

  describe('ZeroSync Demo Integration', () => {
    it('allows adding and removing todos with synchronization', async () => {
      render(
        <ZeroSyncProvider url={testUrl}>
          <ZeroSyncDemo />
        </ZeroSyncProvider>
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Should have add todo input
      const todoInput = screen.getByPlaceholderText('Add a new todo...');
      const addButton = screen.getByText('Add Todo');

      // Add a todo
      await userEvent.type(todoInput, 'Test todo item');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Test todo item')).toBeInTheDocument();
      });

      // Should be able to toggle todo
      const todoCheckbox = screen.getByRole('checkbox');
      await userEvent.click(todoCheckbox);

      await waitFor(() => {
        const todoElement = screen.getByText('Test todo item');
        expect(todoElement).toHaveClass('line-through');
      });

      // Should be able to delete todo
      const deleteButton = screen.getByLabelText('Delete todo');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText('Test todo item')).not.toBeInTheDocument();
      });
    });

    it('synchronizes counter across multiple components', async () => {
      const CounterComponent = ({ id }: { id: string }) => {
        const [counter, setCounter] = useZeroSyncState<number>('demo-counter', {
          initialValue: 0
        });

        return (
          <div data-testid={`counter-${id}`}>
            <span data-testid={`value-${id}`}>{counter}</span>
            <button
              data-testid={`increment-${id}`}
              onClick={() => setCounter(counter + 1)}
            >
              Increment
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <CounterComponent id="1" />
          <CounterComponent id="2" />
        </ZeroSyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('value-1')).toHaveTextContent('0');
        expect(screen.getByTestId('value-2')).toHaveTextContent('0');
      });

      // Increment from first component
      const incrementButton1 = screen.getByTestId('increment-1');
      await userEvent.click(incrementButton1);

      await waitFor(() => {
        expect(screen.getByTestId('value-1')).toHaveTextContent('1');
        expect(screen.getByTestId('value-2')).toHaveTextContent('1');
      });
    });

    it('handles optimistic updates in todo list', async () => {
      render(
        <ZeroSyncProvider url={testUrl}>
          <ZeroSyncDemo />
        </ZeroSyncProvider>
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50);
      });

      const todoInput = screen.getByPlaceholderText('Add a new todo...');
      const addButton = screen.getByText('Add Todo');

      // Add todo should be immediate (optimistic)
      await userEvent.type(todoInput, 'Optimistic todo');
      await userEvent.click(addButton);

      // Should appear immediately
      expect(screen.getByText('Optimistic todo')).toBeInTheDocument();
    });

    it('handles editing todos with synchronization', async () => {
      render(
        <ZeroSyncProvider url={testUrl}>
          <ZeroSyncDemo />
        </ZeroSyncProvider>
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50);
      });

      const todoInput = screen.getByPlaceholderText('Add a new todo...');
      const addButton = screen.getByText('Add Todo');

      // Add a todo first
      await userEvent.type(todoInput, 'Editable todo');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Editable todo')).toBeInTheDocument();
      });

      // Edit the todo
      const editButton = screen.getByLabelText('Edit todo');
      await userEvent.click(editButton);

      const editInput = screen.getByDisplayValue('Editable todo');
      await userEvent.clear(editInput);
      await userEvent.type(editInput, 'Edited todo');

      const saveButton = screen.getByText('Save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Edited todo')).toBeInTheDocument();
        expect(screen.queryByText('Editable todo')).not.toBeInTheDocument();
      });
    });
  });

  describe('Real-time Synchronization Scenarios', () => {
    it('handles multiple simultaneous state updates', async () => {
      const TestComponent = () => {
        const [value1, setValue1] = useZeroSyncState<string>('state-1', { initialValue: 'initial1' });
        const [value2, setValue2] = useZeroSyncState<string>('state-2', { initialValue: 'initial2' });
        const [value3, setValue3] = useZeroSyncState<string>('state-3', { initialValue: 'initial3' });

        return (
          <div>
            <div data-testid="value-1">{value1}</div>
            <div data-testid="value-2">{value2}</div>
            <div data-testid="value-3">{value3}</div>
            <button
              data-testid="update-all"
              onClick={() => {
                setValue1('updated1');
                setValue2('updated2');
                setValue3('updated3');
              }}
            >
              Update All
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      const updateButton = screen.getByTestId('update-all');
      await userEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByTestId('value-1')).toHaveTextContent('updated1');
        expect(screen.getByTestId('value-2')).toHaveTextContent('updated2');
        expect(screen.getByTestId('value-3')).toHaveTextContent('updated3');
      });
    });

    it('handles WebSocket disconnection and reconnection', async () => {
      const TestComponent = () => {
        const { isConnected, isReconnecting } = useZeroSync();
        const [state, setState] = useZeroSyncState<string>('resilient-state', {
          initialValue: 'initial'
        });

        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="reconnecting">{isReconnecting ? 'yes' : 'no'}</div>
            <div data-testid="state">{state}</div>
            <button
              data-testid="update-state"
              onClick={() => setState('updated')}
            >
              Update State
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Initial connection
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
      });

      // Update state while connected
      const updateButton = screen.getByTestId('update-state');
      await userEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByTestId('state')).toHaveTextContent('updated');
      });

      // Disconnect
      const wsInstance = MockWebSocket.prototype as any;
      wsInstance.close();

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('no');
      });

      // Try to update while disconnected
      await userEvent.click(updateButton);

      // Should handle gracefully (might queue updates)
      expect(screen.getByTestId('state')).toBeInTheDocument();
    });

    it('handles conflict resolution scenarios', async () => {
      const TestComponent = () => {
        const { conflicts } = useZeroSync();
        const [state, setState] = useZeroSyncState<string>('conflict-state', {
          initialValue: 'local-value',
          onConflict: (local, remote) => remote // Choose remote value
        });

        return (
          <div>
            <div data-testid="conflict-count">{conflicts.size}</div>
            <div data-testid="state">{state}</div>
            <button
              data-testid="update-state"
              onClick={() => setState('new-local-value')}
            >
              Update State
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Simulate conflict
      act(() => {
        vi.advanceTimersByTime(50);
      });

      const wsInstance = MockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      ws.simulateServerMessage({
        type: 'CONFLICT_DETECTED',
        payload: {
          id: 'conflict-1',
          path: 'conflict-state',
          localData: 'new-local-value',
          remoteData: 'remote-value'
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('conflict-count')).toHaveTextContent('1');
        // Should resolve to remote value based on onConflict handler
        expect(screen.getByTestId('state')).toHaveTextContent('remote-value');
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('handles large state updates efficiently', async () => {
      const TestComponent = () => {
        const { items, add } = useZeroSyncCollection<{ id: string; data: string }>('large-collection');

        const handleAddMany = async () => {
          for (let i = 0; i < 100; i++) {
            await add({
              id: `item-${i}`,
              data: `Data for item ${i}`
            });
          }
        };

        return (
          <div>
            <div data-testid="items-count">{items.length}</div>
            <button data-testid="add-many" onClick={handleAddMany}>
              Add Many Items
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      const addManyButton = screen.getByTestId('add-many');
      await userEvent.click(addManyButton);

      await waitFor(() => {
        expect(screen.getByTestId('items-count')).toHaveTextContent('100');
      }, { timeout: 10000 }); // Longer timeout for large operations
    });

    it('maintains performance with rapid updates', async () => {
      const TestComponent = () => {
        const [value, setValue] = useZeroSyncState<number>('rapid-updates', {
          initialValue: 0
        });

        const handleRapidUpdates = async () => {
          for (let i = 0; i < 50; i++) {
            await setValue(i);
          }
        };

        return (
          <div>
            <div data-testid="value">{value}</div>
            <button data-testid="rapid-updates" onClick={handleRapidUpdates}>
              Rapid Updates
            </button>
          </div>
        );
      };

      const startTime = performance.now();
      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(100); // Should render quickly

      const rapidButton = screen.getByTestId('rapid-updates');
      const updateStartTime = performance.now();
      await userEvent.click(rapidButton);

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('49');
      }, { timeout: 5000 });

      const updateTime = performance.now() - updateStartTime;
      expect(updateTime).toBeLessThan(2000); // Should handle rapid updates efficiently
    });

    it('properly cleans up resources on unmount', () => {
      const TestComponent = () => {
        const { items, add } = useZeroSyncCollection<{ id: string }>('cleanup-test');

        React.useEffect(() => {
          const interval = setInterval(() => {
            add({ id: `item-${Date.now()}` });
          }, 100);

          return () => clearInterval(interval);
        }, [add]);

        return (
          <div data-testid="items-count">{items.length}</div>
        );
      };

      const { unmount } = render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Let it run for a bit
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(() => unmount()).not.toThrow();

      // Should not have any memory leaks or hanging timers
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles WebSocket connection failures gracefully', async () => {
      // Mock WebSocket to always fail
      vi.mock('../../../frontend/src/hooks/useWebSocket', () => ({
        useWebSocket: () => ({
          socket: null,
          lastMessage: null,
          readyState: WebSocket.CLOSED,
          isConnected: false,
          reconnectCount: 0,
          sendMessage: vi.fn(),
          sendJsonMessage: vi.fn(),
          getWebSocket: vi.fn(),
          connect: vi.fn(),
          disconnect: vi.fn(),
        }),
      }));

      const TestComponent = () => {
        const { isConnected, error } = useZeroSync();
        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url="invalid-url">
          <TestComponent />
        </ZeroSyncProvider>
      );

      expect(screen.getByTestId('connected')).toHaveTextContent('no');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });

    it('handles malformed server messages', async () => {
      const TestComponent = () => {
        const { isConnected } = useZeroSync();
        return <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>;
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(50);
      });

      const wsInstance = MockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      // Send malformed JSON
      expect(() => {
        ws.simulateServerMessage('invalid-json');
      }).not.toThrow();

      // Send null message
      expect(() => {
        ws.simulateServerMessage(null);
      }).not.toThrow();

      // Send undefined message
      expect(() => {
        ws.simulateServerMessage(undefined);
      }).not.toThrow();
    });

    it('handles concurrent ZeroSync providers', () => {
      const TestComponent = ({ providerId }: { providerId: string }) => {
        const [state, setState] = useZeroSyncState<string>(`state-${providerId}`, {
          initialValue: `initial-${providerId}`
        });

        return (
          <div data-testid={`state-${providerId}`}>
            <span data-testid={`value-${providerId}`}>{state}</span>
            <button
              data-testid={`update-${providerId}`}
              onClick={() => setState(`updated-${providerId}`)}
            >
              Update
            </button>
          </div>
        );
      };

      render(
        <>
          <ZeroSyncProvider url={`${testUrl}-1` key="provider-1">
            <TestComponent providerId="1" />
          </ZeroSyncProvider>
          <ZeroSyncProvider url={`${testUrl}-2`} key="provider-2">
            <TestComponent providerId="2" />
          </ZeroSyncProvider>
        </>
      );

      // Both providers should work independently
      expect(screen.getByTestId('value-1')).toHaveTextContent('initial-1');
      expect(screen.getByTestId('value-2')).toHaveTextContent('initial-2');

      const updateButton1 = screen.getByTestId('update-1');
      const updateButton2 = screen.getByTestId('update-2');

      await userEvent.click(updateButton1);
      await userEvent.click(updateButton2);

      await waitFor(() => {
        expect(screen.getByTestId('value-1')).toHaveTextContent('updated-1');
        expect(screen.getByTestId('value-2')).toHaveTextContent('updated-2');
      });
    });
  });
});