import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useZeroSyncState, useZeroSyncCollection } from '../../../../../frontend/src/hooks/useZeroSyncState';

// Mock the ZeroSync context
const mockZeroSync = {
  subscribe: vi.fn(),
  setState: vi.fn(),
  isConnected: true,
  pendingOperations: new Map(),
};

vi.mock('../../../../../frontend/src/contexts/ZeroSyncContext', () => ({
  useZeroSync: () => mockZeroSync,
}));

describe('useZeroSyncState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to state changes on mount', () => {
    const unsubscribe = vi.fn();
    mockZeroSync.subscribe.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useZeroSyncState('test-path'));

    expect(mockZeroSync.subscribe).toHaveBeenCalledWith('test-path', expect.any(Function));

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('updates local state when remote state changes', () => {
    let stateCallback: (data: any) => void;
    mockZeroSync.subscribe.mockImplementation((path, callback) => {
      stateCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useZeroSyncState('test-path'));

    act(() => {
      stateCallback('new value');
    });

    expect(result.current[0]).toBe('new value');
  });

  it('updates state optimistically', async () => {
    mockZeroSync.setState.mockResolvedValue('op-id');
    mockZeroSync.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useZeroSyncState('test-path'));

    await act(async () => {
      await result.current[1]('new value');
    });

    expect(mockZeroSync.setState).toHaveBeenCalledWith('test-path', 'new value', true);
  });

  it('shows loading state during updates', async () => {
    let resolveSetState: (value: string) => void;
    const setStatePromise = new Promise<string>((resolve) => {
      resolveSetState = resolve;
    });
    
    mockZeroSync.setState.mockReturnValue(setStatePromise);
    mockZeroSync.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useZeroSyncState('test-path'));

    act(() => {
      result.current[1]('new value');
    });

    expect(result.current[2]).toBe(true); // isLoading should be true

    await act(async () => {
      resolveSetState!('op-id');
      await setStatePromise;
    });

    expect(result.current[2]).toBe(false); // isLoading should be false
  });

  it('uses initial value when provided', () => {
    mockZeroSync.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => 
      useZeroSyncState('test-path', { initialValue: 'initial' })
    );

    expect(result.current[0]).toBe('initial');
  });

  it('indicates pending operations', () => {
    mockZeroSync.subscribe.mockReturnValue(vi.fn());
    mockZeroSync.pendingOperations.set('op-1', { path: 'test-path' });

    const { result } = renderHook(() => useZeroSyncState('test-path'));

    expect(result.current[2]).toBe(true); // should show loading due to pending operations
  });
});

describe('useZeroSyncCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty array', () => {
    mockZeroSync.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useZeroSyncCollection('test-collection'));

    expect(result.current.items).toEqual([]);
  });

  it('adds items to collection', async () => {
    let stateCallback: (data: any) => void;
    mockZeroSync.subscribe.mockImplementation((path, callback) => {
      stateCallback = callback;
      return vi.fn();
    });
    mockZeroSync.setState.mockResolvedValue('op-id');

    const { result } = renderHook(() => useZeroSyncCollection('test-collection'));

    // Set initial state
    act(() => {
      stateCallback([{ id: '1', name: 'Item 1' }]);
    });

    // Add new item
    await act(async () => {
      await result.current.add({ id: '2', name: 'Item 2' });
    });

    expect(mockZeroSync.setState).toHaveBeenCalledWith(
      'test-collection',
      [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ]
    );
  });

  it('updates items in collection', async () => {
    let stateCallback: (data: any) => void;
    mockZeroSync.subscribe.mockImplementation((path, callback) => {
      stateCallback = callback;
      return vi.fn();
    });
    mockZeroSync.setState.mockResolvedValue('op-id');

    const { result } = renderHook(() => useZeroSyncCollection('test-collection'));

    // Set initial state
    act(() => {
      stateCallback([
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ]);
    });

    // Update item
    await act(async () => {
      await result.current.update('1', { name: 'Updated Item 1' });
    });

    expect(mockZeroSync.setState).toHaveBeenCalledWith(
      'test-collection',
      [
        { id: '1', name: 'Updated Item 1' },
        { id: '2', name: 'Item 2' }
      ]
    );
  });

  it('removes items from collection', async () => {
    let stateCallback: (data: any) => void;
    mockZeroSync.subscribe.mockImplementation((path, callback) => {
      stateCallback = callback;
      return vi.fn();
    });
    mockZeroSync.setState.mockResolvedValue('op-id');

    const { result } = renderHook(() => useZeroSyncCollection('test-collection'));

    // Set initial state
    act(() => {
      stateCallback([
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ]);
    });

    // Remove item
    await act(async () => {
      await result.current.remove('1');
    });

    expect(mockZeroSync.setState).toHaveBeenCalledWith(
      'test-collection',
      [{ id: '2', name: 'Item 2' }]
    );
  });

  it('handles empty collection operations', async () => {
    mockZeroSync.subscribe.mockReturnValue(vi.fn());
    mockZeroSync.setState.mockResolvedValue('op-id');

    const { result } = renderHook(() => useZeroSyncCollection('test-collection'));

    // Add to empty collection
    await act(async () => {
      await result.current.add({ id: '1', name: 'First Item' });
    });

    expect(mockZeroSync.setState).toHaveBeenCalledWith(
      'test-collection',
      [{ id: '1', name: 'First Item' }]
    );
  });
});