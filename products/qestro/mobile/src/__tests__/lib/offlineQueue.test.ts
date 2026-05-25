import { getQueue, enqueue, dequeue, clearQueue, cacheResponse, getCachedResponse } from '@/lib/offlineQueue';

describe('offlineQueue', () => {
  beforeEach(() => { clearQueue(); });

  it('should return empty queue initially', () => {
    expect(getQueue()).toEqual([]);
  });

  it('should enqueue a request', () => {
    enqueue({ url: '/api/test', method: 'POST', body: '{}' });
    const queue = getQueue();
    expect(queue).toHaveLength(1);
    const firstItem = queue[0];
    expect(firstItem).toBeDefined();
    expect(firstItem!.url).toBe('/api/test');
    expect(firstItem!.method).toBe('POST');
  });

  it('should dequeue by id', () => {
    enqueue({ url: '/api/a', method: 'GET' });
    enqueue({ url: '/api/b', method: 'GET' });
    const queue = getQueue();
    const firstItem = queue[0];
    expect(firstItem).toBeDefined();
    dequeue(firstItem!.id);
    expect(getQueue()).toHaveLength(1);
    const remainingItem = getQueue()[0];
    expect(remainingItem).toBeDefined();
    expect(remainingItem!.url).toBe('/api/b');
  });

  it('should clear entire queue', () => {
    enqueue({ url: '/api/a', method: 'GET' });
    enqueue({ url: '/api/b', method: 'GET' });
    clearQueue();
    expect(getQueue()).toEqual([]);
  });
});

describe('responseCache', () => {
  it('should cache and retrieve a response', () => {
    cacheResponse('dashboard', { totalTests: 42 });
    const cached = getCachedResponse<{ totalTests: number }>('dashboard');
    expect(cached?.totalTests).toBe(42);
  });

  it('should return null for missing cache', () => {
    expect(getCachedResponse('nonexistent')).toBeNull();
  });

  it('should return null for expired cache', () => {
    cacheResponse('old', { data: 1 });
    // maxAge of -1 ensures cache is always expired
    const cached = getCachedResponse('old', -1);
    expect(cached).toBeNull();
  });
});
