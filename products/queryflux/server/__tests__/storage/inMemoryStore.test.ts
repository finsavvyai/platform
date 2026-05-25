import { InMemoryStore } from '../../storage/inMemoryStore';

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  // ── Connections ──────────────────────────────────────────────

  describe('connections', () => {
    const input = {
      name: 'Test DB',
      type: 'postgresql' as const,
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
      ssl: false,
    };

    it('creates a connection with generated id and timestamps', () => {
      const conn = store.createConnection(input);
      expect(conn.id).toBeDefined();
      expect(conn.name).toBe('Test DB');
      expect(conn.createdAt).toBeDefined();
      expect(conn.updatedAt).toBeDefined();
    });

    it('retrieves a connection by id', () => {
      const conn = store.createConnection(input);
      const found = store.getConnection(conn.id!);
      expect(found).toEqual(conn);
    });

    it('returns undefined for non-existent connection', () => {
      expect(store.getConnection('nonexistent')).toBeUndefined();
    });

    it('lists all connections', () => {
      store.createConnection(input);
      store.createConnection({ ...input, name: 'Second DB' });
      expect(store.listConnections()).toHaveLength(2);
    });

    it('updates a connection', () => {
      const conn = store.createConnection(input);
      const updated = store.updateConnection(conn.id!, { name: 'Updated' });
      expect(updated?.name).toBe('Updated');
      expect(updated?.id).toBe(conn.id);
    });

    it('returns undefined when updating non-existent connection', () => {
      expect(store.updateConnection('nonexistent', { name: 'X' })).toBeUndefined();
    });

    it('deletes a connection', () => {
      const conn = store.createConnection(input);
      expect(store.deleteConnection(conn.id!)).toBe(true);
      expect(store.getConnection(conn.id!)).toBeUndefined();
    });

    it('returns false when deleting non-existent connection', () => {
      expect(store.deleteConnection('nonexistent')).toBe(false);
    });
  });

  // ── Queries ──────────────────────────────────────────────────

  describe('queries', () => {
    const input = {
      name: 'Test Query',
      sql: 'SELECT 1',
      connectionId: '550e8400-e29b-41d4-a716-446655440000',
    };

    it('creates a query with generated id', () => {
      const query = store.createQuery(input);
      expect(query.id).toBeDefined();
      expect(query.name).toBe('Test Query');
    });

    it('retrieves a query by id', () => {
      const query = store.createQuery(input);
      expect(store.getQuery(query.id!)).toEqual(query);
    });

    it('lists queries, optionally filtered by connectionId', () => {
      store.createQuery(input);
      store.createQuery({ ...input, connectionId: 'other-id' });
      expect(store.listQueries()).toHaveLength(2);
      expect(store.listQueries(input.connectionId)).toHaveLength(1);
    });

    it('updates a query', () => {
      const query = store.createQuery(input);
      const updated = store.updateQuery(query.id!, { name: 'Updated' });
      expect(updated?.name).toBe('Updated');
    });

    it('deletes a query', () => {
      const query = store.createQuery(input);
      expect(store.deleteQuery(query.id!)).toBe(true);
      expect(store.getQuery(query.id!)).toBeUndefined();
    });
  });

  // ── Utility ──────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all data', () => {
      store.createConnection({ name: 'A', type: 'postgresql', host: 'h', port: 1, database: 'd', username: 'u', password: 'p', ssl: false });
      store.createQuery({ name: 'Q', sql: 'SELECT 1', connectionId: 'x' });
      store.clear();
      expect(store.listConnections()).toHaveLength(0);
      expect(store.listQueries()).toHaveLength(0);
    });
  });
});
