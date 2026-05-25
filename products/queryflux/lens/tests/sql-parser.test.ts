import { describe, it, expect, beforeEach } from 'vitest';
import { SQLParser } from '../src/services/sql-parser';

describe('SQLParser', () => {
  let parser: SQLParser;

  beforeEach(() => {
    parser = new SQLParser();
  });

  it('should parse SELECT query', () => {
    const sql = 'SELECT id, name FROM users WHERE age > 18';
    const result = parser.parse(sql);

    expect(result.type).toBe('SELECT');
    expect(result.tables).toContain('users');
    expect(result.columns.length).toBeGreaterThan(0);
  });

  it('should parse INSERT query', () => {
    const sql = 'INSERT INTO users (id, name) VALUES (1, "John")';
    const result = parser.parse(sql);

    expect(result.type).toBe('INSERT');
    expect(result.tables).toContain('users');
  });

  it('should parse UPDATE query', () => {
    const sql = 'UPDATE users SET name = "Jane" WHERE id = 1';
    const result = parser.parse(sql);

    expect(result.type).toBe('UPDATE');
  });

  it('should parse DELETE query', () => {
    const sql = 'DELETE FROM users WHERE id = 1';
    const result = parser.parse(sql);

    expect(result.type).toBe('DELETE');
  });

  it('should extract JOINs', () => {
    const sql = 'SELECT * FROM users u INNER JOIN posts p ON u.id = p.user_id';
    const result = parser.parse(sql);

    expect(result.joins.length).toBeGreaterThan(0);
    expect(result.joins[0].table).toBe('posts');
  });

  it('should extract WHERE conditions', () => {
    const sql = 'SELECT * FROM users WHERE age > 18 AND name = "John"';
    const result = parser.parse(sql);

    expect(result.conditions.length).toBeGreaterThan(0);
  });

  it('should extract GROUP BY', () => {
    const sql = 'SELECT department, COUNT(*) FROM employees GROUP BY department';
    const result = parser.parse(sql);

    expect(result.groupBy.length).toBeGreaterThan(0);
  });

  it('should extract ORDER BY', () => {
    const sql = 'SELECT * FROM users ORDER BY name ASC';
    const result = parser.parse(sql);

    expect(result.orderBy.length).toBeGreaterThan(0);
  });

  it('should extract LIMIT', () => {
    const sql = 'SELECT * FROM users LIMIT 10';
    const result = parser.parse(sql);

    expect(result.limit).toBe(10);
  });

  it('should extract OFFSET', () => {
    const sql = 'SELECT * FROM users LIMIT 10 OFFSET 20';
    const result = parser.parse(sql);

    expect(result.offset).toBe(20);
  });

  it('should calculate query complexity', () => {
    const simple = parser.parse('SELECT * FROM users');
    const complex = parser.parse(
      'SELECT * FROM users u JOIN posts p ON u.id = p.user_id WHERE u.active = 1 GROUP BY u.id ORDER BY u.name'
    );

    const simpleComplexity = parser.getQueryComplexity(simple);
    const complexComplexity = parser.getQueryComplexity(complex);

    expect(complexComplexity).toBeGreaterThan(simpleComplexity);
  });

  it('should handle multiple JOINs', () => {
    const sql = `
      SELECT * FROM users u
      JOIN posts p ON u.id = p.user_id
      JOIN comments c ON p.id = c.post_id
    `;

    const result = parser.parse(sql);

    expect(result.joins.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle complex WHERE clauses', () => {
    const sql = 'SELECT * FROM users WHERE age > 18 AND status = "active" AND city = "NYC"';
    const result = parser.parse(sql);

    expect(result.conditions.length).toBeGreaterThan(0);
  });
});
