import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from './connectionStore';
import type { ConnectionConfig, ConnectionStatus } from '../types/api';

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

describe('connectionStore - status & active connection', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connections: [],
      activeConnectionId: null,
      connectionStatuses: {},
    });
  });

  describe('setActiveConnection', () => {
    it('should set the activeConnectionId', () => {
      useConnectionStore.getState().setActiveConnection('conn-1');
      expect(useConnectionStore.getState().activeConnectionId).toBe('conn-1');
    });

    it('should allow setting to null', () => {
      useConnectionStore.getState().setActiveConnection('conn-1');
      useConnectionStore.getState().setActiveConnection(null);
      expect(useConnectionStore.getState().activeConnectionId).toBeNull();
    });
  });

  describe('setConnectionStatus', () => {
    it('should set the status for a connection id', () => {
      const status: ConnectionStatus = {
        id: 'conn-1',
        status: 'connected',
        lastChecked: '2026-02-28T00:00:00Z',
      };
      useConnectionStore.getState().setConnectionStatus('conn-1', status);
      expect(useConnectionStore.getState().connectionStatuses['conn-1']).toEqual(status);
    });

    it('should preserve statuses of other connections', () => {
      const status1: ConnectionStatus = {
        id: 'conn-1', status: 'connected', lastChecked: '2026-02-28T00:00:00Z',
      };
      const status2: ConnectionStatus = {
        id: 'conn-2', status: 'error', message: 'timeout', lastChecked: '2026-02-28T01:00:00Z',
      };
      useConnectionStore.getState().setConnectionStatus('conn-1', status1);
      useConnectionStore.getState().setConnectionStatus('conn-2', status2);
      const statuses = useConnectionStore.getState().connectionStatuses;
      expect(statuses['conn-1']).toEqual(status1);
      expect(statuses['conn-2']).toEqual(status2);
    });

    it('should overwrite an existing status for the same id', () => {
      const oldStatus: ConnectionStatus = {
        id: 'conn-1', status: 'connected', lastChecked: '2026-02-28T00:00:00Z',
      };
      const newStatus: ConnectionStatus = {
        id: 'conn-1', status: 'disconnected', lastChecked: '2026-02-28T02:00:00Z',
      };
      useConnectionStore.getState().setConnectionStatus('conn-1', oldStatus);
      useConnectionStore.getState().setConnectionStatus('conn-1', newStatus);
      expect(useConnectionStore.getState().connectionStatuses['conn-1']).toEqual(newStatus);
    });
  });

  describe('getActiveConnection', () => {
    it('should return the active connection when it exists', () => {
      const conn = makeConnection({ id: 'conn-1', name: 'Active DB' });
      useConnectionStore.getState().setConnections([conn]);
      useConnectionStore.getState().setActiveConnection('conn-1');
      expect(useConnectionStore.getState().getActiveConnection()).toEqual(conn);
    });

    it('should return null when activeConnectionId is null', () => {
      useConnectionStore.getState().setConnections([makeConnection()]);
      expect(useConnectionStore.getState().getActiveConnection()).toBeNull();
    });

    it('should return null when activeConnectionId does not match', () => {
      useConnectionStore.getState().setConnections([makeConnection({ id: 'conn-1' })]);
      useConnectionStore.getState().setActiveConnection('non-existent');
      expect(useConnectionStore.getState().getActiveConnection()).toBeNull();
    });

    it('should return null when connections array is empty', () => {
      useConnectionStore.getState().setActiveConnection('conn-1');
      expect(useConnectionStore.getState().getActiveConnection()).toBeNull();
    });
  });
});
