import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from './connectionStore';
import type { ConnectionConfig } from '../types/api';

const makeConnection = (overrides: Partial<ConnectionConfig> = {}): ConnectionConfig => ({
  id: 'conn-1',
  name: 'Test DB',
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
  ssl: false,
  ...overrides,
});

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connections: [],
      activeConnectionId: null,
      connectionStatuses: {},
    });
  });

  describe('initial state', () => {
    it('should have an empty connections array', () => {
      const state = useConnectionStore.getState();
      expect(state.connections).toEqual([]);
    });

    it('should have null activeConnectionId', () => {
      const state = useConnectionStore.getState();
      expect(state.activeConnectionId).toBeNull();
    });

    it('should have an empty connectionStatuses map', () => {
      const state = useConnectionStore.getState();
      expect(state.connectionStatuses).toEqual({});
    });
  });

  describe('setConnections', () => {
    it('should replace the connections array', () => {
      const connections = [
        makeConnection({ id: 'conn-1' }),
        makeConnection({ id: 'conn-2', name: 'Second DB' }),
      ];

      useConnectionStore.getState().setConnections(connections);

      const state = useConnectionStore.getState();
      expect(state.connections).toHaveLength(2);
      expect(state.connections[0].id).toBe('conn-1');
      expect(state.connections[1].id).toBe('conn-2');
    });

    it('should clear connections when given an empty array', () => {
      useConnectionStore.getState().setConnections([makeConnection()]);
      useConnectionStore.getState().setConnections([]);

      expect(useConnectionStore.getState().connections).toEqual([]);
    });
  });

  describe('addConnection', () => {
    it('should append a connection to the array', () => {
      const conn = makeConnection({ id: 'conn-1' });

      useConnectionStore.getState().addConnection(conn);

      const state = useConnectionStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0]).toEqual(conn);
    });

    it('should not remove existing connections', () => {
      useConnectionStore.getState().addConnection(makeConnection({ id: 'conn-1' }));
      useConnectionStore.getState().addConnection(makeConnection({ id: 'conn-2' }));

      expect(useConnectionStore.getState().connections).toHaveLength(2);
    });
  });

  describe('updateConnection', () => {
    it('should update the matching connection by id', () => {
      useConnectionStore.getState().setConnections([
        makeConnection({ id: 'conn-1', name: 'Old Name' }),
      ]);

      useConnectionStore.getState().updateConnection('conn-1', { name: 'New Name' });

      const updated = useConnectionStore.getState().connections[0];
      expect(updated.name).toBe('New Name');
      expect(updated.id).toBe('conn-1');
    });

    it('should not modify non-matching connections', () => {
      useConnectionStore.getState().setConnections([
        makeConnection({ id: 'conn-1', name: 'First' }),
        makeConnection({ id: 'conn-2', name: 'Second' }),
      ]);

      useConnectionStore.getState().updateConnection('conn-1', { name: 'Updated' });

      const state = useConnectionStore.getState();
      expect(state.connections[0].name).toBe('Updated');
      expect(state.connections[1].name).toBe('Second');
    });

    it('should handle partial updates preserving other fields', () => {
      useConnectionStore.getState().setConnections([
        makeConnection({ id: 'conn-1', host: 'localhost', port: 5432 }),
      ]);

      useConnectionStore.getState().updateConnection('conn-1', { port: 5433 });

      const conn = useConnectionStore.getState().connections[0];
      expect(conn.port).toBe(5433);
      expect(conn.host).toBe('localhost');
    });
  });

  describe('removeConnection', () => {
    it('should remove the connection by id', () => {
      useConnectionStore.getState().setConnections([
        makeConnection({ id: 'conn-1' }),
        makeConnection({ id: 'conn-2' }),
      ]);

      useConnectionStore.getState().removeConnection('conn-1');

      const state = useConnectionStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0].id).toBe('conn-2');
    });

    it('should reset activeConnectionId when the active connection is removed', () => {
      useConnectionStore.getState().setConnections([
        makeConnection({ id: 'conn-1' }),
      ]);
      useConnectionStore.getState().setActiveConnection('conn-1');

      useConnectionStore.getState().removeConnection('conn-1');

      expect(useConnectionStore.getState().activeConnectionId).toBeNull();
    });

    it('should not reset activeConnectionId when a different connection is removed', () => {
      useConnectionStore.getState().setConnections([
        makeConnection({ id: 'conn-1' }),
        makeConnection({ id: 'conn-2' }),
      ]);
      useConnectionStore.getState().setActiveConnection('conn-1');

      useConnectionStore.getState().removeConnection('conn-2');

      expect(useConnectionStore.getState().activeConnectionId).toBe('conn-1');
    });

    it('should do nothing when removing a non-existent id', () => {
      useConnectionStore.getState().setConnections([
        makeConnection({ id: 'conn-1' }),
      ]);

      useConnectionStore.getState().removeConnection('non-existent');

      expect(useConnectionStore.getState().connections).toHaveLength(1);
    });
  });

});
