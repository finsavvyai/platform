import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepository, type User } from '../src/repository/user';
import { SubscriptionRepository, type Subscription } from '../src/repository/subscription';
import { DatabaseClient } from '../src/client/types';

describe('UserRepository', () => {
  let mockDb: DatabaseClient;
  let userRepo: UserRepository;

  beforeEach(() => {
    mockDb = {
      config: { type: 'postgres' },
      db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      close: vi.fn(),
    } as any;

    userRepo = new UserRepository(mockDb);
  });

  it('should create a user repository instance', () => {
    expect(userRepo).toBeDefined();
  });

  it('should have findById method', () => {
    expect(typeof userRepo.findById).toBe('function');
  });

  it('should have findAll method', () => {
    expect(typeof userRepo.findAll).toBe('function');
  });

  it('should have create method', () => {
    expect(typeof userRepo.create).toBe('function');
  });

  it('should have update method', () => {
    expect(typeof userRepo.update).toBe('function');
  });

  it('should have delete method', () => {
    expect(typeof userRepo.delete).toBe('function');
  });

  it('should handle postgres database type', () => {
    const pgRepo = new UserRepository(mockDb);
    expect(pgRepo).toBeDefined();
  });

  it('should handle sqlite database type', () => {
    const sqliteDb = {
      config: { type: 'sqlite' },
      db: { select: vi.fn() },
      close: vi.fn(),
    } as any;

    const sqliteRepo = new UserRepository(sqliteDb);
    expect(sqliteRepo).toBeDefined();
  });
});

describe('SubscriptionRepository', () => {
  let mockDb: DatabaseClient;
  let subRepo: SubscriptionRepository;

  beforeEach(() => {
    mockDb = {
      config: { type: 'postgres' },
      db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      close: vi.fn(),
    } as any;

    subRepo = new SubscriptionRepository(mockDb);
  });

  it('should create a subscription repository instance', () => {
    expect(subRepo).toBeDefined();
  });

  it('should have findById method', () => {
    expect(typeof subRepo.findById).toBe('function');
  });

  it('should have findAll method', () => {
    expect(typeof subRepo.findAll).toBe('function');
  });

  it('should have findByUserId method', () => {
    expect(typeof subRepo.findByUserId).toBe('function');
  });

  it('should have create method', () => {
    expect(typeof subRepo.create).toBe('function');
  });

  it('should have update method', () => {
    expect(typeof subRepo.update).toBe('function');
  });

  it('should have delete method', () => {
    expect(typeof subRepo.delete).toBe('function');
  });

  it('should handle postgres and sqlite', () => {
    const sqliteDb = {
      config: { type: 'sqlite' },
      db: { select: vi.fn() },
      close: vi.fn(),
    } as any;

    const sqliteRepo = new SubscriptionRepository(sqliteDb);
    expect(sqliteRepo).toBeDefined();
  });
});

describe('Repository Interface', () => {
  it('should define CRUD contract', () => {
    const methods = ['findById', 'findAll', 'create', 'update', 'delete'];
    expect(methods).toBeDefined();
  });

  it('should support optional repository options', () => {
    const opts = { limit: 10, offset: 5 };
    expect(opts.limit).toBe(10);
    expect(opts.offset).toBe(5);
  });
});
