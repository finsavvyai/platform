import { act, renderHook } from '@testing-library/react';
import { useConnectionStore } from '../../renderer/stores/connectionStore';
import { DatabaseConnection } from '../../renderer/stores/types';

describe('ConnectionStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useConnectionStore.setState({
      connections: [],
      activeConnections: [],
      selectedConnectionId: null,
    });
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const { result } = renderHook(() => useConnectionStore());

      expect(result.current.connections).toEqual([]);
      expect(result.current.activeConnections).toEqual([]);
      expect(result.current.selectedConnectionId).toBeNull();
    });
  });

  describe('addConnection', () => {
    test('should add a new connection', () => {
      const { result } = renderHook(() => useConnectionStore());
      const newConnection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(newConnection);
      });

      expect(result.current.connections).toHaveLength(1);
      expect(result.current.connections[0]).toEqual(newConnection);
    });

    test('should add multiple connections', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection1: DatabaseConnection = {
        id: 'conn-1',
        name: 'Connection 1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'db1',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const connection2: DatabaseConnection = {
        id: 'conn-2',
        name: 'Connection 2',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db2',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection1);
        result.current.addConnection(connection2);
      });

      expect(result.current.connections).toHaveLength(2);
      expect(result.current.connections[0]).toEqual(connection1);
      expect(result.current.connections[1]).toEqual(connection2);
    });
  });

  describe('updateConnection', () => {
    test('should update existing connection', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Original Name',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
      });

      const updates = { name: 'Updated Name', port: 5433 };
      const initialTime = connection.updatedAt;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {
        act(() => {
          result.current.updateConnection('conn-1', updates);
        });

        expect(result.current.connections[0].name).toBe('Updated Name');
        expect(result.current.connections[0].port).toBe(5433);
        expect(result.current.connections[0].updatedAt).toBeGreaterThan(initialTime);
      }, 10);
    });

    test('should not update if connection not found', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
        result.current.updateConnection('conn-999', { name: 'Updated' });
      });

      expect(result.current.connections[0].name).toBe('Test Connection');
    });
  });

  describe('removeConnection', () => {
    test('should remove connection by id', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection1: DatabaseConnection = {
        id: 'conn-1',
        name: 'Connection 1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'db1',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const connection2: DatabaseConnection = {
        id: 'conn-2',
        name: 'Connection 2',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db2',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection1);
        result.current.addConnection(connection2);
        result.current.setSelectedConnection('conn-2');
      });

      act(() => {
        result.current.removeConnection('conn-1');
      });

      expect(result.current.connections).toHaveLength(1);
      expect(result.current.connections[0].id).toBe('conn-2');
    });

    test('should clear selected connection if removed', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
        result.current.setSelectedConnection('conn-1');
      });

      expect(result.current.selectedConnectionId).toBe('conn-1');

      act(() => {
        result.current.removeConnection('conn-1');
      });

      expect(result.current.selectedConnectionId).toBeNull();
    });
  });

  describe('setActiveConnection', () => {
    test('should set connection as active', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
        result.current.setActiveConnection('conn-1', true);
      });

      expect(result.current.activeConnections).toHaveLength(1);
      expect(result.current.activeConnections[0].connectionId).toBe('conn-1');
      expect(result.current.activeConnections[0].status).toBe('connected');
    });

    test('should remove connection from active', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
        result.current.setActiveConnection('conn-1', true);
        result.current.setActiveConnection('conn-1', false);
      });

      expect(result.current.activeConnections).toHaveLength(0);
    });

    test('should replace existing active connection', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
        result.current.setActiveConnection('conn-1', true);
      });

      const activeId = result.current.activeConnections[0].id;

      act(() => {
        result.current.setActiveConnection('conn-1', true);
      });

      expect(result.current.activeConnections).toHaveLength(1);
      expect(result.current.activeConnections[0].id).not.toBe(activeId);
    });
  });

  describe('setSelectedConnection', () => {
    test('should set selected connection', () => {
      const { result } = renderHook(() => useConnectionStore());

      act(() => {
        result.current.setSelectedConnection('conn-1');
      });

      expect(result.current.selectedConnectionId).toBe('conn-1');
    });

    test('should clear selected connection', () => {
      const { result } = renderHook(() => useConnectionStore());

      act(() => {
        result.current.setSelectedConnection('conn-1');
        result.current.setSelectedConnection(null);
      });

      expect(result.current.selectedConnectionId).toBeNull();
    });
  });

  describe('connectToDatabase', () => {
    test('should connect to database successfully', async () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
      });

      await act(async () => {
        await result.current.connectToDatabase('conn-1');
      });

      expect(result.current.activeConnections).toHaveLength(1);
      expect(result.current.activeConnections[0].status).toBe('connected');
      expect(result.current.activeConnections[0].connectionId).toBe('conn-1');
    });

    test('should auto-select connection if none selected', async () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
      });

      await act(async () => {
        await result.current.connectToDatabase('conn-1');
      });

      expect(result.current.selectedConnectionId).toBe('conn-1');
    });

    test('should handle connection error', async () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
      });

      // Mock connection failure by overriding the method
      const originalConnect = result.current.connectToDatabase;
      result.current.connectToDatabase = async (connectionId: string) => {
        act(() => {
          result.current.setActiveConnection(connectionId, true);
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        act(() => {
          useConnectionStore.setState({
            activeConnections: [{
              id: 'active-error',
              connectionId,
              status: 'error',
              error: 'Connection failed',
              connectedAt: Date.now(),
              lastActivity: Date.now(),
            }],
          });
        });
        throw new Error('Connection failed');
      };

      await expect(
        act(async () => {
          try {
            await result.current.connectToDatabase('conn-1');
          } catch (error) {
            expect(error.message).toBe('Connection failed');
          }
        })
      ).rejects.toThrow('Connection failed');

      expect(result.current.activeConnections[0].status).toBe('error');
      expect(result.current.activeConnections[0].error).toBe('Connection failed');
    });

    test('should throw error for non-existent connection', async () => {
      const { result } = renderHook(() => useConnectionStore());

      await expect(
        act(async () => {
          try {
            await result.current.connectToDatabase('non-existent');
          } catch (error) {
            expect(error.message).toBe('Connection non-existent not found');
          }
        })
      ).rejects.toThrow('Connection non-existent not found');
    });
  });

  describe('disconnectFromDatabase', () => {
    test('should disconnect from database', async () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
        result.current.setSelectedConnection('conn-1');
      });

      // First connect
      await act(async () => {
        await result.current.connectToDatabase('conn-1');
      });

      expect(result.current.activeConnections).toHaveLength(1);

      // Then disconnect
      await act(async () => {
        await result.current.disconnectFromDatabase('conn-1');
      });

      expect(result.current.activeConnections).toHaveLength(0);
      expect(result.current.selectedConnectionId).toBeNull();
    });

    test('should clear selected connection if disconnecting from selected', async () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
        result.current.setSelectedConnection('conn-1');
      });

      await act(async () => {
        await result.current.connectToDatabase('conn-1');
        await result.current.disconnectFromDatabase('conn-1');
      });

      expect(result.current.selectedConnectionId).toBeNull();
    });
  });

  describe('Store Persistence', () => {
    test('should persist connections to localStorage', () => {
      const { result } = renderHook(() => useConnectionStore());
      const connection: DatabaseConnection = {
        id: 'conn-1',
        name: 'Test Connection',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        lastUsed: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      act(() => {
        result.current.addConnection(connection);
      });

      // Check if localStorage was called (in real implementation)
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('should hydrate from localStorage on initialization', () => {
      // Mock localStorage data
      const storedData = {
        state: {
          connections: [{
            id: 'conn-1',
            name: 'Stored Connection',
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            database: 'testdb',
            lastUsed: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }],
          selectedConnectionId: 'conn-1',
        },
        version: 0,
      };

      // Mock localStorage.getItem
      (localStorage.getItem as jest.Mock).mockReturnValue(
        JSON.stringify(storedData)
      );

      // Re-initialize store
      const { result: newResult } = renderHook(() => useConnectionStore());

      expect(newResult.current.connections).toHaveLength(1);
      expect(newResult.current.connections[0].name).toBe('Stored Connection');
      expect(newResult.current.selectedConnectionId).toBe('conn-1');
    });
  });
});