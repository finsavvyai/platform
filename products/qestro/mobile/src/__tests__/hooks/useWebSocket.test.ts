import { renderHook } from '@testing-library/react-native';
import { useWebSocket } from '@/hooks/useWebSocket';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  close = jest.fn();
  send = jest.fn();
  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
}

(global as unknown as Record<string, unknown>).WebSocket = MockWebSocket;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

describe('useWebSocket', () => {
  it('should start disconnected when autoConnect is false', () => {
    const { result } = renderHook(() => useWebSocket({ path: '/ws/test', autoConnect: false }));
    expect(result.current.isConnected).toBe(false);
  });

  it('should provide send and disconnect functions', () => {
    const { result } = renderHook(() => useWebSocket({ path: '/ws/test', autoConnect: false }));
    expect(typeof result.current.send).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.connect).toBe('function');
  });

  it('should have null lastMessage initially', () => {
    const { result } = renderHook(() => useWebSocket({ path: '/ws/test', autoConnect: false }));
    expect(result.current.lastMessage).toBeNull();
  });
});
