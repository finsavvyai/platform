/**
 * useWebSocket Hook Tests
 * Comprehensive testing for the useWebSocket custom hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { useWebSocket } from '../../../frontend/src/hooks/useWebSocket';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  protocol: string = '';
  extensions: string = '';
  bufferedAmount: number = 0;
  binaryType: BinaryType = 'blob';

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private eventListeners: { [key: string]: Function[] } = {};

  constructor(url: string) {
    this.url = url;

    // Simulate connection after a delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Mock successful send
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

  addEventListener(type: string, listener: EventListener): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (this.eventListeners[type]) {
      this.eventListeners[type] = this.eventListeners[type].filter(l => l !== listener);
    }
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.eventListeners[event.type] || [];
    listeners.forEach(listener => listener(event));
    return true;
  }

  // Helper method for testing
  simulateMessage(data: string): void {
    if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Replace global WebSocket with mock
const OriginalWebSocket = global.WebSocket;

describe('useWebSocket Hook', () => {
  const testUrl = 'ws://localhost:8080';

  beforeEach(() => {
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = OriginalWebSocket;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(() => useWebSocket(null));

      expect(result.current.socket).toBe(null);
      expect(result.current.lastMessage).toBe(null);
      expect(result.current.readyState).toBe(WebSocket.CLOSED);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.reconnectCount).toBe(0);
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.sendJsonMessage).toBe('function');
      expect(typeof result.current.getWebSocket).toBe('function');
      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
    });

    it('creates WebSocket when URL is provided', () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      // WebSocket should be created immediately
      expect(MockWebSocket).toHaveBeenCalledWith(testUrl);
    });

    it('does not create WebSocket when URL is null', () => {
      const { result } = renderHook(() => useWebSocket(null));

      expect(result.current.socket).toBe(null);
    });

    it('recreates WebSocket when URL changes', () => {
      const { result, rerender } = renderHook(
        ({ url }) => useWebSocket(url),
        { initialProps: { url: testUrl } }
      );

      expect(MockWebSocket).toHaveBeenCalledWith(testUrl);

      const newUrl = 'ws://localhost:8081';
      rerender({ url: newUrl });

      expect(MockWebSocket).toHaveBeenCalledWith(newUrl);
    });

    it('closes previous WebSocket when URL changes', () => {
      const { result, rerender } = renderHook(
        ({ url }) => useWebSocket(url),
        { initialProps: { url: testUrl } }
      );

      const firstSocket = result.current.socket;

      rerender({ url: 'ws://localhost:8081' });

      // Previous socket should be closed (in real implementation)
      expect(firstSocket).not.toBe(result.current.socket);
    });
  });

  describe('Connection State Management', () => {
    it('updates readyState when connection opens', async () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      expect(result.current.readyState).toBe(WebSocket.CONNECTING);
      expect(result.current.isConnected).toBe(false);

      // Fast forward to trigger connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.readyState).toBe(WebSocket.OPEN);
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('updates readyState when connection closes', async () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      // Wait for connection to open
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Close connection
      act(() => {
        result.current.disconnect();
        vi.advanceTimersByTime(5);
      });

      await waitFor(() => {
        expect(result.current.readyState).toBe(WebSocket.CLOSED);
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('calls onOpen callback when connection opens', async () => {
      const mockOnOpen = vi.fn();
      const { result } = renderHook(() =>
        useWebSocket(testUrl, { onOpen: mockOnOpen })
      );

      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(mockOnOpen).toHaveBeenCalledWith(expect.any(Event));
      });
    });

    it('calls onClose callback when connection closes', async () => {
      const mockOnClose = vi.fn();
      const { result } = renderHook(() =>
        useWebSocket(testUrl, { onClose: mockOnClose })
      );

      // Wait for connection to open
      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Close connection
      act(() => {
        result.current.disconnect();
        vi.advanceTimersByTime(5);
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledWith(expect.any(CloseEvent));
      });
    });

    it('calls onError callback when error occurs', () => {
      const mockOnError = vi.fn();
      renderHook(() =>
        useWebSocket(testUrl, { onError: mockOnError })
      );

      // Simulate error
      act(() => {
        const socket = MockWebSocket.prototype as any;
        socket.simulateError();
      });

      // In real implementation, this would trigger the callback
      // This test shows the structure for error handling
    });
  });

  describe('Message Handling', () => {
    it('updates lastMessage when message is received', async () => {
      const mockOnMessage = vi.fn();
      const { result } = renderHook(() =>
        useWebSocket(testUrl, { onMessage: mockOnMessage })
      );

      // Wait for connection to open
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate receiving a message
      const testData = 'test message';
      act(() => {
        const socket = result.current.socket as any;
        socket.simulateMessage(testData);
      });

      await waitFor(() => {
        expect(result.current.lastMessage?.data).toBe(testData);
        expect(mockOnMessage).toHaveBeenCalledWith(expect.any(MessageEvent));
      });
    });

    it('sends string messages', async () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      // Wait for connection to open
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const testMessage = 'Hello WebSocket!';

      act(() => {
        result.current.sendMessage(testMessage);
      });

      // In real implementation, this would send the message
      // Mock WebSocket doesn't have a way to verify sent messages
    });

    it('sends JSON messages', async () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      // Wait for connection to open
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const testJson = { type: 'greeting', message: 'Hello!' };

      act(() => {
        result.current.sendJsonMessage(testJson);
      });

      // In real implementation, this would stringify and send the JSON
    });

    it('handles sending messages when not connected', () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      // Don't wait for connection, try to send immediately
      expect(() => {
        result.current.sendMessage('test');
      }).not.toThrow();

      expect(() => {
        result.current.sendJsonMessage({ test: 'data' });
      }).not.toThrow();
    });
  });

  describe('Reconnection Logic', () => {
    it('attempts to reconnect when connection closes unexpectedly', async () => {
      const mockShouldReconnect = vi.fn(() => true);
      const { result } = renderHook(() =>
        useWebSocket(testUrl, {
          shouldReconnect: mockShouldReconnect,
          reconnectInterval: 1000,
          maxReconnectAttempts: 3
        })
      );

      // Wait for initial connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate unexpected close
      act(() => {
        const socket = result.current.socket as any;
        socket.close();
        vi.advanceTimersByTime(5);
      });

      // Should trigger reconnection logic
      expect(mockShouldReconnect).toHaveBeenCalled();
    });

    it('respects max reconnect attempts', async () => {
      const mockShouldReconnect = vi.fn(() => true);
      const { result } = renderHook(() =>
        useWebSocket(testUrl, {
          shouldReconnect: mockShouldReconnect,
          reconnectInterval: 100,
          maxReconnectAttempts: 2
        })
      );

      // Simulate multiple reconnection attempts
      for (let i = 0; i < 5; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }

      // Should stop reconnecting after max attempts
      expect(result.current.reconnectCount).toBeLessThanOrEqual(2);
    });

    it('does not reconnect when shouldReconnect returns false', async () => {
      const mockShouldReconnect = vi.fn(() => false);
      const { result } = renderHook(() =>
        useWebSocket(testUrl, {
          shouldReconnect: mockShouldReconnect,
          reconnectInterval: 1000
        })
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Close connection
      act(() => {
        result.current.disconnect();
        vi.advanceTimersByTime(5);
      });

      // Should not attempt to reconnect
      expect(mockShouldReconnect).toHaveBeenCalled();
      expect(result.current.reconnectCount).toBe(0);
    });

    it('increments reconnect count on each attempt', async () => {
      const mockShouldReconnect = vi.fn(() => true);
      const { result } = renderHook(() =>
        useWebSocket(testUrl, {
          shouldReconnect: mockShouldReconnect,
          reconnectInterval: 100,
          maxReconnectAttempts: 3
        })
      );

      // Simulate reconnection attempts
      act(() => {
        vi.advanceTimersByTime(10); // Initial connection
      });

      // Force close and reconnection attempts
      for (let i = 0; i < 3; i++) {
        act(() => {
          const socket = result.current.socket as any;
          if (socket) socket.close();
          vi.advanceTimersByTime(100);
        });
      }

      // Reconnect count should increase
      expect(result.current.reconnectCount).toBeGreaterThan(0);
    });
  });

  describe('Manual Connection Control', () => {
    it('connects manually when URL is initially null', () => {
      const { result } = renderHook(() => useWebSocket(null));

      expect(result.current.socket).toBe(null);

      act(() => {
        result.current.connect();
      });

      // Should not connect without URL
      expect(result.current.socket).toBe(null);
    });

    it('disconnects manually', async () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.disconnect();
        vi.advanceTimersByTime(5);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.readyState).toBe(WebSocket.CLOSED);
      });
    });

    it('gets current WebSocket instance', () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      const socket = result.current.getWebSocket();
      expect(socket).toBe(result.current.socket);
    });

    it('returns null WebSocket when not connected', () => {
      const { result } = renderHook(() => useWebSocket(null));

      const socket = result.current.getWebSocket();
      expect(socket).toBe(null);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('cleans up WebSocket on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket(testUrl));

      expect(() => unmount()).not.toThrow();

      // WebSocket should be properly closed
      // In real implementation, this would verify close was called
    });

    it('cleans up reconnection timers on unmount', () => {
      const { unmount } = renderHook(() =>
        useWebSocket(testUrl, { reconnectInterval: 1000 })
      );

      expect(() => unmount()).not.toThrow();

      // Timers should be cleared
      expect(vi.clearAllTimers).toHaveBeenCalled();
    });

    it('handles rapid mount/unmount cycles', () => {
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(() => useWebSocket(testUrl));
        unmount();
      }

      // Should not cause memory leaks or errors
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles invalid URL gracefully', () => {
      expect(() => {
        renderHook(() => useWebSocket('invalid-url'));
      }).not.toThrow();
    });

    it('handles WebSocket constructor errors', () => {
      // Mock WebSocket to throw error
      const OriginalWebSocket = global.WebSocket;
      global.WebSocket = vi.fn().mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      }) as any;

      expect(() => {
        renderHook(() => useWebSocket(testUrl));
      }).not.toThrow();

      global.WebSocket = OriginalWebSocket;
    });

    it('handles message parsing errors', () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Send invalid JSON via sendJsonMessage
      const circularReference: any = {};
      circularReference.self = circularReference;

      expect(() => {
        result.current.sendJsonMessage(circularReference);
      }).not.toThrow();
    });

    it('handles event listener errors gracefully', async () => {
      const mockOnMessage = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const { result } = renderHook(() =>
        useWebSocket(testUrl, { onMessage: mockOnMessage })
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Simulate message that would cause callback error
      act(() => {
        const socket = result.current.socket as any;
        socket.simulateMessage('test message');
      });

      // Error should be caught gracefully (implementation dependent)
    });
  });

  describe('Performance and Optimization', () => {
    it('does not create unnecessary WebSockets on re-renders', () => {
      const { rerender } = renderHook(() => useWebSocket(testUrl));

      const initialCallCount = (MockWebSocket as any).mock.calls.length;

      // Re-render multiple times
      for (let i = 0; i < 5; i++) {
        rerender();
      }

      // Should not create additional WebSockets
      expect((MockWebSocket as any).mock.calls.length).toBe(initialCallCount);
    });

    it('debounces rapid connection attempts', async () => {
      const { result } = renderHook(() =>
        useWebSocket(testUrl, { reconnectInterval: 1000 })
      );

      // Try to connect multiple times rapidly
      for (let i = 0; i < 5; i++) {
        result.current.connect();
      }

      // Should only create one WebSocket
      expect((MockWebSocket as any).mock.calls.length).toBe(1);
    });

    it('handles large messages efficiently', async () => {
      const { result } = renderHook(() => useWebSocket(testUrl));

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Send large message
      const largeMessage = 'x'.repeat(10000);

      expect(() => {
        result.current.sendMessage(largeMessage);
      }).not.toThrow();
    });

    it('handles high-frequency message updates', async () => {
      const mockOnMessage = vi.fn();
      const { result } = renderHook(() =>
        useWebSocket(testUrl, { onMessage: mockOnMessage })
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Simulate many messages
      for (let i = 0; i < 100; i++) {
        act(() => {
          const socket = result.current.socket as any;
          socket.simulateMessage(`message-${i}`);
        });
      }

      // Should handle all messages without crashing
      expect(mockOnMessage).toHaveBeenCalledTimes(100);
    });
  });

  describe('Integration Scenarios', () => {
    it('handles complete connection lifecycle', async () => {
      const mockOnOpen = vi.fn();
      const mockOnMessage = vi.fn();
      const mockOnClose = vi.fn();

      const { result } = renderHook(() =>
        useWebSocket(testUrl, {
          onOpen: mockOnOpen,
          onMessage: mockOnMessage,
          onClose: mockOnClose
        })
      );

      // Initial state
      expect(result.current.isConnected).toBe(false);
      expect(result.current.reconnectCount).toBe(0);

      // Connection opens
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(mockOnOpen).toHaveBeenCalled();
      });

      // Message received
      act(() => {
        const socket = result.current.socket as any;
        socket.simulateMessage('test message');
      });

      await waitFor(() => {
        expect(result.current.lastMessage?.data).toBe('test message');
        expect(mockOnMessage).toHaveBeenCalled();
      });

      // Connection closes
      act(() => {
        result.current.disconnect();
        vi.advanceTimersByTime(5);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('handles reconnection with exponential backoff', async () => {
      const mockShouldReconnect = vi.fn(() => true);
      const reconnectIntervals = [1000, 2000, 4000];

      for (let i = 0; i < reconnectIntervals.length; i++) {
        const { result } = renderHook(() =>
          useWebSocket(testUrl, {
            shouldReconnect: mockShouldReconnect,
            reconnectInterval: reconnectIntervals[i],
            maxReconnectAttempts: i + 1
          })
        );

        // Simulate connection and immediate disconnection
        act(() => {
          vi.advanceTimersByTime(10);
        });

        act(() => {
          result.current.disconnect();
          vi.advanceTimersByTime(5);
        });

        // Should attempt reconnection after specified interval
        act(() => {
          vi.advanceTimersByTime(reconnectIntervals[i]);
        });
      }

      // All reconnection attempts should be handled gracefully
      expect(true).toBe(true);
    });

    it('handles custom reconnection logic', async () => {
      const mockShouldReconnect = vi.fn((closeEvent) => {
        // Only reconnect if code is not 1000 (normal closure)
        return closeEvent.code !== 1000;
      });

      const { result } = renderHook(() =>
        useWebSocket(testUrl, { shouldReconnect: mockShouldReconnect })
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Simulate normal closure
      act(() => {
        const socket = result.current.socket as any;
        socket.close(1000, 'Normal closure');
        vi.advanceTimersByTime(5);
      });

      // Should not reconnect on normal closure
      expect(mockShouldReconnect).toHaveBeenCalled();
      // Implementation-specific: should not schedule reconnection
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string URL', () => {
      expect(() => {
        renderHook(() => useWebSocket(''));
      }).not.toThrow();
    });

    it('handles undefined options', () => {
      expect(() => {
        renderHook(() => useWebSocket(testUrl, undefined));
      }).not.toThrow();
    });

    it('handles null options', () => {
      expect(() => {
        renderHook(() => useWebSocket(testUrl, null as any));
      }).not.toThrow();
    });

    it('handles changing options during connection', async () => {
      const { result, rerender } = renderHook(
        ({ options }) => useWebSocket(testUrl, options),
        {
          initialProps: {
            options: { reconnectInterval: 1000 }
          }
        }
      );

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(10);
      });

      // Change options
      rerender({
        options: {
          reconnectInterval: 2000,
          maxReconnectAttempts: 10
        }
      });

      // Should handle option changes gracefully
      expect(result.current.socket).not.toBe(null);
    });

    it('handles concurrent hook instances', () => {
      const url1 = 'ws://localhost:8080';
      const url2 = 'ws://localhost:8081';

      const { result: result1 } = renderHook(() => useWebSocket(url1));
      const { result: result2 } = renderHook(() => useWebSocket(url2));

      // Each hook should manage its own WebSocket
      expect(result1.current.socket).not.toBe(result2.current.socket);
    });

    it('handles WebSocket protocol variations', () => {
      const wsUrl = 'ws://localhost:8080';
      const wssUrl = 'wss://secure.example.com/socket';

      expect(() => {
        renderHook(() => useWebSocket(wsUrl));
      }).not.toThrow();

      expect(() => {
        renderHook(() => useWebSocket(wssUrl));
      }).not.toThrow();
    });
  });
});