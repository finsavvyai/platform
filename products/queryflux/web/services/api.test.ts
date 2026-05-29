import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectionAPI, queryAPI, schemaAPI, healthAPI } from './api';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../lib/api-client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe('API service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connectionAPI', () => {
    it('getAll - should GET /api/v1/connections', async () => {
      const connections = [{ id: 'c1', name: 'DB1' }];
      mockGet.mockResolvedValue({ data: { data: connections } });
      const result = await connectionAPI.getAll();
      expect(mockGet).toHaveBeenCalledWith('/api/v1/connections');
      expect(result).toEqual(connections);
    });

    it('getById - should GET /api/v1/connections/:id', async () => {
      const connection = { id: 'c1', name: 'DB1' };
      mockGet.mockResolvedValue({ data: { data: connection } });
      const result = await connectionAPI.getById('c1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/connections/c1');
      expect(result).toEqual(connection);
    });

    it('create - should POST /api/v1/connections', async () => {
      const input = { name: 'New DB', type: 'postgresql' as const };
      const created = { id: 'c1', ...input };
      mockPost.mockResolvedValue({ data: { data: created } });
      const result = await connectionAPI.create(input as never);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/connections', input);
      expect(result).toEqual(created);
    });

    it('update - should PUT /api/v1/connections/:id', async () => {
      const updates = { name: 'Updated' };
      const updated = { id: 'c1', name: 'Updated' };
      mockPut.mockResolvedValue({ data: { data: updated } });
      const result = await connectionAPI.update('c1', updates);
      expect(mockPut).toHaveBeenCalledWith('/api/v1/connections/c1', updates);
      expect(result).toEqual(updated);
    });

    it('delete - should DELETE /api/v1/connections/:id', async () => {
      mockDelete.mockResolvedValue({});
      await connectionAPI.delete('c1');
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/connections/c1');
    });

    it('test - should POST /api/v1/database/connect', async () => {
      const input = { name: 'Test', type: 'postgresql' as const };
      const status = { id: 'c1', status: 'connected', lastChecked: '2026-02-28T00:00:00Z' };
      mockPost.mockResolvedValue({ data: { data: status } });
      const result = await connectionAPI.test(input as never);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/database/connect', input);
      expect(result).toEqual(status);
    });
  });

  describe('queryAPI', () => {
    it('getAll - should GET /api/v1/queries', async () => {
      const queries = [{ id: 'q1', sql: 'SELECT 1' }];
      mockGet.mockResolvedValue({ data: { data: queries } });
      const result = await queryAPI.getAll();
      expect(mockGet).toHaveBeenCalledWith('/api/v1/queries');
      expect(result).toEqual(queries);
    });

    it('getById - should GET /api/v1/queries/:id', async () => {
      const query = { id: 'q1', sql: 'SELECT 1' };
      mockGet.mockResolvedValue({ data: { data: query } });
      const result = await queryAPI.getById('q1');
      expect(mockGet).toHaveBeenCalledWith('/api/v1/queries/q1');
      expect(result).toEqual(query);
    });

    it('create - should POST /api/v1/queries', async () => {
      const input = { sql: 'SELECT 1', connectionId: 'c1' };
      const created = { id: 'q1', ...input };
      mockPost.mockResolvedValue({ data: { data: created } });
      const result = await queryAPI.create(input as never);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/queries', input);
      expect(result).toEqual(created);
    });

    it('update - should PUT /api/v1/queries/:id', async () => {
      const updates = { sql: 'SELECT 2' };
      const updated = { id: 'q1', sql: 'SELECT 2' };
      mockPut.mockResolvedValue({ data: { data: updated } });
      const result = await queryAPI.update('q1', updates);
      expect(mockPut).toHaveBeenCalledWith('/api/v1/queries/q1', updates);
      expect(result).toEqual(updated);
    });

    it('delete - should DELETE /api/v1/queries/:id', async () => {
      mockDelete.mockResolvedValue({});
      await queryAPI.delete('q1');
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/queries/q1');
    });

    it('execute - should POST /api/v1/database/query', async () => {
      const request = { connectionId: 'c1', sql: 'SELECT * FROM users' };
      const queryResult = {
        columns: ['id', 'name'],
        rows: [{ id: 1, name: 'Alice' }],
        rowCount: 1,
        executionTime: 15,
      };
      mockPost.mockResolvedValue({ data: { data: queryResult } });
      const actual = await queryAPI.execute(request);
      expect(mockPost).toHaveBeenCalledWith('/api/v1/database/query', request);
      expect(actual).toEqual(queryResult);
    });
  });

  describe('schemaAPI', () => {
    it('getSchema - should POST /api/v1/database/schema', async () => {
      const schema = { databases: [{ name: 'testdb', schemas: [] }] };
      mockPost.mockResolvedValue({ data: { data: schema } });
      const result = await schemaAPI.getSchema('c1');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/database/schema', { connectionId: 'c1' });
      expect(result).toEqual(schema);
    });
  });

  describe('healthAPI', () => {
    it('check - should GET /health', async () => {
      const health = { status: 'ok', timestamp: '2026-02-28T00:00:00Z' };
      mockGet.mockResolvedValue({ data: health });
      const result = await healthAPI.check();
      expect(mockGet).toHaveBeenCalledWith('/health');
      expect(result).toEqual(health);
    });
  });
});
