import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryOne, queryAll, execute } from '../src/db/helpers';
import type { D1Database, D1PreparedStatement } from '../src/bindings';

describe('db helpers', () => {
  let mockDB: Partial<D1Database>;
  let mockStmt: Partial<D1PreparedStatement>;

  beforeEach(() => {
    mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    };

    mockDB = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    };
  });

  describe('queryOne', () => {
    it('should return single row', async () => {
      const row = { id: 1, name: 'test' };
      (mockStmt.first as any).mockResolvedValueOnce(row);

      const result = await queryOne(mockDB as D1Database, 'SELECT * FROM t');

      expect(result).toEqual(row);
      expect(mockDB.prepare).toHaveBeenCalledWith('SELECT * FROM t');
    });

    it('should return null when no row found', async () => {
      (mockStmt.first as any).mockResolvedValueOnce(null);

      const result = await queryOne(mockDB as D1Database, 'SELECT * FROM t');

      expect(result).toBeNull();
    });

    it('should bind parameters', async () => {
      const row = { id: 1 };
      (mockStmt.first as any).mockResolvedValueOnce(row);

      await queryOne(mockDB as D1Database, 'SELECT * FROM t WHERE id = ?', [
        1,
      ]);

      expect(mockStmt.bind).toHaveBeenCalledWith(1);
    });

    it('should not bind when params empty', async () => {
      (mockStmt.first as any).mockResolvedValueOnce(null);

      await queryOne(mockDB as D1Database, 'SELECT * FROM t');

      expect(mockStmt.bind).not.toHaveBeenCalled();
    });
  });

  describe('queryAll', () => {
    it('should return multiple rows', async () => {
      const rows = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ];
      (mockStmt.all as any).mockResolvedValueOnce({ results: rows });

      const result = await queryAll(mockDB as D1Database, 'SELECT * FROM t');

      expect(result).toEqual(rows);
    });

    it('should return empty array when no results', async () => {
      (mockStmt.all as any).mockResolvedValueOnce({ results: [] });

      const result = await queryAll(mockDB as D1Database, 'SELECT * FROM t');

      expect(result).toEqual([]);
    });

    it('should bind multiple parameters', async () => {
      (mockStmt.all as any).mockResolvedValueOnce({ results: [] });

      await queryAll(mockDB as D1Database,
        'SELECT * FROM t WHERE id = ? AND name = ?',
        [1, 'test'],
      );

      expect(mockStmt.bind).toHaveBeenCalledWith(1, 'test');
    });

    it('should handle undefined results', async () => {
      (mockStmt.all as any).mockResolvedValueOnce({ success: true });

      const result = await queryAll(mockDB as D1Database, 'SELECT * FROM t');

      expect(result).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should execute query and return result', async () => {
      const result = { success: true };
      (mockStmt.run as any).mockResolvedValueOnce(result);

      const actual = await execute(mockDB as D1Database, 'INSERT INTO t VALUES (1)');

      expect(actual).toEqual(result);
    });

    it('should bind parameters for execution', async () => {
      (mockStmt.run as any).mockResolvedValueOnce({ success: true });

      await execute(mockDB as D1Database, 'INSERT INTO t VALUES (?)', [1]);

      expect(mockStmt.bind).toHaveBeenCalledWith(1);
    });

    it('should handle execution without parameters', async () => {
      (mockStmt.run as any).mockResolvedValueOnce({ success: true });

      await execute(mockDB as D1Database, 'DELETE FROM t');

      expect(mockStmt.bind).not.toHaveBeenCalled();
    });
  });
});
