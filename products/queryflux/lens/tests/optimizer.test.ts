import { describe, it, expect, beforeEach } from 'vitest';
import { QueryOptimizer } from '../src/services/optimizer';

describe('QueryOptimizer', () => {
  let optimizer: QueryOptimizer;

  beforeEach(() => {
    optimizer = new QueryOptimizer();
  });

  it('should suggest SELECT * optimization', () => {
    const sql = 'SELECT * FROM users';
    const suggestions = optimizer.optimizeQuery(sql);

    expect(suggestions.length).toBeGreaterThan(0);
    const selectOptimization = suggestions.find((s) => s.type === 'rewrite');
    expect(selectOptimization).toBeDefined();
  });

  it('should suggest UNION ALL instead of UNION', () => {
    const sql = 'SELECT id FROM users UNION SELECT id FROM posts';
    const suggestions = optimizer.optimizeQuery(sql);

    const unionSuggestion = suggestions.find((s) => s.title.includes('UNION ALL'));
    expect(unionSuggestion).toBeDefined();
  });

  it('should suggest NOT EXISTS instead of NOT IN', () => {
    const sql = 'SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM posts)';
    const suggestions = optimizer.optimizeQuery(sql);

    const notInSuggestion = suggestions.find((s) => s.title.includes('NOT EXISTS'));
    expect(notInSuggestion).toBeDefined();
  });

  it('should suggest index creation', () => {
    const sql = 'SELECT * FROM users WHERE age > 18 ORDER BY name';
    const suggestions = optimizer.optimizeQuery(sql);

    const indexSuggestion = suggestions.find((s) => s.type === 'index');
    expect(indexSuggestion).toBeDefined();
  });

  it('should suggest LIMIT clause', () => {
    const sql = 'SELECT * FROM users';
    const suggestions = optimizer.optimizeQuery(sql);

    const limitSuggestion = suggestions.find((s) => s.title.includes('LIMIT'));
    expect(limitSuggestion).toBeDefined();
  });

  it('should rewrite query for performance', () => {
    const sql = 'SELECT * FROM users UNION SELECT * FROM posts LIMIT 100';
    const optimized = optimizer.rewriteForPerformance(sql);

    expect(optimized).toContain('UNION ALL');
  });

  it('should provide improvement estimates', () => {
    const sql = 'SELECT * FROM users';
    const suggestions = optimizer.optimizeQuery(sql);

    suggestions.forEach((s) => {
      expect(s.estimatedImprovement).toBeGreaterThan(0);
    });
  });

  it('should handle multiple issues', () => {
    const sql = 'SELECT * FROM users UNION SELECT * FROM posts';
    const suggestions = optimizer.optimizeQuery(sql);

    expect(suggestions.length).toBeGreaterThan(1);
  });

  it('should suggest distinct optimization', () => {
    const sql = 'SELECT DISTINCT COUNT(*) FROM users GROUP BY department';
    const suggestions = optimizer.optimizeQuery(sql);

    const distinctSuggestion = suggestions.find((s) => s.title.includes('DISTINCT'));
    expect(distinctSuggestion).toBeDefined();
  });

  it('should generate SQL statements for index creation', () => {
    const sql = 'SELECT * FROM users WHERE age > 18';
    const suggestions = optimizer.optimizeQuery(sql);

    const indexSuggestion = suggestions.find((s) => s.type === 'index');
    expect(indexSuggestion?.sqlStatement).toBeDefined();
  });
});
