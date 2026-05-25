import * as svc from '../../services/connectionService';
import { store } from '../../storage';
import { AppError } from '../../middleware/errorHandler';

const connInput = {
  name: 'Test PG',
  type: 'postgresql' as const,
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
  ssl: false,
};

describe('connectionService', () => {
  beforeEach(() => {
    store.clear();
  });

  describe('createConnection', () => {
    it('creates and returns a connection with id', async () => {
      const conn = await svc.createConnection(connInput);
      expect(conn.id).toBeDefined();
      expect(conn.name).toBe('Test PG');
      expect(conn.type).toBe('postgresql');
    });
  });

  describe('getConnection', () => {
    it('returns a connection by id', async () => {
      const created = await svc.createConnection(connInput);
      const found = svc.getConnection(created.id!);
      expect(found.id).toBe(created.id);
    });

    it('throws AppError 404 for missing connection', () => {
      expect(() => svc.getConnection('nonexistent')).toThrow(AppError);
      try {
        svc.getConnection('nonexistent');
      } catch (e) {
        expect((e as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('listConnections', () => {
    it('returns all connections', async () => {
      await svc.createConnection(connInput);
      await svc.createConnection({ ...connInput, name: 'Second' });
      expect(svc.listConnections()).toHaveLength(2);
    });
  });

  describe('updateConnection', () => {
    it('updates an existing connection', async () => {
      const conn = await svc.createConnection(connInput);
      const updated = svc.updateConnection(conn.id!, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });

    it('throws 404 for non-existent connection', () => {
      expect(() => svc.updateConnection('bad-id', { name: 'X' })).toThrow(AppError);
    });
  });

  describe('deleteConnection', () => {
    it('deletes an existing connection', async () => {
      const conn = await svc.createConnection(connInput);
      await svc.deleteConnection(conn.id!);
      expect(() => svc.getConnection(conn.id!)).toThrow(AppError);
    });

    it('throws 404 for non-existent connection', async () => {
      await expect(svc.deleteConnection('bad-id')).rejects.toThrow(AppError);
    });
  });
});
