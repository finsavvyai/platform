import { describe, it, expect, vi } from 'vitest';
import { InMemoryKv } from './kv-mem.js';

describe('InMemoryKv', () => {
  it('returns null for missing key', async () => {
    const kv = new InMemoryKv();
    expect(await kv.get('missing')).toBeNull();
  });

  it('honours expirationTtl by clearing expired rows', async () => {
    const kv = new InMemoryKv();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await kv.put('a', '1', { expirationTtl: 1 });
    expect(await kv.get('a')).toBe('1');
    vi.setSystemTime(new Date('2026-01-01T00:00:05Z'));
    expect(await kv.get('a')).toBeNull();
    vi.useRealTimers();
  });

  it('deletes a key explicitly', async () => {
    const kv = new InMemoryKv();
    await kv.put('a', '1');
    await kv.delete('a');
    expect(await kv.get('a')).toBeNull();
  });

  it('stores indefinitely with no TTL', async () => {
    const kv = new InMemoryKv();
    await kv.put('forever', 'x');
    expect(await kv.get('forever')).toBe('x');
  });
});
