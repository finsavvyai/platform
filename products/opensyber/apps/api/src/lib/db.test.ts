import { describe, it, expect, vi } from 'vitest';

// Mock drizzle-orm/d1
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({ mockDrizzle: true })),
}));

import { createDb } from './db.js';

describe('createDb', () => {
  it('creates a drizzle instance from a D1Database', () => {
    const mockD1 = {} as D1Database;
    const db = createDb(mockD1);
    expect(db).toBeDefined();
    expect((db as any).mockDrizzle).toBe(true);
  });
});
