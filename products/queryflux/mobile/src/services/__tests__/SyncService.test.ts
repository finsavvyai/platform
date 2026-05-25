import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncService } from '../offline/SyncService';
import { SyncOperation, SyncConfig } from '../offline/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock fetch for network requests
global.fetch = jest.fn();

describe('SyncService', () => {
  let syncService: SyncService;
  let mockConfig: SyncConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      maxRetries: 3,
      retryDelay: 100, // Shorter for tests
      batchSize: 5,
      syncInterval: 1000, // Shorter for tests
      offlineStorageLimit: 1024 * 1024, // 1MB
    };

    syncService = new SyncService(mockConfig);
  });

  describe('Constructor', () => {
    test('initializes with default config', () => {
      const defaultService = new SyncService();
      expect(defaultService).toBeInstanceOf(SyncService);
    });

    test('initializes with custom config', () => {
      const customService = new SyncService(mockConfig);
      expect(customService).toBeInstanceOf(SyncService);
    });
  });

  describe('addSyncOperation', () => {
    test('adds a sync operation successfully', async () => {
      const operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'> = {
        type: 'create',
        endpoint: '/api/connections',
        data: { name: 'Test Connection' },
        method: 'POST',
        priority: 'normal',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]');
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const operationId = await syncService.addSyncOperation(operation);

      expect(operationId).toBeTruthy();
      expect(typeof operationId).toBe('string');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'sync_operations',
        expect.stringContaining('Test Connection')
      );
    });

    test('handles storage errors gracefully', async () => {
      const operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'> = {
        type: 'update',
        endpoint: '/api/connections/123',
        data: { name: 'Updated Connection' },
        method: 'PUT',
        priority: 'high',
      };

      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(syncService.addSyncOperation(operation)).rejects.toThrow('Storage error');
    });
  });

  describe('getPendingOperations', () => {
    test('returns empty array when no operations exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]');

      const operations = await syncService.getPendingOperations();

      expect(operations).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('sync_operations');
    });

    test('returns pending operations', async () => {
      const mockOperations: SyncOperation[] = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: { name: 'Test 1' },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
        {
          id: 'op2',
          type: 'update',
          endpoint: '/api/connections/123',
          data: { name: 'Test 2' },
          method: 'PUT',
          priority: 'high',
          timestamp: '2024-01-15T10:01:00Z',
          retryCount: 1,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));

      const operations = await syncService.getPendingOperations();

      expect(operations).toHaveLength(2);
      expect(operations[0].id).toBe('op1');
      expect(operations[1].id).toBe('op2');
    });

    test('handles corrupted data gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const operations = await syncService.getPendingOperations();

      expect(operations).toEqual([]);
    });
  });

  describe('removeSyncOperation', () => {
    test('removes operation successfully', async () => {
      const mockOperations: SyncOperation[] = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: { name: 'Test 1' },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
        {
          id: 'op2',
          type: 'update',
          endpoint: '/api/connections/123',
          data: { name: 'Test 2' },
          method: 'PUT',
          priority: 'high',
          timestamp: '2024-01-15T10:01:00Z',
          retryCount: 1,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await syncService.removeSyncOperation('op1');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'sync_operations',
        expect.stringContaining('op2')
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'sync_operations',
        expect.not.stringContaining('op1')
      );
    });

    test('handles non-existent operation', async () => {
      const mockOperations: SyncOperation[] = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: { name: 'Test 1' },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await syncService.removeSyncOperation('nonexistent');

      // Should not throw error
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('syncOperation', () => {
    test('successfully syncs POST operation', async () => {
      const operation: SyncOperation = {
        id: 'op1',
        type: 'create',
        endpoint: '/api/connections',
        data: { name: 'Test Connection' },
        method: 'POST',
        priority: 'normal',
        timestamp: '2024-01-15T10:00:00Z',
        retryCount: 0,
      };

      const mockResponse = {
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ id: 'conn123', name: 'Test Connection' }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncService.syncOperation(operation);

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        '/api/connections',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(operation.data),
        }
      );
    });

    test('successfully syncs GET operation', async () => {
      const operation: SyncOperation = {
        id: 'op2',
        type: 'read',
        endpoint: '/api/connections/123',
        data: {},
        method: 'GET',
        priority: 'normal',
        timestamp: '2024-01-15T10:00:00Z',
        retryCount: 0,
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 'conn123', name: 'Test Connection' }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncService.syncOperation(operation);

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        '/api/connections/123',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    });

    test('handles network error with retry', async () => {
      const operation: SyncOperation = {
        id: 'op1',
        type: 'create',
        endpoint: '/api/connections',
        data: { name: 'Test Connection' },
        method: 'POST',
        priority: 'normal',
        timestamp: '2024-01-15T10:00:00Z',
        retryCount: 0,
      };

      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await syncService.syncOperation(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.shouldRetry).toBe(true);
    });

    test('handles HTTP error status', async () => {
      const operation: SyncOperation = {
        id: 'op1',
        type: 'create',
        endpoint: '/api/connections',
        data: { name: 'Test Connection' },
        method: 'POST',
        priority: 'normal',
        timestamp: '2024-01-15T10:00:00Z',
        retryCount: 0,
      };

      const mockResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: 'Bad request' }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncService.syncOperation(operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 400');
      expect(result.shouldRetry).toBe(false); // Client errors shouldn't retry
    });

    test('handles server error with retry', async () => {
      const operation: SyncOperation = {
        id: 'op1',
        type: 'create',
        endpoint: '/api/connections',
        data: { name: 'Test Connection' },
        method: 'POST',
        priority: 'normal',
        timestamp: '2024-01-15T10:00:00Z',
        retryCount: 0,
      };

      const mockResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal server error' }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncService.syncOperation(operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
      expect(result.shouldRetry).toBe(true); // Server errors should retry
    });
  });

  describe('syncNow', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('syncs all pending operations', async () => {
      const mockOperations: SyncOperation[] = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: { name: 'Test 1' },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
        {
          id: 'op2',
          type: 'update',
          endpoint: '/api/connections/123',
          data: { name: 'Test 2' },
          method: 'PUT',
          priority: 'high',
          timestamp: '2024-01-15T10:01:00Z',
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncService.syncNow();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('handles partial sync failure', async () => {
      const mockOperations: SyncOperation[] = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: { name: 'Test 1' },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
        {
          id: 'op2',
          type: 'update',
          endpoint: '/api/connections/123',
          data: { name: 'Test 2' },
          method: 'PUT',
          priority: 'high',
          timestamp: '2024-01-15T10:01:00Z',
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      // First operation succeeds
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ success: true }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await syncService.syncNow();

      expect(result).toBe(false); // Partial failure
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('respects retry delay for failed operations', async () => {
      const mockOperations: SyncOperation[] = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: { name: 'Test 1' },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const syncPromise = syncService.syncNow();

      // Should not complete immediately due to retry delay
      await jest.advanceTimersByTime(50);
      await expect(Promise.race([syncPromise, Promise.resolve('pending')])).resolves.toBe('pending');

      // Should complete after retry delay
      await jest.advanceTimersByTime(50);
      await expect(syncPromise).resolves.toBe(false);
    });

    test('processes operations in batches', async () => {
      // Create more operations than batch size
      const mockOperations: SyncOperation[] = [];
      for (let i = 0; i < 10; i++) {
        mockOperations.push({
          id: `op${i}`,
          type: 'create',
          endpoint: '/api/connections',
          data: { name: `Test ${i}` },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        });
      }

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncService.syncNow();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(10); // All operations should be processed
    });
  });

  describe('clearAllOperations', () => {
    test('clears all sync operations', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await syncService.clearAllOperations();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('sync_operations', '[]');
    });

    test('handles storage errors during clear', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(syncService.clearAllOperations()).rejects.toThrow('Storage error');
    });
  });

  describe('getSyncStats', () => {
    test('returns correct sync statistics', async () => {
      const mockOperations: SyncOperation[] = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: { name: 'Test 1' },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
        {
          id: 'op2',
          type: 'update',
          endpoint: '/api/connections/123',
          data: { name: 'Test 2' },
          method: 'PUT',
          priority: 'high',
          timestamp: '2024-01-15T10:01:00Z',
          retryCount: 2,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));

      const stats = await syncService.getSyncStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.byType.create).toBe(1);
      expect(stats.byType.update).toBe(1);
      expect(stats.byPriority.normal).toBe(1);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.averageRetries).toBe(1); // (0 + 2) / 2
    });

    test('handles empty operations list', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]');

      const stats = await syncService.getSyncStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byPriority).toEqual({});
      expect(stats.averageRetries).toBe(0);
    });
  });

  describe('isSyncing', () => {
    test('returns correct sync status', () => {
      expect(syncService.isSyncing()).toBe(false);
    });

    test('updates sync status during sync operation', async () => {
      const mockOperations: SyncOperation[] = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: { name: 'Test 1' },
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockOperations));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const syncPromise = syncService.syncNow();

      // Should be syncing during operation
      expect(syncService.isSyncing()).toBe(true);

      await syncPromise;

      // Should not be syncing after completion
      expect(syncService.isSyncing()).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles malformed operation data', async () => {
      const malformedOperations = [
        {
          id: 'op1',
          type: 'create',
          endpoint: '/api/connections',
          data: null, // Malformed data
          method: 'POST',
          priority: 'normal',
          timestamp: '2024-01-15T10:00:00Z',
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(malformedOperations));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const result = await syncService.syncNow();

      expect(result).toBe(false); // Should fail gracefully
    });

    test('handles operation with missing required fields', async () => {
      const incompleteOperation = {
        id: 'op1',
        type: 'create',
        // Missing endpoint, method, etc.
        timestamp: '2024-01-15T10:00:00Z',
        retryCount: 0,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([incompleteOperation]));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const result = await syncService.syncNow();

      expect(result).toBe(false); // Should fail gracefully
    });

    test('respects maximum retry limit', async () => {
      const operation: SyncOperation = {
        id: 'op1',
        type: 'create',
        endpoint: '/api/connections',
        data: { name: 'Test Connection' },
        method: 'POST',
        priority: 'normal',
        timestamp: '2024-01-15T10:00:00Z',
        retryCount: 3, // Already at max retries
      };

      const result = await syncService.syncOperation(operation);

      expect(result.success).toBe(false);
      expect(result.shouldRetry).toBe(false); // Should not retry
      expect(result.error).toContain('Maximum retries exceeded');
    });
  });
});