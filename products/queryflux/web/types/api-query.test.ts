import { describe, it, expect } from 'vitest';
import { QuerySchema } from './api';

describe('QuerySchema', () => {
  const validQuery = {
    sql: 'SELECT * FROM users',
    connectionId: 'conn-1',
  };

  it('should accept a valid minimal query', () => {
    const result = QuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
  });

  it('should accept a full query', () => {
    const full = {
      id: 'q-1',
      name: 'Get Users',
      sql: 'SELECT * FROM users WHERE active = true',
      connectionId: 'conn-1',
      description: 'Fetches all active users',
      tags: ['users', 'active'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-28T00:00:00Z',
    };
    const result = QuerySchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('should fail when sql is empty', () => {
    const result = QuerySchema.safeParse({ sql: '', connectionId: 'conn-1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const sqlError = result.error.issues.find((issue) => issue.path[0] === 'sql');
      expect(sqlError).toBeDefined();
      expect(sqlError?.message).toBe('SQL query is required');
    }
  });

  it('should fail when sql is missing', () => {
    const result = QuerySchema.safeParse({ connectionId: 'conn-1' });
    expect(result.success).toBe(false);
  });

  it('should fail when connectionId is missing', () => {
    const result = QuerySchema.safeParse({ sql: 'SELECT 1' });
    expect(result.success).toBe(false);
  });

  it('should allow optional name to be omitted', () => {
    const result = QuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeUndefined();
    }
  });

  it('should allow tags as array of strings', () => {
    const result = QuerySchema.safeParse({ ...validQuery, tags: ['tag1', 'tag2'] });
    expect(result.success).toBe(true);
  });

  it('should reject tags with non-string items', () => {
    const result = QuerySchema.safeParse({ ...validQuery, tags: [123, true] });
    expect(result.success).toBe(false);
  });
});
