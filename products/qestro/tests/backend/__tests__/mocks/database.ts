import { jest } from '@jest/globals';

// Mock database connection for tests
export const mockDatabase = {
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: 'test-id' }])
    })
  }),
  select: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([])
    })
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([])
    })
  }),
  delete: jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue([])
  }),
  query: jest.fn().mockResolvedValue([]),
  transaction: jest.fn().mockImplementation(async (callback: any) => {
    return await callback(mockDatabase);
  }),
};

// Mock drizzle database instance
export const mockDb = {
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
      execute: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
    }),
  }),
  select: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue([]),
      }),
      execute: jest.fn().mockResolvedValue([]),
    }),
    execute: jest.fn().mockResolvedValue([]),
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
        execute: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
      }),
      execute: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
    }),
  }),
  delete: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnValue({
      execute: jest.fn().mockResolvedValue([]),
    }),
  }),
  transaction: mockDatabase.transaction,
};

// Mock postgres connection
export const mockPostgres = jest.fn(() => ({
  unsafe: jest.fn().mockResolvedValue([]),
  end: jest.fn().mockResolvedValue(undefined),
  begin: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
}));

// Mock drizzle-orm functions
export const mockDrizzle = jest.fn(() => mockDb);

// Helper to reset all mocks
export const resetDatabaseMocks = () => {
  Object.values(mockDatabase).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });

  Object.values(mockDb).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });

  mockPostgres.mockClear();
  mockDrizzle.mockClear();
};