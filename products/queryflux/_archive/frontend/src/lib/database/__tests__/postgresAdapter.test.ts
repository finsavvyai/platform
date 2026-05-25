/**
 * PostgreSQL Adapter Tests
 *
 * Unit tests for the PostgreSQL database adapter
 */

import { PostgresAdapter } from '../adapters/postgresAdapter';

// Mock the pg library for testing
jest.mock('pg', () => {
  const mockPool = {
    connect: jest.fn(),
    end: jest.fn(),
    query: jest.fn(),
  };

  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  return {
    Pool: jest.fn(() => mockPool),
    Client: jest.fn(() => mockClient),
  };
});

describe('PostgresAdapter', () => {
  let adapter: PostgresAdapter;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    const { Pool, Client } = require('pg');
    mockPool = new Pool();
    mockClient = new Client();

    adapter = new PostgresAdapter({
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'testuser',
      password: 'testpass',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should successfully connect to PostgreSQL', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [{ 1: 1 }] });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error on connection failure', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(adapter.connect()).rejects.toThrow('PostgreSQL connection failed: Connection failed');
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [{ 1: 1 }] });
      await adapter.connect();
    });

    it('should execute query successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        fields: [
          { name: 'id', dataTypeID: 23 },
          { name: 'name', dataTypeID: 1043 }
        ],
        rowCount: 1,
      };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await adapter.executeQuery('SELECT * FROM test_table');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1, name: 'test' }]);
      expect(result.rowCount).toBe(1);
      expect(result.columns).toHaveLength(2);
      expect(result.message).toContain('Query executed successfully');
    });

    it('should handle query with parameters', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        fields: [{ name: 'id', dataTypeID: 23 }],
        rowCount: 1,
      };
      mockClient.query.mockResolvedValue(mockResult);

      await adapter.executeQuery('SELECT * FROM test_table WHERE id = $1', [1]);

      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM test_table WHERE id = $1', [1]);
    });

    it('should handle query errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Syntax error'));

      const result = await adapter.executeQuery('INVALID SQL');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Syntax error');
      expect(result.message).toContain('Query execution failed');
    });

    it('should throw error when not connected', async () => {
      await adapter.disconnect(); // Disconnect to test error case

      await expect(adapter.executeQuery('SELECT 1')).rejects.toThrow('Database not connected');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [{ 1: 1 }] });

      const result = await adapter.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('PostgreSQL connection successful');
      expect(result.latency).toBeDefined();
    });

    it('should handle connection test failure', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection timeout'));

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection test failed');
    });
  });

  describe('getSchema', () => {
    beforeEach(async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      await adapter.connect();
    });

    it('should retrieve database schema', async () => {
      // Mock tables query
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            { table_schema: 'public', table_name: 'users', table_type: 'BASE TABLE' },
            { table_schema: 'public', table_name: 'user_view', table_type: 'VIEW' }
          ]
        })
        // Mock columns query
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'id',
              data_type: 'integer',
              is_nullable: 'NO',
              column_default: 'nextval(\'users_id_seq\'::regclass)',
            },
            {
              column_name: 'name',
              data_type: 'character varying',
              is_nullable: 'YES',
              column_default: null,
            }
          ]
        })
        // Mock primary key query
        .mockResolvedValueOnce({ rows: [{ attname: 'id' }] })
        // Mock foreign key query
        .mockResolvedValueOnce({ rows: [] })
        // Mock version query
        .mockResolvedValueOnce({ rows: [{ version: 'PostgreSQL 14.0' }] })
        // Mock row count query
        .mockResolvedValueOnce({ rows: [{ reltuples: 100 }] });

      const schema = await adapter.getSchema();

      expect(schema.databaseName).toBe('testdb');
      expect(schema.version).toBe('PostgreSQL 14.0');
      expect(schema.tables).toHaveLength(1);
      expect(schema.views).toHaveLength(1);

      const usersTable = schema.tables[0];
      expect(usersTable.name).toBe('users');
      expect(usersTable.type).toBe('table');
      expect(usersTable.columns).toHaveLength(2);
      expect(usersTable.primaryKeys).toEqual(['id']);
    });
  });

  describe('type mapping', () => {
    it('should map PostgreSQL types correctly', async () => {
      // This tests the internal type mapping through a mock schema query
      mockClient.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [{ 1: 1 }] });
      await adapter.connect();

      // Mock a query with different data types
      const mockResult = {
        rows: [{ test: 'value' }],
        fields: [
          { name: 'test', dataTypeID: 1043 } // varchar type
        ],
        rowCount: 1,
      };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await adapter.executeQuery('SELECT 1');

      expect(result.columns[0].type).toBe('1043'); // Raw type ID
    });
  });

  describe('connection pool stats', () => {
    it('should return pool statistics', () => {
      mockPool.totalCount = 5;
      mockPool.idleCount = 3;
      mockPool.waitingCount = 0;

      const stats = adapter.getPoolStats();

      expect(stats.totalCount).toBe(5);
      expect(stats.idleCount).toBe(3);
      expect(stats.waitingCount).toBe(0);
    });

    it('should return zero stats when no pool', () => {
      // Create adapter without connecting
      const newAdapter = new PostgresAdapter({
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
      });

      const stats = newAdapter.getPoolStats();

      expect(stats.totalCount).toBe(0);
      expect(stats.idleCount).toBe(0);
      expect(stats.waitingCount).toBe(0);
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [{ 1: 1 }] });
      await adapter.connect();
    });

    it('should execute transaction successfully', async () => {
      const queries = [
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['Alice'] },
        { query: 'UPDATE users SET name = $1 WHERE id = $2', params: ['Bob', 1] }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1, fields: [] }) // First query
        .mockResolvedValueOnce({ rows: [], rowCount: 1, fields: [] }) // Second query
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const results = await adapter.executeTransaction(queries);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on transaction error', async () => {
      const queries = [
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['Alice'] },
        { query: 'INVALID SQL', params: [] }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1, fields: [] }) // First query
        .mockRejectedValueOnce(new Error('Syntax error')) // Second query fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(adapter.executeTransaction(queries)).rejects.toThrow('Syntax error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
