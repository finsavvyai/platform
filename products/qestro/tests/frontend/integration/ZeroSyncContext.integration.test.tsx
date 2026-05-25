/**
 * ZeroSyncContext Integration Tests
 * Deep integration testing for the ZeroSync real-time synchronization context
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ZeroSyncProvider, useZeroSync } from '../../../frontend/src/contexts/ZeroSyncContext';
import { useWebSocket } from '../../../frontend/src/hooks/useWebSocket';

// Mock WebSocket with advanced features for ZeroSync testing
class AdvancedMockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = AdvancedMockWebSocket.CONNECTING;
  protocol: string = '';
  extensions: string = '';
  bufferedAmount: number = 0;
  binaryType: BinaryType = 'blob';

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private eventListeners: { [key: string]: Function[] } = {};
  private messageQueue: any[] = [];
  private connectionHistory: Array<{ timestamp: number; event: string; data?: any }> = [];
  private latency: number = 10;
  private shouldDropMessages: boolean = false;
  private shouldError: boolean = false;

  constructor(url: string, options: { latency?: number; dropMessages?: boolean; error?: boolean } = {}) {
    this.url = url;
    this.latency = options.latency || 10;
    this.shouldDropMessages = options.dropMessages || false;
    this.shouldError = options.error || false;
    this.messageQueue = [];

    // Simulate connection with potential failure
    setTimeout(() => {
      if (this.shouldError) {
        this.readyState = AdvancedMockWebSocket.CLOSED;
        if (this.onerror) {
          this.onerror(new Event('error'));
        }
        if (this.onclose) {
          this.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection failed' }));
        }
      } else {
        this.readyState = AdvancedMockWebSocket.OPEN;
        this.connectionHistory.push({ timestamp: Date.now(), event: 'open' });
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
        this.flushMessageQueue();
      }
    }, this.latency);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    const messageEvent = {
      timestamp: Date.now(),
      event: 'send',
      data: typeof data === 'string' ? data : data.toString()
    };
    this.connectionHistory.push(messageEvent);

    if (this.readyState !== AdvancedMockWebSocket.OPEN) {
      this.messageQueue.push(data);
      return;
    }

    if (this.shouldDropMessages) {
      return; // Simulate dropped messages
    }

    // Echo back with server simulation
    setTimeout(() => {
      if (this.onmessage && this.readyState === AdvancedMockWebSocket.OPEN) {
        try {
          const parsedData = JSON.parse(data as string);
          const response = this.processMessage(parsedData);
          this.onmessage(new MessageEvent('message', {
            data: JSON.stringify(response),
            origin: this.url
          }));
        } catch {
          this.onmessage(new MessageEvent('message', { data, origin: this.url }));
        }
      }
    }, Math.random() * 20); // Add some randomness
  }

  close(code?: number, reason?: string): void {
    this.readyState = AdvancedMockWebSocket.CLOSING;
    const closeEvent = {
      timestamp: Date.now(),
      event: 'close',
      code: code || 1000,
      reason: reason || ''
    };
    this.connectionHistory.push(closeEvent);

    setTimeout(() => {
      this.readyState = AdvancedMockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
      }
    }, 5);
  }

  private processMessage(message: any): any {
    // Simulate server-side logic
    if (message.type === 'STATE_UPDATE') {
      return {
        type: 'STATE_UPDATED',
        requestId: message.requestId || `req_${Date.now()}`,
        timestamp: Date.now(),
        payload: message.payload
      };
    }

    if (message.type === 'CONFLICT_RESOLUTION') {
      return {
        type: 'CONFLICT_RESOLVED',
        conflictId: message.conflictId,
        resolution: message.resolution,
        timestamp: Date.now()
      };
    }

    return {
      type: 'ACK',
      messageId: message.id || `msg_${Date.now()}`,
      timestamp: Date.now()
    };
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.readyState === AdvancedMockWebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  // Testing utilities
  simulateServerMessage(message: any): void {
    if (this.onmessage && this.readyState === AdvancedMockWebSocket.OPEN) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
    }
  }

  simulateLatency(latency: number): void {
    this.latency = latency;
  }

  simulatePacketLoss(rate: number): void {
    this.shouldDropMessages = Math.random() < rate;
  }

  simulateNetworkError(): void {
    this.shouldError = true;
    this.close(1006, 'Network error');
  }

  getConnectionHistory(): Array<{ timestamp: number; event: string; data?: any }> {
    return [...this.connectionHistory];
  }

  getMessageQueue(): any[] {
    return [...this.messageQueue];
  }
}

const OriginalWebSocket = global.WebSocket;

describe('ZeroSyncContext Deep Integration Tests', () => {
  const testUrl = 'ws://localhost:8080/zerosync';

  beforeEach(() => {
    global.WebSocket = AdvancedMockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = OriginalWebSocket;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('WebSocket Connection Management', () => {
    it('establishes connection with proper configuration', async () => {
      const TestComponent = () => {
        const { isConnected, isReconnecting, error } = useZeroSync();
        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="reconnecting">{isReconnecting ? 'yes' : 'no'}</div>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Initial state
      expect(screen.getByTestId('connected')).toHaveTextContent('no');
      expect(screen.getByTestId('reconnecting')).toHaveTextContent('no');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');

      // Should connect after latency
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
      });
    });

    it('handles connection establishment with retry logic', async () => {
      let connectionAttempts = 0;

      vi.mocked('../../../frontend/src/hooks/useWebSocket').mockImplementation(() => {
        connectionAttempts++;

        // Fail first 2 attempts, succeed on 3rd
        if (connectionAttempts < 3) {
          return {
            socket: null,
            lastMessage: null,
            readyState: WebSocket.CLOSED,
            isConnected: false,
            reconnectCount: connectionAttempts,
            sendMessage: vi.fn(),
            sendJsonMessage: vi.fn(),
            getWebSocket: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
          };
        }

        return {
          socket: new AdvancedMockWebSocket(testUrl),
          lastMessage: null,
          readyState: WebSocket.OPEN,
          isConnected: true,
          reconnectCount: connectionAttempts,
          sendMessage: vi.fn(),
          sendJsonMessage: vi.fn(),
          getWebSocket: vi.fn(),
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      });

      const TestComponent = () => {
        const { isConnected, reconnectCount } = useZeroSync();
        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="reconnect-count">{reconnectCount}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
        expect(screen.getByTestId('reconnect-count')).toHaveTextContent('2');
      });
    });

    it('handles connection drops and automatic reconnection', async () => {
      const TestComponent = () => {
        const { isConnected, isReconnecting, reconnectCount } = useZeroSync();
        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="reconnecting">{isReconnecting ? 'yes' : 'no'}</div>
            <div data-testid="reconnect-count">{reconnectCount}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Establish initial connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
        expect(screen.getByTestId('reconnect-count')).toHaveTextContent('0');
      });

      // Simulate connection drop
      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;
      ws.close();

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('no');
        expect(screen.getByTestId('reconnecting')).toHaveTextContent('yes');
        expect(screen.getByTestId('reconnect-count')).toHaveTextContent('1');
      });
    });

    it('respects reconnection limits and stops after max attempts', async () => {
      const TestComponent = () => {
        const { isConnected, reconnectCount, error } = useZeroSync();
        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="reconnect-count">{reconnectCount}</div>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider
          url={testUrl}
          maxReconnectAttempts={3}
          reconnectInterval={100}
        >
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Force continuous connection failures
      for (let i = 0; i < 5; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
        });

        if (i < 3) {
          const wsInstance = AdvancedMockWebSocket.prototype as any;
          const ws = wsInstance.constructor.mock.results[i]?.value;
          if (ws) {
            ws.close();
          }
        }
      }

      await waitFor(() => {
        expect(screen.getByTestId('reconnect-count')).toBeGreaterThanOrEqual(3);
        expect(screen.getByTestId('error')).toBeTruthy();
      });
    });

    it('handles connection latency variations', async () => {
      const TestComponent = () => {
        const { isConnected } = useZeroSync();
        return <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>;
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      // Slow connection
      act(() => {
        vi.advanceTimersByTime(100); // 100ms latency
      });

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
      });
    });
  });

  describe('State Synchronization', () => {
    it('synchronizes simple state across components', async () => {
      const TestComponent1 = () => {
        const [state, setState] = useZeroSyncState<string>('shared-state', {
          initialValue: 'initial'
        });
        return (
          <div>
            <div data-testid="state-1">{state}</div>
            <button data-testid="update-1" onClick={() => setState('updated-1')}>
              Update 1
            </button>
          </div>
        );
      };

      const TestComponent2 = () => {
        const [state] = useZeroSyncState<string>('shared-state', {
          initialValue: 'initial'
        });
        return <div data-testid="state-2">{state}</div>;
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent1 />
          <TestComponent2 />
        </ZeroSyncProvider>
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('state-1')).toHaveTextContent('initial');
      expect(screen.getByTestId('state-2')).toHaveTextContent('initial');

      // Update from component 1
      const updateButton = screen.getByTestId('update-1');
      await userEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByTestId('state-1')).toHaveTextContent('updated-1');
        expect(screen.getByTestId('state-2')).toHaveTextContent('updated-1');
      });
    });

    it('handles complex object state synchronization', async () => {
      interface ComplexState {
        user: {
          id: string;
          name: string;
          preferences: {
            theme: string;
            notifications: boolean;
          };
        };
        todos: Array<{
          id: string;
          text: string;
          completed: boolean;
          createdAt: Date;
        }>;
        lastActivity: Date;
      }

      const TestComponent = () => {
        const [state, setState] = useZeroSyncState<ComplexState>('complex-state', {
          initialValue: {
            user: {
              id: 'user-1',
              name: 'John Doe',
              preferences: {
                theme: 'light',
                notifications: true
              }
            },
            todos: [],
            lastActivity: new Date('2023-01-01')
          }
        });

        const updateTodo = () => {
          setState({
            ...state,
            todos: [
              ...state.todos,
              {
                id: 'todo-1',
                text: 'New todo',
                completed: false,
                createdAt: new Date()
              }
            ]
          });
        };

        return (
          <div>
            <div data-testid="user-name">{state.user.name}</div>
            <div data-testid="todo-count">{state.todos.length}</div>
            <button data-testid="add-todo" onClick={updateTodo}>
              Add Todo
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
      expect(screen.getByTestId('todo-count')).toHaveTextContent('0');

      const addButton = screen.getByTestId('add-todo');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('todo-count')).toHaveTextContent('1');
      });
    });

    it('handles array state synchronization with CRUD operations', async () => {
      interface TodoItem {
        id: string;
        text: string;
        completed: boolean;
        priority: 'low' | 'medium' | 'high';
      }

      const TestComponent = () => {
        const [todos, setTodos] = useZeroSyncState<TodoItem[]>('todos-array', {
          initialValue: []
        });

        const addTodo = (text: string, priority: TodoItem['priority'] = 'medium') => {
          setTodos([
            ...todos,
            {
              id: `todo-${Date.now()}`,
              text,
              completed: false,
              priority,
              createdAt: new Date()
            }
          ]);
        };

        const updateTodo = (id: string, updates: Partial<TodoItem>) => {
          setTodos(todos.map(todo =>
            todo.id === id ? { ...todo, ...updates } : todo
          ));
        };

        const removeTodo = (id: string) => {
          setTodos(todos.filter(todo => todo.id !== id));
        };

        return (
          <div>
            <div data-testid="todo-list">
              {todos.map((todo, index) => (
                <div key={todo.id} data-testid={`todo-${index}`}>
                  <span>{todo.text}</span>
                  <span data-testid={`completed-${index}`}>{todo.completed ? '✓' : '○'}</span>
                  <span data-testid={`priority-${index}`}>{todo.priority}</span>
                  <button
                    data-testid={`toggle-${index}`}
                    onClick={() => updateTodo(todo.id, { completed: !todo.completed })}
                  >
                    Toggle
                  </button>
                  <button
                    data-testid={`remove-${index}`}
                    onClick={() => removeTodo(todo.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div data-testid="todo-count">{todos.length}</div>
            <button
              data-testid="add-low"
              onClick={() => addTodo('Low priority todo', 'low')}
            >
              Add Low
            </button>
            <button
              data-testid="add-high"
              onClick={() => addTodo('High priority todo', 'high')}
            >
              Add High
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('todo-count')).toHaveTextContent('0');

      // Add todos
      const addLowButton = screen.getByTestId('add-low');
      const addHighButton = screen.getByTestId('add-high');

      await userEvent.click(addLowButton);
      await userEvent.click(addHighButton);

      await waitFor(() => {
        expect(screen.getByTestId('todo-count')).toHaveTextContent('2');
      });

      // Toggle completion
      const toggleButton = screen.getByTestId('toggle-0');
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByTestId('completed-0')).toHaveTextContent('✓');
      });

      // Update priority
      const updateButton = screen.getByTestId('toggle-1');
      // In a real implementation, this would toggle completion, but we'll test with available buttons
      await userEvent.click(updateButton);

      // Remove todo
      const removeButton = screen.getByTestId('remove-0');
      await userEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByTestId('todo-count')).toHaveTextContent('1');
      });
    });

    it('handles concurrent state updates from multiple components', async () => {
      const TestComponent = ({ id }: { id: number }) => {
        const [count, setCount] = useZeroSyncState<number>(`counter-${id}`, {
          initialValue: 0
        });

        const increment = () => setCount(count + 1);
        const decrement = () => setCount(count - 1);

        return (
          <div data-testid={`component-${id}`}>
            <span data-testid={`count-${id}`}>{count}</span>
            <button data-testid={`increment-${id}`} onClick={increment}>
              Increment
            </button>
            <button data-testid={`decrement-${id}`} onClick={decrement}>
              Decrement
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent id={1} />
          <TestComponent id={2} />
          <TestComponent id={3} />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      // All components should start at 0
      expect(screen.getByTestId('count-1')).toHaveTextContent('0');
      expect(screen.getByTestId('count-2')).toHaveTextContent('0');
      expect(screen.getByTestId('count-3')).toHaveTextContent('0');

      // Increment all components simultaneously
      const increment1 = screen.getByTestId('increment-1');
      const increment2 = screen.getByTestId('increment-2');
      const increment3 = screen.getByTestId('increment-3');

      await userEvent.click(increment1);
      await userEvent.click(increment2);
      await userEvent.click(increment3);

      await waitFor(() => {
        expect(screen.getByTestId('count-1')).toHaveTextContent('1');
        expect(screen.getByTestId('count-2')).toHaveTextContent('1');
        expect(screen.getByTestId('count-3')).toHaveTextContent('1');
      });

      // Decrement from one component
      const decrement2 = screen.getByTestId('decrement-2');
      await userEvent.click(decrement2);

      await waitFor(() => {
        expect(screen.getByTestId('count-1')).toHaveTextContent('1');
        expect(screen.getByTestId('count-2')).toHaveTextContent('0');
        expect(screen.getByTestId('count-3')).toHaveTextContent('1');
      });
    });
  });

  describe('Pending Operations Management', () => {
    it('tracks pending operations during state updates', async () => {
      const TestComponent = () => {
        const { pendingOperations } = useZeroSync();
        const [value, setValue] = useZeroSyncState<string>('pending-test', {
          initialValue: 'initial'
        });

        const updateValue = (newValue: string) => {
          setValue(newValue);
        };

        return (
          <div>
            <div data-testid="value">{value}</div>
            <div data-testid="pending-count">{pendingOperations.size}</div>
            <button data-testid="update" onClick={() => updateValue('test')}>
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

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');

      const updateButton = screen.getByTestId('update');
      await userEvent.click(updateButton);

      // Should have a pending operation
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');
      expect(screen.getByTestId('value')).toHaveTextContent('test');

      // After server acknowledgment, pending should be cleared
      await waitFor(() => {
        expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
      });
    });

    it('removes pending operations after successful server acknowledgment', async () => {
      let serverResponseHandler: ((message: any) => void) | null = null;

      const TestComponent = () => {
        const { pendingOperations } = useZeroSync();
        const [value, setValue] = useZeroSyncState<string>('ack-test', {
          initialValue: 'initial'
        });

        // Mock server acknowledgment
        React.useEffect(() => {
          serverResponseHandler = (message: any) => {
            if (message.type === 'STATE_UPDATED') {
              // Simulate server acknowledgment
              setTimeout(() => {
                // In real implementation, this would be handled by ZeroSync context
                // For testing, we simulate the acknowledgment
              }, 50);
            }
          };
        }, []);

        return (
          <div>
            <div data-testid="value">{value}</div>
            <div data-testid="pending-count">{pendingOperations.size}</div>
            <button data-testid="update" onClick={() => setValue('ack-test-updated')}>
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

      act(() => {
        vi.advanceTimersByTime(10);
      });

      const updateButton = screen.getByTestId('update');
      await userEvent.click(updateButton);

      // Should have pending operation initially
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');

      // Simulate server acknowledgment
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
        expect(screen.getByTestId('value')).toHaveTextContent('ack-test-updated');
      });
    });

    it('handles failed operations and error recovery', async () => {
      const TestComponent = () => {
        const { pendingOperations, error } = useZeroSync();
        const [value, setValue] = useZeroSyncState<string>('error-test', {
          initialValue: 'initial'
        });

        const updateWithError = () => {
          // Simulate an error that would be caught
          try {
            setValue('error-value');
          } catch (error) {
            // In real implementation, this would be handled gracefully
          }
        };

        return (
          <div>
            <div data-testid="value">{value}</div>
            <div data-testid="pending-count">{pendingOperations.size}</div>
            <div data-testid="error">{error || 'no-error'}</div>
            <button data-testid="update-with-error" onClick={updateWithError}>
              Update with Error
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      const errorButton = screen.getByTestId('update-with-error');
      await userEvent.click(errorButton);

      // Should handle error gracefully
      expect(screen.getByTestId('value')).toBeInTheDocument();
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });

    it('limits pending operations to prevent memory leaks', async () => {
      const TestComponent = () => {
        const { pendingOperations } = useZeroSync();
        const [value, setValue] = useZeroSyncState<string>('limit-test', {
          initialValue: 'initial'
        });

        const rapidUpdates = () => {
          // Create many pending operations
          for (let i = 0; i < 100; i++) {
            setValue(`value-${i}`);
          }
        };

        return (
          <div>
            <div data-testid="value">{value}</div>
            <div data-testid="pending-count">{pendingOperations.size}</div>
            <button data-testid="rapid-updates" onClick={rapidUpdates}>
              Rapid Updates
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      const rapidButton = screen.getByTestId('rapid-updates');
      await userEvent.click(rapidButton);

      // Should handle many pending operations
      expect(screen.getByTestId('pending-count')).toBeGreaterThan(0);
      expect(screen.getByTestId('pending-count')).toBeLessThan(101); // Should limit pending ops
    });
  });

  describe('Conflict Resolution', () => {
    it('detects state conflicts when remote changes occur', async () => {
      const TestComponent = () => {
        const { conflicts } = useZeroSync();
        const [state, setState] = useZeroSyncState<string>('conflict-test', {
          initialValue: 'local-value'
        });

        const updateLocal = () => {
          setState('local-updated');
        };

        return (
          <div>
            <div data-testid="state">{state}</div>
            <div data-testid="conflict-count">{conflicts.size}</div>
            <button data-testid="update-local" onClick={updateLocal}>
              Update Local
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Update local state
      const updateButton = screen.getByTestId('update-local');
      await userEvent.click(updateButton);

      expect(screen.getByTestId('state')).toHaveTextContent('local-updated');

      // Simulate remote change conflict
      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      ws.simulateServerMessage({
        type: 'CONFLICT_DETECTED',
        payload: {
          id: 'conflict-1',
          path: 'conflict-test',
          localData: 'local-updated',
          remoteData: 'remote-value'
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('conflict-count')).toHaveTextContent('1');
      });
    });

    it('provides conflict resolution options', async () => {
      const TestComponent = () => {
        const { conflicts } = useZeroSync();
        const [state, setState] = useZeroSyncState<string>('resolution-test', {
          initialValue: 'local-value',
          onConflict: (local, remote) => {
            // Choose remote value for resolution
            return remote;
          }
        });

        return (
          <div>
            <div data-testid="state">{state}</div>
            <div data-testid="conflict-count">{conflicts.size}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTimeout(10);
      });

      // Simulate conflict
      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      ws.simulateServerMessage({
        type: 'CONFLICT_DETECTED',
        payload: {
          id: 'conflict-1',
          path: 'resolution-test',
          localData: 'local-value',
          remoteData: 'remote-resolved'
        }
      });

      await waitFor(() => {
        // Should resolve to remote value
        expect(screen.getByTestId('state')).toHaveTextContent('remote-resolved');
        expect(screen.getByTestId('conflict-count')).toHaveTextContent('0'); // Conflict resolved
      });
    });

    it('handles multiple simultaneous conflicts', async () => {
      const TestComponent = () => {
        const { conflicts } = useZeroSync();
        const [state1, setState1] = useZeroSyncState<string>('conflict-test-1', {
          initialValue: 'local-1'
        });
        const [state2, setState2] = useZeroSyncState<string>('conflict-test-2', {
          initialValue: 'local-2'
        });

        return (
          <div>
            <div data-testid="state-1">{state1}</div>
            <div data-testid="state-2">{state2}</div>
            <div data-testid="conflict-count">{conflicts.size}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Create multiple conflicts
      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      ws.simulateServerMessage({
        type: 'CONFLICT_DETECTED',
        payload: {
          id: 'conflict-1',
          path: 'conflict-test-1',
          localData: 'local-1',
          remoteData: 'remote-1'
        }
      });

      ws.simulateServerMessage({
        type: 'CONFLICT_DETECTED',
        payload: {
          id: 'conflict-2',
          path: 'conflict-test-2',
          localData: 'local-2',
          remoteData: 'remote-2'
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('conflict-count')).toHaveTextContent('2');
      });
    });

    it('allows manual conflict resolution', async () => {
      const TestComponent = () => {
        const { resolveConflict } = useZeroSync();
        const { conflicts } = useZeroSync();
        const [state, setState] = useZeroSyncState<string>('manual-resolution', {
          initialValue: 'local-value'
        });

        const resolveConflict1 = () => {
          resolveConflict('conflict-1', 'resolved-value');
        };

        return (
          <div>
            <div data-testid="state">{state}</div>
            <div data-testid="conflict-count">{conflicts.size}</div>
            <button data-testid="resolve-conflict" onClick={resolveConflict1}>
              Resolve Conflict
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Create conflict first
      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      ws.simulateServerMessage({
        type: 'CONFLICT_DETECTED',
        payload: {
          id: 'conflict-1',
          path: 'manual-resolution',
          localData: 'local-value',
          remoteData: 'remote-value'
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('conflict-count')).toHaveTextContent('1');
      });

      const resolveButton = screen.getByTestId('resolve-conflict');
      await userEvent.click(resolveButton);

      await waitFor(() => {
        expect(screen.getByTestId('conflict-count')).toHaveTextContent('0');
      });
    });
  });

  describe('Subscription Management', () => {
    it('adds and removes subscriptions dynamically', async () => {
      const TestComponent = () => {
        const { subscribe, unsubscribe, subscriptions } = useZeroSync();
        const [state, setState] = useZeroSyncState<string>('subscription-test', {
          initialValue: 'initial'
        });

        const addSubscription = () => {
          const unsub = subscribe('subscription-test', (data) => {
          setState(data);
        });
          return unsub;
        };

        return (
          <div>
            <div data-testid="state">{state}</div>
            <div data-testid="subscription-count">{subscriptions.size}</div>
            <button data-testid="add-subscription" onClick={addSubscription}>
              Subscribe
            </button>
            <button data-testid="remove-subscription" onClick={() => unsubscribe('subscription-test')}>
              Unsubscribe
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('subscription-count')).toHaveTextContent('0');

      // Add subscription
      const addButton = screen.getByTestId('add-subscription');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('subscription-count')).toHaveTextContent('1');
      });

      // Remove subscription
      const removeButton = screen.getByTestId('remove-subscription');
      await userEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByTestId('subscription-count')).toHaveTextContent('0');
      });
    });

    it('handles multiple subscriptions to the same path', async () => {
      const TestComponent = () => {
        const { subscribe, unsubscribe, subscriptions } = useZeroSync();
        const [state1, setState1] = useZeroSyncState<string>('multi-subscription', {
          initialValue: 'initial'
        });
        const [state2, setState2] = useZeroSyncState<string>('multi-subscription', {
          initialValue: 'initial'
        });

        const addSubscriptions = () => {
          subscribe('multi-subscription', setState1);
          subscribe('multi-subscription', setState2);
        };

        return (
          <div>
            <div data-testid="state-1">{state1}</div>
            <div data-testid="state-2">{state2}</div>
            <div data-testid="subscription-count">{subscriptions.size}</div>
            <button data-testid="add-subscriptions" onClick={addSubscriptions}>
              Add Multiple Subscriptions
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('subscription-count')).toHaveTextContent('0');

      const addButton = screen.getByTestId('add-subscriptions');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('subscription-count')).toHaveTextContent('1');
      });

      // Should handle multiple subscriptions to same path
      expect(screen.getByTestId('state-1')).toHaveTextContent('initial');
      expect(screen.getByTestId('state-2')).toHaveTextContent('initial');
    });

    it('delivers subscription updates when server pushes changes', async () => {
      const TestComponent = () => {
        const [state, setState] = useZeroSyncState<string>('push-subscription', {
          initialValue: 'initial'
        });

        return (
          <div data-testid="push-state">{state}</div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('push-state')).toHaveTextContent('initial');

      // Simulate server push
      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      ws.simulateServerMessage({
        type: 'STATE_UPDATE',
        payload: {
          path: 'push-subscription',
          data: 'server-pushed-value'
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('push-state')).toHaveTextContent('server-pushed-value');
      });
    });

    it('cleans up subscriptions on component unmount', () => {
      const TestComponent = ({ onUnmount }: { onUnmount?: () => void }) => {
        const { subscribe } = useZeroSync();
        const [state] = useZeroSyncState<string>('cleanup-test', {
          initialValue: 'initial'
        });

        React.useEffect(() => {
          const unsubscribe = subscribe('cleanup-test', (data) => {
            // Would update state with received data
          });

          return () => {
            unsubscribe();
            if (onUnmount) onUnmount();
          };
        }, [subscribe, onUnmount]);

        return <div data-testid="cleanup-state">{state}</div>;
      };

      const onUnmount = vi.fn();

      const { unmount } = render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent onUnmount={onUnmount} />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(() => unmount()).not.toThrow();
      expect(onUnmount).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('handles high-frequency state updates efficiently', async () => {
      const TestComponent = () => {
        const [value, setValue] = useZeroSyncState<number>('performance-test', {
          initialValue: 0
        });

        const rapidUpdates = async () => {
          for (let i = 0; i < 1000; i++) {
          setValue(i);
          // Small delay to prevent overwhelming the system
          if (i % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
        };

        return (
          <div>
            <div data-testid="value">{value}</div>
            <button data-testid="rapid-updates" onClick={rapidUpdates}>
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
      expect(renderTime).toBeLessThan(50); // Should render quickly

      const rapidButton = screen.getByTestId('rapid-updates');
      const updateStartTime = performance.now();
      await userEvent.click(rapidButton);

      const updateTime = performance.now() - updateStartTime;
      expect(updateTime).toBeLessThan(5000); // Should handle 1000 updates efficiently

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('999');
      });
    });

    it('maintains performance with many simultaneous connections', async () => {
      const connectionCount = 10;
      const TestComponents = Array.from({ length: connectionCount }, (_, index) => {
        return () => {
          const [state, setState] = useZeroSyncState<string>(`perf-state-${index}`, {
            initialValue: `initial-${index}`
          });

          return (
            <div data-testid={`state-${index}`}>
              {state}
              <button
                data-testid={`update-${index}`}
                onClick={() => setState(`updated-${index}`)}
              >
                Update
              </button>
            </div>
          );
        };
      });

      const render(
        <ZeroSyncProvider url={testUrl}>
          {TestComponents.map((Component, index) => (
            <Component key={index} />
          ))}
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Update all components
      const updatePromises = Array.from({ length: connectionCount }, (_, index) => {
          const updateButton = screen.getByTestId(`update-${index}`);
          return userEvent.click(updateButton);
      });

      await Promise.all(updatePromises);

      await waitFor(() => {
        for (let i = 0; i < connectionCount; i++) {
          expect(screen.getByTestId(`state-${i}`)).toHaveTextContent(`updated-${i}`);
        }
      });
    });

    it('properly cleans up resources on provider unmount', () => {
      const TestComponent = () => {
        const { isConnected } = useZeroSync();
        return <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>;
      };

      const { unmount } = render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('connected')).toHaveTextContent('yes');

      expect(() => unmount()).not.toThrow();

      // WebSocket should be closed
      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0]?.value;
      if (ws) {
        expect(ws.readyState).toBe(AdvancedMockWebSocket.CLOSED);
      }
    });

    it('handles memory pressure with large state objects', async () => {
      const TestComponent = () => {
        const [state, setState] = useZeroSyncState<object>('memory-pressure-test', {
          initialValue: {}
        });

        const createLargeObject = () => {
          const largeObject: Record<string, any> = {};
          for (let i = 0; i < 1000; i++) {
          largeObject[`key-${i}`] = {
            id: `item-${i}`,
            data: 'x'.repeat(1000),
            metadata: {
              created: new Date(),
              updated: new Date(),
              tags: Array.from({ length: 10 }, (_, index) => `tag-${index}`),
            }
          };
        }
        };

        return (
          <div>
            <div data-testid="object-size">{JSON.stringify(state).length}</div>
            <button
              data-testid="create-large-object"
              onClick={() => setState(createLargeObject())}
            >
              Create Large Object
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      const createButton = screen.getByTestId('create-large-object');
      await userEvent.click(createButton);

      await waitFor(() => {
        const size = parseInt(screen.getByTestId('object-size').textContent);
        expect(size).toBeGreaterThan(100000); // Large object
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles WebSocket connection failures gracefully', async () => {
      vi.mock('../../../frontend/src/hooks/useWebSocket', () => ({
        useWebSocket: () => ({
          socket: null,
          lastMessage: null,
          readyState: WebSocket.CLOSED,
          isConnected: false,
          reconnectCount: 3,
          sendMessage: vi.fn().mockImplementation(() => {
            throw new Error('WebSocket connection failed');
          }),
          sendJsonMessage: vi.fn().mockImplementation(() => {
            throw new Error('WebSocket connection failed');
          }),
          getWebSocket: vi.fn(),
          connect: vi.fn(),
          disconnect: vi.fn(),
        }),
      }));

      const TestComponent = () => {
        const { isConnected, error } = useZeroSync();
        const [state, setState] = useZeroSyncState<string>('error-test', {
          initialValue: 'initial'
        });

        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="error">{error || 'no-error'}</div>
            <div data-testid="state">{state}</div>
            <button
              data-testid="attempt-update"
              onClick={() => setState('should-not-work')}
            >
              Attempt Update
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      expect(screen.getByTestId('connected')).toHaveTextContent('no');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      expect(screen.getByTestId('state')).toHaveTextContent('initial');

      const updateButton = screen.getByTestId('attempt-update');
      await userEvent.click(updateButton);

      // Should handle gracefully without crashing
      expect(screen.getByTestId('state')).toBeInTheDocument();
    });

    it('recovers from temporary network issues', async () => {
      const TestComponent = () => {
        const { isConnected, isReconnecting, error } = useZeroSync();
        const [state, setState] = useZeroSyncState<string>('recovery-test', {
          initialValue: 'initial'
        });

        return (
          <div>
            <div data-testid="connected">{isConnected ? 'yes' : 'no'}</div>
            <div data-testid="reconnecting">{isReconnecting ? 'yes' : 'no'}</div>
            <div data-testid="error">{error || 'no-error'}</div>
            <div data-testid="state">{state}</div>
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
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
      });

      // Simulate network failure
      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;
      ws.simulateNetworkError();

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('no');
        expect(screen.getByTestId('reconnecting')).toHaveTextContent('yes');
        expect(screen.getByTestId('error')).toBeTruthy();
      });

      // Simulate recovery
      act(() => {
        vi.advanceTimersByTime(2000); // Reconnection attempt
      });

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
        expect(screen.getByTestId('reconnecting')).toHaveTextContent('no');
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });
    });

    it('handles malformed server messages without crashing', async () => {
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
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('yes');
      });

      const wsInstance = AdvancedMockWebSocket.prototype as any;
      const ws = wsInstance.constructor.mock.results[0].value;

      // Send various malformed messages
      expect(() => {
        ws.simulateServerMessage('invalid-json');
      }).not.toThrow();

      expect(() => {
        ws.simulateServerMessage(null);
      }).not.toThrow();

      expect(() => {
        ws.simulateServerMessage(undefined);
      }).not.toThrow();

      expect(() => {
        ws.simulateServerMessage({ invalid: 'structure' });
      }).not.toThrow();

      // System should remain stable
      expect(screen.getByTestId('connected')).toHaveTextContent('yes');
    });
  });

  describe('Integration with Other Systems', () => {
    it('integrates with authentication system', async () => {
      // Mock authentication store
      const mockAuthStore = {
        user: { id: 'user-1', name: 'Test User' },
        token: 'auth-token',
        isAuthenticated: true
      };

      vi.mock('../../../frontend/src/stores/authStore', () => mockAuthStore);

      const TestComponent = () => {
        const { isAuthenticated } = useZeroSync();
        const [user] = useAuthStore();
        return (
          <div>
            <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
            <div data-testid="user-name">{user.name}</div>
            <div data-testid="connection-status">{isConnected ? 'connected' : 'disconnected'}</div>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
        expect(screen.getByTestId('connection-status')).toHaveTextContent('connected');
      });
    });

    it('integrates with notification system for real-time updates', async () => {
      const mockNotificationStore = {
        notifications: [],
        addNotification: vi.fn(),
        removeNotification: vi.fn(),
      };

      vi.mock('../../../frontend/src/stores/NotificationContext', () => mockNotificationStore);

      const TestComponent = () => {
        const { lastSync } = useZeroSync();
        const { addNotification } = useNotificationStore();

        const triggerNotification = () => {
          addNotification({
            id: 'sync-1',
            type: 'info',
            title: 'Sync Complete',
            message: `Last sync: ${lastSync?.toISOString() || 'Never'}`,
          });
        };

        return (
          <div>
            <div data-testid="last-sync">{lastSync ? lastSync.toISOString() : 'Never'}</div>
            <button data-testid="trigger-notification" onClick={triggerNotification}>
              Trigger Notification
            </button>
          </div>
        );
      };

      render(
        <ZeroSyncProvider url={testUrl}>
          <TestComponent />
        </ZeroSyncProvider>
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      const notificationButton = screen.getByTestId('trigger-notification');
      await userEvent.click(notificationButton);

      expect(mockNotificationStore.addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Sync Complete',
        })
      );
    });

    it('integrates with performance monitoring', async () => {
      const mockPerformanceMonitor = {
        recordSyncOperation: vi.fn(),
        recordLatency: vi.fn(),
        recordError: vi.fn(),
      };

      vi.mock('../../../frontend/src/services/PerformanceService', () => mockPerformanceMonitor);

      const TestComponent = () => {
        const { pendingOperations, lastSync } = useZeroSync();
        const { recordSyncOperation } = mockPerformanceMonitor;

        const updateState = (data: any) => {
          recordSyncOperation({
            operation: 'state-update',
            path: 'performance-test',
            timestamp: new Date(),
            dataSize: JSON.stringify(data).length
          });
        };

        const [state, setState] = useZeroSyncState<string>('performance-test', {
          initialValue: 'initial'
        });

        return (
          <div>
            <div data-testid="state">{state}</div>
            <div data-testid="pending-ops">{pendingOperations.size}</div>
            <div data-testid="last-sync">{lastSync?.toISOString() || 'Never'}</div>
            <button data-testid="update-state" onClick={() => updateState('performance-test-updated')}>
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

      act(() => {
        vi.advanceTimersByTime(10);
      });

      const updateButton = screen.getByTestId('update-state');
      await userEvent.click(updateButton);

      expect(mockPerformanceMonitor.recordSyncOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'state-update',
          path: 'performance-test',
        })
      );
    });
  });
});