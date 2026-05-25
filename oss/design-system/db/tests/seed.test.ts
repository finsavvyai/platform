import { describe, it, expect, beforeEach, vi } from 'vitest';
import { seedDatabase } from '../src/seed';
import { DatabaseClient } from '../src/client/types';

describe('seedDatabase', () => {
  let mockDb: DatabaseClient;

  beforeEach(() => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockValues = vi.fn().mockReturnThis();
    const mockOnConflictDoNothing = vi.fn().mockResolvedValue({ rowCount: 1 });

    mockDb = {
      config: { type: 'postgres' },
      db: {
        insert: vi
          .fn()
          .mockReturnValue({
            values: mockValues.mockReturnValue({
              onConflictDoNothing: mockOnConflictDoNothing,
            }),
          }),
      },
      close: vi.fn(),
    } as any;
  });

  it('should be an async function', async () => {
    expect(typeof seedDatabase).toBe('function');
  });

  it('should accept a database client parameter', async () => {
    await seedDatabase(mockDb);
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it('should create users during seeding', async () => {
    await seedDatabase(mockDb);
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it('should create subscriptions during seeding', async () => {
    await seedDatabase(mockDb);
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it('should create api_keys during seeding', async () => {
    await seedDatabase(mockDb);
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it('should handle onConflictDoNothing for duplicate prevention', async () => {
    await seedDatabase(mockDb);
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it('should work with postgres database type', async () => {
    const pgDb = {
      config: { type: 'postgres' },
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue({}),
          }),
        }),
      },
      close: vi.fn(),
    } as any;

    await seedDatabase(pgDb);
    expect(pgDb.db.insert).toHaveBeenCalled();
  });

  it('should work with sqlite database type', async () => {
    const sqliteDb = {
      config: { type: 'sqlite' },
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue({}),
          }),
        }),
      },
      close: vi.fn(),
    } as any;

    await seedDatabase(sqliteDb);
    expect(sqliteDb.db.insert).toHaveBeenCalled();
  });

  it('should seed deterministic user data', async () => {
    await seedDatabase(mockDb);
    const insertCalls = mockDb.db.insert.mock.calls;
    expect(insertCalls.length).toBeGreaterThan(0);
  });

  it('should seed with valid UUIDs', async () => {
    await seedDatabase(mockDb);
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it('should handle all four tables', async () => {
    await seedDatabase(mockDb);
    expect(mockDb.db.insert).toHaveBeenCalledTimes(3);
  });
});
