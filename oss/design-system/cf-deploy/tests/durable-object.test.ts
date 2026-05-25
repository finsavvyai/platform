import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DurableObjectBase } from '../src/durable-object/base';
import type { DurableObjectState, DurableObjectStorage } from '../src/durable-object/base';

describe('DurableObjectBase', () => {
  let mockStorage: Partial<DurableObjectStorage>;
  let state: DurableObjectState;
  let durable: DurableObjectBase;

  beforeEach(() => {
    mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue(new Map()),
    };

    state = {
      storage: mockStorage as DurableObjectStorage,
      id: 'do-123',
      blockConcurrencyWhile: vi.fn(),
    };

    durable = new DurableObjectBase(state);
  });

  it('should get state from storage', async () => {
    const value = { counter: 42 };
    (mockStorage.get as any).mockResolvedValueOnce(value);

    const result = await durable.getState<{ counter: number }>('key');

    expect(result).toEqual(value);
    expect(mockStorage.get).toHaveBeenCalledWith('key');
  });

  it('should return null when state not found', async () => {
    (mockStorage.get as any).mockResolvedValueOnce(null);

    const result = await durable.getState('missing');

    expect(result).toBeNull();
  });

  it('should set state in storage', async () => {
    const value = { counter: 42 };

    await durable.setState('key', value);

    expect(mockStorage.put).toHaveBeenCalledWith('key', value);
  });

  it('should delete state from storage', async () => {
    const result = await durable.deleteState('key');

    expect(result).toBe(true);
    expect(mockStorage.delete).toHaveBeenCalledWith('key');
  });

  it('should list all state', async () => {
    const map = new Map([['key1', 'val1'], ['key2', 'val2']]);
    (mockStorage.list as any).mockResolvedValueOnce(map);

    const result = await durable.listState();

    expect(result).toEqual(map);
    expect(mockStorage.list).toHaveBeenCalled();
  });

  it('should return durable object ID', () => {
    const id = durable.getId();

    expect(id).toBe('do-123');
  });

  it('should preserve type when getting state', async () => {
    const user = { id: 1, name: 'John', email: 'john@example.com' };
    (mockStorage.get as any).mockResolvedValueOnce(user);

    const result = await durable.getState<typeof user>('user:1');

    expect(result?.name).toBe('John');
  });

  it('should handle complex state objects', async () => {
    const complex = {
      data: { nested: { value: 123 } },
      array: [1, 2, 3],
      timestamp: new Date().toISOString(),
    };

    await durable.setState('complex', complex);

    expect(mockStorage.put).toHaveBeenCalledWith('complex', complex);
  });

  it('should handle multiple state operations', async () => {
    (mockStorage.get as any).mockResolvedValueOnce(null);
    (mockStorage.put as any).mockResolvedValue(undefined);
    (mockStorage.delete as any).mockResolvedValue(true);

    await durable.setState('k1', 'v1');
    await durable.setState('k2', 'v2');
    const result = await durable.getState('k1');
    await durable.deleteState('k1');

    expect(mockStorage.put).toHaveBeenCalledTimes(2);
    expect(mockStorage.delete).toHaveBeenCalledWith('k1');
  });
});
