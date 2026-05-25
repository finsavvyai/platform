import * as querySvc from '../../services/queryService';
import * as connSvc from '../../services/connectionService';
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

describe('queryService', () => {
  let connectionId: string;

  beforeEach(async () => {
    store.clear();
    const conn = await connSvc.createConnection(connInput);
    connectionId = conn.id!;
  });

  describe('createSavedQuery', () => {
    it('creates a saved query', () => {
      const q = querySvc.createSavedQuery({
        name: 'All users',
        sql: 'SELECT * FROM users',
        connectionId,
      });
      expect(q.id).toBeDefined();
      expect(q.name).toBe('All users');
    });

    it('throws if connection does not exist', () => {
      expect(() =>
        querySvc.createSavedQuery({
          name: 'Bad',
          sql: 'SELECT 1',
          connectionId: 'nonexistent',
        }),
      ).toThrow(AppError);
    });
  });

  describe('getSavedQuery', () => {
    it('returns a saved query by id', () => {
      const q = querySvc.createSavedQuery({
        name: 'Q1',
        sql: 'SELECT 1',
        connectionId,
      });
      expect(querySvc.getSavedQuery(q.id!).name).toBe('Q1');
    });

    it('throws 404 for missing query', () => {
      expect(() => querySvc.getSavedQuery('nonexistent')).toThrow(AppError);
    });
  });

  describe('listSavedQueries', () => {
    it('lists all saved queries', () => {
      querySvc.createSavedQuery({ name: 'A', sql: 'SELECT 1', connectionId });
      querySvc.createSavedQuery({ name: 'B', sql: 'SELECT 2', connectionId });
      expect(querySvc.listSavedQueries()).toHaveLength(2);
    });

    it('filters by connectionId', () => {
      querySvc.createSavedQuery({ name: 'A', sql: 'SELECT 1', connectionId });
      expect(querySvc.listSavedQueries(connectionId)).toHaveLength(1);
      expect(querySvc.listSavedQueries('other')).toHaveLength(0);
    });
  });

  describe('updateSavedQuery', () => {
    it('updates an existing query', () => {
      const q = querySvc.createSavedQuery({ name: 'Old', sql: 'SELECT 1', connectionId });
      const updated = querySvc.updateSavedQuery(q.id!, { name: 'New' });
      expect(updated.name).toBe('New');
    });
  });

  describe('deleteSavedQuery', () => {
    it('deletes an existing query', () => {
      const q = querySvc.createSavedQuery({ name: 'Q', sql: 'SELECT 1', connectionId });
      querySvc.deleteSavedQuery(q.id!);
      expect(() => querySvc.getSavedQuery(q.id!)).toThrow(AppError);
    });

    it('throws 404 for non-existent query', () => {
      expect(() => querySvc.deleteSavedQuery('bad')).toThrow(AppError);
    });
  });
});
