/**
 * Test Data Management System Test Suite
 *
 * Comprehensive test coverage for test data cleanup, archival,
 * and management functionality in the Questro platform.
 *
 * Test Coverage Areas:
 * - Data retention policy enforcement
 * - Automated cleanup procedures
 * - Data archival and restoration
 * - Performance with large datasets
 * - Error handling and recovery
 * - Environment isolation
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestDataManager, createTestDataManager, initializeTestDataManager } from '../src/services/test-data-manager';
import type { DataRetentionPolicy, DataCleanupConfig, DataCleanupResult } from '../src/services/test-data-manager';

// Mock D1 database
const mockD1Database = {
  prepare: jest.fn(),
  batch: jest.fn(),
  exec: jest.fn()
} as any;

// Mock drizzle database
const mockDb = {
  prepare: jest.fn(),
  batch: jest.fn(),
  run: jest.fn(),
  first: jest.fn(),
  all: jest.fn()
} as any;

// Mock console methods to test logging
const originalConsole = global.console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
});

afterEach(() => {
  global.console = originalConsole;
  jest.clearAllMocks();
});

describe('TestDataManager', () => {
  let testDataManager: TestDataManager;
  let mockConfig: Partial<DataCleanupConfig>;

  beforeEach(() => {
    mockConfig = {
      enableAutomaticCleanup: true,
      cleanupSchedule: '0 2 * * *',
      batchSize: 100,
      dryRun: false
    };

    // Reset all mock functions
    Object.values(mockD1Database).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockReset();
      }
    });

    testDataManager = new TestDataManager(mockD1Database, mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const manager = new TestDataManager(mockD1Database);
      expect(manager).toBeDefined();
      expect(manager['config'].batchSize).toBe(1000);
      expect(manager['config'].enableAutomaticCleanup).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        batchSize: 500,
        dryRun: true,
        enableAutomaticCleanup: false
      };

      const manager = new TestDataManager(mockD1Database, customConfig);
      expect(manager['config'].batchSize).toBe(500);
      expect(manager['config'].dryRun).toBe(true);
      expect(manager['config'].enableAutomaticCleanup).toBe(false);
    });

    it('should initialize default retention policies', () => {
      const policies = testDataManager.getAllRetentionPolicy();
      expect(policies.length).toBeGreaterThan(0);

      const testResultsPolicy = policies.find(p => p.entityType === 'test_results');
      expect(testResultsPolicy).toBeDefined();
      expect(testResultsPolicy!.retentionDays).toBe(90);
      expect(testResultsPolicy!.archiveRetentionDays).toBe(365);
    });
  });

  describe('Data Cleanup Operations', () => {
    it('should perform cleanup for all entity types', async () => {
      // Mock database responses
      mockD1Database.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({
            results: [
              { id: '1', created_at: '2023-01-01T00:00:00Z' },
              { id: '2', created_at: '2023-01-02T00:00:00Z' }
            ]
          })
        })
      });

      const results = await testDataManager.performDataCleanup({ dryRun: true });

      expect(results).toHaveLength(6); // 6 default entity types
      expect(console.log).toHaveBeenCalledWith('🧹 Starting data cleanup (dry run: true)...');
      expect(console.log).toHaveBeenCalledWith('🎉 Data cleanup completed');
    });

    it('should perform cleanup for specific entity types', async () => {
      mockD1Database.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: [] })
        })
      });

      const results = await testDataManager.performDataCleanup({
        dryRun: true,
        entityTypes: ['test_results']
      });

      expect(results).toHaveLength(1);
      expect(results[0].entityType).toBe('test_results');
    });

    it('should handle errors during cleanup gracefully', async () => {
      mockD1Database.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const results = await testDataManager.performDataCleanup({ dryRun: true });

      expect(results).toHaveLength(6);
      expect(results[0].errors).toHaveLength(1);
      expect(console.error).toHaveBeenCalledWith('❌ Error cleaning up test_results:', expect.any(Error));
    });

    it('should calculate cleanup statistics correctly', async () => {
      const mockRecords = [
        { id: '1', created_at: '2023-01-01T00:00:00Z' },
        { id: '2', created_at: '2023-01-02T00:00:00Z' }
      ];

      mockD1Database.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: mockRecords })
        })
      });

      const results = await testDataManager.performDataCleanup({ dryRun: true });

      results.forEach(result => {
        expect(result.recordsDeleted).toBeGreaterThanOrEqual(0);
        expect(result.recordsArchived).toBeGreaterThanOrEqual(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });
  });

  describe('Retention Policy Management', () => {
    it('should update retention policies', () => {
      const entityType = 'test_results';
      const updatedPolicy = {
        retentionDays: 60,
        priority: 'high' as const
      };

      testDataManager.updateRetentionPolicy(entityType, updatedPolicy);
      const policy = testDataManager.getRetentionPolicy(entityType);

      expect(policy?.retentionDays).toBe(60);
      expect(policy?.priority).toBe('high');
    });

    it('should retrieve specific retention policy', () => {
      const policy = testDataManager.getRetentionPolicy('test_results');
      expect(policy).toBeDefined();
      expect(policy!.entityType).toBe('test_results');
    });

    it('should return undefined for non-existent policy', () => {
      const policy = testDataManager.getRetentionPolicy('non_existent_type');
      expect(policy).toBeUndefined();
    });

    it('should retrieve all retention policies', () => {
      const policies = testDataManager.getAllRetentionPolicy();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);
    });
  });

  describe('Storage Statistics', () => {
    it('should retrieve storage statistics', async () => {
      // Mock database responses for statistics
      mockD1Database.prepare
        .mockReturnValueOnce({
          bind: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue({ count: 100 })
          })
        })
        .mockReturnValueOnce({
          bind: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue({ oldest: '2023-01-01T00:00:00Z' })
          })
        });

      const stats = await testDataManager.getStorageStatistics();

      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('entityTypeBreakdown');
      expect(stats).toHaveProperty('archivalStats');
      expect(stats).toHaveProperty('retentionCompliance');
      expect(stats.totalRecords).toBeGreaterThan(0);
    });

    it('should handle errors in statistics collection', async () => {
      mockD1Database.prepare.mockImplementation(() => {
        throw new Error('Query failed');
      });

      const stats = await testDataManager.getStorageStatistics();

      expect(stats.totalRecords).toBe(0);
      expect(Object.keys(stats.entityTypeBreakdown)).toHaveLength(0);
    });
  });

  describe('Data Archival', () => {
    it('should archive records before deletion', async () => {
      const records = [
        { id: '1', created_at: '2023-01-01T00:00:00Z', data: 'test data' }
      ];

      // Mock archive storage
      testDataManager['storeArchiveData'] = jest.fn().mockResolvedValue(undefined);

      await testDataManager['archiveRecords']('test_results', records, false);

      expect(testDataManager['storeArchiveData']).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'test_results',
          recordIds: ['1'],
          reason: 'retention_policy_cleanup'
        })
      );
    });

    it('should handle archival in dry run mode', async () => {
      const records = [
        { id: '1', created_at: '2023-01-01T00:00:00Z' }
      ];

      await testDataManager['archiveRecords']('test_results', records, true);

      expect(console.log).toHaveBeenCalledWith('📦 Would archive 1 records for test_results');
    });
  });

  describe('Data Restoration', () => {
    it('should restore archived data successfully', async () => {
      const archiveId = 'archive-123456789';

      const result = await testDataManager.restoreArchivedData(archiveId);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(`🔄 Restoring archived data for archive: ${archiveId}`);
      expect(console.log).toHaveBeenCalledWith('✅ Data restoration completed successfully');
    });

    it('should handle restoration errors gracefully', async () => {
      // Mock implementation that throws error
      testDataManager['restoreArchivedData'] = jest.fn().mockImplementation(async () => {
        throw new Error('Archive not found');
      });

      const result = await testDataManager.restoreArchivedData('invalid-archive-id');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('❌ Error restoring archived data:', expect.any(Error));
    });
  });

  describe('Automatic Cleanup Setup', () => {
    it('should setup automatic cleanup when enabled', () => {
      const manager = new TestDataManager(mockD1Database, {
        enableAutomaticCleanup: true
      });

      manager.setupAutomaticCleanup();

      expect(console.log).toHaveBeenCalledWith('⏰ Setting up automatic cleanup with schedule: 0 2 * * *');
      expect(console.log).toHaveBeenCalledWith('✅ Automatic cleanup scheduled successfully');
    });

    it('should skip automatic cleanup when disabled', () => {
      const manager = new TestDataManager(mockD1Database, {
        enableAutomaticCleanup: false
      });

      manager.setupAutomaticCleanup();

      expect(console.log).toHaveBeenCalledWith('⏸️  Automatic cleanup is disabled');
    });
  });

  describe('Data Compression and Utilities', () => {
    it('should compress data for archival', () => {
      const testData = [
        { id: '1', data: 'sample data' },
        { id: '2', data: 'more sample data' }
      ];

      const compressed = testDataManager['compressData'](testData);

      expect(typeof compressed).toBe('string');
      expect(compressed).toContain('sample data');
    });

    it('should map entity types to table names correctly', () => {
      const tableName = testDataManager['getTableNameForEntityType']('test_results');
      expect(tableName).toBe('test_results');

      const customTableName = testDataManager['getTableNameForEntityType']('custom_entity');
      expect(customTableName).toBe('custom_entity');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing entity type gracefully', async () => {
      const results = await testDataManager.performDataCleanup({
        dryRun: true,
        entityTypes: ['non_existent_type']
      });

      expect(results).toHaveLength(1);
      expect(console.warn).toHaveBeenCalledWith('⚠️  No retention policy found for entity type: non_existent_type');
    });

    it('should handle empty cleanup results', async () => {
      mockD1Database.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: [] })
        })
      });

      const results = await testDataManager.performDataCleanup({ dryRun: true });

      results.forEach(result => {
        expect(result.recordsDeleted).toBe(0);
        expect(result.recordsArchived).toBe(0);
      });
    });

    it('should handle database connection failures', async () => {
      mockD1Database.prepare.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      const results = await testDataManager.performDataCleanup({ dryRun: true });

      expect(results).toHaveLength(6);
      results.forEach(result => {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Connection timeout');
      });
    });

    it('should handle invalid archive IDs', async () => {
      const result = await testDataManager.restoreArchivedData('');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Performance Testing', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
        id: `record-${i}`,
        created_at: '2023-01-01T00:00:00Z',
        data: `Sample data ${i}`
      }));

      mockD1Database.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: largeDataSet })
        })
      });

      const startTime = Date.now();
      const results = await testDataManager.performDataCleanup({ dryRun: true });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results).toHaveLength(6);
    });

    it('should handle batch processing correctly', async () => {
      const manager = new TestDataManager(mockD1Database, { batchSize: 100 });
      const largeDataSet = Array.from({ length: 250 }, (_, i) => ({
        id: `record-${i}`,
        created_at: '2023-01-01T00:00:00Z'
      }));

      mockD1Database.prepare.mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: largeDataSet })
        })
      });

      await manager.performDataCleanup({ dryRun: true });

      // Should process data in batches without memory issues
      expect(mockD1Database.prepare).toHaveBeenCalledTimes(6); // 6 entity types
    });
  });

  describe('Integration Tests', () => {
    it('should integrate with database operations end-to-end', async () => {
      // Mock realistic database behavior
      mockD1Database.prepare.mockImplementation((query: string) => ({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({
            results: [
              { id: '1', created_at: '2023-01-01T00:00:00Z', status: 'completed' },
              { id: '2', created_at: '2023-01-02T00:00:00Z', status: 'failed' }
            ]
          }),
          first: jest.fn().mockResolvedValue({ count: 100 }),
          run: jest.fn().mockResolvedValue({ success: true })
        })
      }));

      // Perform full cleanup workflow
      const cleanupResults = await testDataManager.performDataCleanup({ dryRun: false });
      const stats = await testDataManager.getStorageStatistics();

      expect(cleanupResults).toHaveLength(6);
      expect(stats.totalRecords).toBeGreaterThan(0);
      expect(console.log).toHaveBeenCalledWith('🎉 Data cleanup completed');
    });

    it('should maintain data integrity during operations', async () => {
      const testRecords = [
        { id: '1', created_at: '2023-01-01T00:00:00Z', data: 'important data' }
      ];

      // Test that data is not corrupted during archival/compression
      testDataManager['storeArchiveData'] = jest.fn();
      await testDataManager['archiveRecords']('test_results', testRecords, false);

      const archiveCall = testDataManager['storeArchiveData'].mock.calls[0][0];
      expect(archiveCall.recordIds).toEqual(['1']);
      expect(archiveCall.entityType).toBe('test_results');
      expect(archiveCall.metadata.recordCount).toBe(1);
    });
  });
});

describe('Factory Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create test data manager using factory function', () => {
    const manager = createTestDataManager(mockD1Database);
    expect(manager).toBeInstanceOf(TestDataManager);
  });

  it('should initialize global test data manager', () => {
    const manager = initializeTestDataManager(mockD1Database);
    expect(manager).toBeInstanceOf(TestDataManager);
  });

  it('should throw error when getting uninitialized global manager', () => {
    // Clear any existing global manager
    (global as any).globalTestDataManager = null;

    expect(() => getTestDataManager()).toThrow('Test data manager not initialized');
  });

  it('should return global manager when initialized', () => {
    const manager = initializeTestDataManager(mockD1Database);
    const retrieved = getTestDataManager();

    expect(retrieved).toBe(manager);
  });
});

describe('Mock D1 Database Validation', () => {
  it('should validate mock database structure', () => {
    expect(mockD1Database.prepare).toBeDefined();
    expect(typeof mockD1Database.prepare).toBe('function');
  });

  it('should handle mock database operations correctly', () => {
    const mockPrepare = jest.fn().mockReturnValue({
      bind: jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue({ results: [] }),
        first: jest.fn().mockResolvedValue(null),
        run: jest.fn().mockResolvedValue({ success: true })
      })
    });

    mockD1Database.prepare = mockPrepare;
    const result = mockD1Database.prepare('SELECT * FROM test_table');

    expect(result).toBeDefined();
    expect(result.bind).toBeDefined();
    expect(typeof result.bind).toBe('function');
  });
});

/**
 * Performance Benchmark Tests
 * These tests help establish performance baselines
 */
describe('Performance Benchmarks', () => {
  let testDataManager: TestDataManager;

  beforeEach(() => {
    testDataManager = new TestDataManager(mockD1Database, {
      batchSize: 1000,
      enableAutomaticCleanup: true
    });
  });

  it('should meet performance standards for cleanup operations', async () => {
    // Setup mock for large dataset
    mockD1Database.prepare.mockReturnValue({
      bind: jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue({
          results: Array.from({ length: 5000 }, (_, i) => ({
            id: `record-${i}`,
            created_at: '2023-01-01T00:00:00Z'
          }))
        })
      })
    });

    const startTime = performance.now();
    await testDataManager.performDataCleanup({ dryRun: true });
    const endTime = performance.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

    console.log(`Cleanup performance: ${duration.toFixed(2)}ms for 5000 records`);
  });

  it('should maintain performance under concurrent operations', async () => {
    mockD1Database.prepare.mockReturnValue({
      bind: jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue({ results: [] })
      })
    });

    const concurrentOperations = Array.from({ length: 10 }, () =>
      testDataManager.performDataCleanup({ dryRun: true })
    );

    const startTime = performance.now();
    await Promise.all(concurrentOperations);
    const endTime = performance.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(15000); // 10 concurrent operations within 15 seconds

    console.log(`Concurrent cleanup performance: ${duration.toFixed(2)}ms for 10 operations`);
  });
});
