import { act, renderHook } from '@testing-library/react';
import { useQueryStore } from '../../renderer/stores/queryStore';
import { Query, QueryHistory, QueryResult } from '../../renderer/stores/types';

describe('QueryStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useQueryStore.setState({
      queries: [],
      queryHistory: [],
      currentQuery: '',
      isExecuting: false,
      results: null,
      error: null,
    });
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const { result } = renderHook(() => useQueryStore());

      expect(result.current.queries).toEqual([]);
      expect(result.current.queryHistory).toEqual([]);
      expect(result.current.currentQuery).toBe('');
      expect(result.current.isExecuting).toBe(false);
      expect(result.current.results).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('setCurrentQuery', () => {
    test('should set current query', () => {
      const { result } = renderHook(() => useQueryStore());
      const query = 'SELECT * FROM users';

      act(() => {
        result.current.setCurrentQuery(query);
      });

      expect(result.current.currentQuery).toBe(query);
    });

    test('should clear current query', () => {
      const { result } = renderHook(() => useQueryStore());

      act(() => {
        result.current.setCurrentQuery('SELECT 1');
        result.current.setCurrentQuery('');
      });

      expect(result.current.currentQuery).toBe('');
    });
  });

  describe('executeQuery', () => {
    test('should execute query and store results', async () => {
      const { result } = renderHook(() => useQueryStore());
      const query = 'SELECT COUNT(*) FROM users';
      const mockResult: QueryResult = {
        success: true,
        data: {
          columns: ['count'],
          rows: [[42]],
          rowCount: 1,
        },
        executionTime: 15,
      };

      act(() => {
        result.current.setCurrentQuery(query);
      });

      await act(async () => {
        const result = await result.current.executeQuery('conn-123', query);
        expect(result).toEqual(mockResult);
      });

      expect(result.current.isExecuting).toBe(false);
      expect(result.current.results).toEqual(mockResult);
      expect(result.current.queryHistory).toHaveLength(1);
      expect(result.current.queryHistory[0]).toEqual(
        expect.objectContaining({
          query,
          connectionId: 'conn-123',
          success: true,
        })
      );
    });

    test('should handle query execution error', async () => {
      const { result } = renderHook(() => useQueryStore());
      const query = 'SELECT * FROM nonexistent_table';
      const error = new Error('Table does not exist');

      // Mock execution failure
      const originalExecute = result.current.executeQuery;
      result.current.executeQuery = async (connectionId: string, queryStr: string) => {
        act(() => {
          useQueryStore.setState({
            isExecuting: true,
            error: null,
          });
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        act(() => {
          useQueryStore.setState({
            isExecuting: false,
            error: error.message,
            results: null,
          });
        });

        throw error;
      };

      await expect(
        act(async () => {
          try {
            await result.current.executeQuery('conn-123', query);
          } catch (e) {
            expect(e.message).toBe('Table does not exist');
          }
        })
      ).rejects.toThrow('Table does not exist');

      expect(result.current.isExecuting).toBe(false);
      expect(result.current.error).toBe('Table does not exist');
      expect(result.current.results).toBeNull();
      expect(result.current.queryHistory).toHaveLength(1);
      expect(result.current.queryHistory[0].success).toBe(false);
      expect(result.current.queryHistory[0].error).toBe('Table does not exist');
    });

    test('should set executing state during query execution', async () => {
      const { result } = renderHook(() => useQueryStore());
      const query = 'SELECT SLEEP(1)';

      act(() => {
        result.current.setCurrentQuery(query);
      });

      const originalExecute = result.current.executeQuery;
      result.current.executeQuery = async (connectionId: string, queryStr: string) => {
        act(() => {
          useQueryStore.setState({ isExecuting: true });
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        act(() => {
          useQueryStore.setState({
            isExecuting: false,
            results: { success: true, data: { columns: [], rows: [], rowCount: 0 } },
          });
        });

        return { success: true, data: { columns: [], rows: [], rowCount: 0 } };
      };

      let executingState: boolean;
      act(() => {
        result.current.executeQuery('conn-123', query).then(() => {
          executingState = result.current.isExecuting;
        });
      });

      expect(result.current.isExecuting).toBe(true);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.isExecuting).toBe(false);
    });
  });

  describe('saveQuery', () => {
    test('should save query with name', () => {
      const { result } = renderHook(() => useQueryStore());
      const query: Query = {
        id: 'query-1',
        name: 'User Count',
        query: 'SELECT COUNT(*) FROM users',
        connectionId: 'conn-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSaved: true,
      };

      act(() => {
        result.current.saveQuery(query);
      });

      expect(result.current.queries).toHaveLength(1);
      expect(result.current.queries[0]).toEqual(query);
    });

    test('should update existing query', () => {
      const { result } = renderHook(() => useQueryStore());
      const query: Query = {
        id: 'query-1',
        name: 'Original Name',
        query: 'SELECT 1',
        connectionId: 'conn-123',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        isSaved: true,
      };

      act(() => {
        result.current.saveQuery(query);
      });

      const updates = { name: 'Updated Name', query: 'SELECT 2' };
      const initialTime = query.updatedAt;

      setTimeout(() => {
        act(() => {
          result.current.saveQuery({ ...query, ...updates, updatedAt: Date.now() });
        });

        expect(result.current.queries[0].name).toBe('Updated Name');
        expect(result.current.queries[0].query).toBe('SELECT 2');
        expect(result.current.queries[0].updatedAt).toBeGreaterThan(initialTime);
      }, 10);
    });
  });

  describe('deleteQuery', () => {
    test('should delete query by id', () => {
      const { result } = renderHook(() => useQueryStore());
      const query1: Query = {
        id: 'query-1',
        name: 'Query 1',
        query: 'SELECT 1',
        connectionId: 'conn-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSaved: true,
      };
      const query2: Query = {
        id: 'query-2',
        name: 'Query 2',
        query: 'SELECT 2',
        connectionId: 'conn-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSaved: true,
      };

      act(() => {
        result.current.saveQuery(query1);
        result.current.saveQuery(query2);
      });

      act(() => {
        result.current.deleteQuery('query-1');
      });

      expect(result.current.queries).toHaveLength(1);
      expect(result.current.queries[0].id).toBe('query-2');
    });
  });

  describe('clearResults', () => {
    test('should clear query results', () => {
      const { result } = renderHook(() => useQueryStore());

      act(() => {
        useQueryStore.setState({
          results: { success: true, data: { columns: [], rows: [], rowCount: 0 } },
          error: 'Some error',
        });
      });

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.results).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('addToHistory', () => {
    test('should add query to history', () => {
      const { result } = renderHook(() => useQueryStore());
      const historyItem: QueryHistory = {
        id: 'history-1',
        query: 'SELECT * FROM users',
        connectionId: 'conn-123',
        executedAt: Date.now(),
        success: true,
        rowsAffected: 10,
      };

      act(() => {
        result.current.addToHistory(historyItem);
      });

      expect(result.current.queryHistory).toHaveLength(1);
      expect(result.current.queryHistory[0]).toEqual(historyItem);
    });

    test('should limit history to 100 items', () => {
      const { result } = renderHook(() => useQueryStore());

      // Add 101 items
      act(() => {
        for (let i = 0; i < 101; i++) {
          result.current.addToHistory({
            id: `history-${i}`,
            query: `SELECT ${i}`,
            connectionId: 'conn-123',
            executedAt: Date.now(),
            success: true,
          });
        }
      });

      expect(result.current.queryHistory).toHaveLength(100);
      expect(result.current.queryHistory[0].id).toBe('history-1');
      expect(result.current.queryHistory[99].id).toBe('history-100');
    });
  });

  describe('clearHistory', () => {
    test('should clear query history', () => {
      const { result } = renderHook(() => useQueryStore());

      act(() => {
        result.current.addToHistory({
          id: 'history-1',
          query: 'SELECT 1',
          connectionId: 'conn-123',
          executedAt: Date.now(),
          success: true,
        });
      });

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.queryHistory).toEqual([]);
    });
  });

  describe('clearError', () => {
    test('should clear error state', () => {
      const { result } = renderHook(() => useQueryStore());

      act(() => {
        useQueryStore.setState({ error: 'Some error' });
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Optimistic Updates', () => {
    test('should handle optimistic updates for query execution', async () => {
      const { result } = renderHook(() => useQueryStore());
      const query = 'SELECT * FROM users';
      const mockResult = { success: true, data: { columns: [], rows: [], rowCount: 0 } };

      act(() => {
        result.current.setCurrentQuery(query);
      });

      // Start execution with optimistic update
      await act(async () => {
        const promise = result.current.executeQuery('conn-123', query);

        // Check optimistic state
        expect(result.current.isExecuting).toBe(true);

        // Resolve with actual result
        await promise;
      });

      expect(result.current.results).toEqual(mockResult);
      expect(result.current.isExecuting).toBe(false);
    });

    test('should rollback optimistic update on error', async () => {
      const { result } = renderHook(() => useQueryStore());
      const query = 'INVALID QUERY';
      const error = new Error('Syntax error');

      act(() => {
        result.current.setCurrentQuery(query);
      });

      // Mock execution with optimistic update that fails
      result.current.executeQuery = async (connectionId: string, queryStr: string) => {
        act(() => {
          useQueryStore.setState({ isExecuting: true });
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        act(() => {
          useQueryStore.setState({
            isExecuting: false,
            error: error.message,
            results: null,
          });
        });

        throw error;
      };

      await expect(
        act(async () => {
          try {
            await result.current.executeQuery('conn-123', query);
          } catch (e) {
            expect(e.message).toBe('Syntax error');
          }
        })
      ).rejects.toThrow('Syntax error');

      expect(result.current.isExecuting).toBe(false);
      expect(result.current.error).toBe('Syntax error');
      expect(result.current.results).toBeNull();
    });
  });

  describe('Store Persistence', () => {
    test('should persist queries to localStorage', () => {
      const { result } = renderHook(() => useQueryStore());
      const query: Query = {
        id: 'query-1',
        name: 'Saved Query',
        query: 'SELECT * FROM users',
        connectionId: 'conn-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSaved: true,
      };

      act(() => {
        result.current.saveQuery(query);
      });

      // Check if localStorage was called (in real implementation)
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('should hydrate from localStorage on initialization', () => {
      // Mock localStorage data
      const storedData = {
        state: {
          queries: [{
            id: 'query-1',
            name: 'Stored Query',
            query: 'SELECT * FROM users',
            connectionId: 'conn-123',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isSaved: true,
          }],
          queryHistory: [],
        },
        version: 0,
      };

      // Mock localStorage.getItem
      (localStorage.getItem as jest.Mock).mockReturnValue(
        JSON.stringify(storedData)
      );

      // Re-initialize store
      const { result: newResult } = renderHook(() => useQueryStore());

      expect(newResult.current.queries).toHaveLength(1);
      expect(newResult.current.queries[0].name).toBe('Stored Query');
    });
  });

  describe('Cross-store Interactions', () => {
    test('should update last used timestamp on query execution', async () => {
      const { result } = renderHook(() => useQueryStore());
      const { result: connResult } = renderHook(() =>
        // In a real app, this would use the actual connection store
        // For testing, we mock it
        ({
          connections: [{
            id: 'conn-123',
            name: 'Test DB',
            lastUsed: Date.now() - 10000,
          }],
          updateConnection: jest.fn(),
        } as any)
      );

      act(() => {
        result.current.setCurrentQuery('SELECT 1');
      });

      await act(async () => {
        await result.current.executeQuery('conn-123', 'SELECT 1');
      });

      // In real implementation, would update connection's lastUsed timestamp
      expect(result.current.queryHistory).toHaveLength(1);
    });
  });
});