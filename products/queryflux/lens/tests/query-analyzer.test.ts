import { describe, it, expect } from 'vitest';
import { QueryAnalyzer } from '../src/services/query-analyzer';

describe('QueryAnalyzer', () => {
  const analyzer = new QueryAnalyzer();

  it('should analyze simple query', () => {
    const sql = 'SELECT * FROM users';
    const analysis = analyzer.analyzeQuery(sql);

    expect(analysis.complexityScore).toBeGreaterThan(0);
    expect(analysis.complexityScore).toBeLessThanOrEqual(100);
  });

  it('should detect N+1 patterns', () => {
    const sql = 'SELECT * FROM users u JOIN posts p ON u.id = p.user_id JOIN comments c ON p.id = c.post_id';
    const analysis = analyzer.analyzeQuery(sql);

    expect(analysis.nPlusOneDetected).toBe(true);
  });

  it('should suggest indexes', () => {
    const sql = 'SELECT * FROM users WHERE age > 18 ORDER BY name';
    const analysis = analyzer.analyzeQuery(sql);

    expect(analysis.possibleIndexes.length).toBeGreaterThan(0);
  });

  it('should generate warnings', () => {
    const sql = 'SELECT * FROM users';
    const analysis = analyzer.analyzeQuery(sql);

    expect(analysis.warnings.length).toBeGreaterThan(0);
  });

  it('should estimate row count', () => {
    const sql = 'SELECT * FROM users LIMIT 100';
    const analysis = analyzer.analyzeQuery(sql);

    expect(analysis.estimatedRows).toBe(100);
  });

  it('should warn about SELECT *', () => {
    const sql = 'SELECT * FROM users';
    const analysis = analyzer.analyzeQuery(sql);

    const hasWarning = analysis.warnings.some((w) => w.includes('SELECT *'));
    expect(hasWarning).toBe(true);
  });

  it('should compare queries', () => {
    const query1 = 'SELECT * FROM users';
    const query2 = 'SELECT * FROM users WHERE id = 1';

    const comparison = analyzer.compareQueries(query1, query2);

    expect(comparison.faster).toBeDefined();
    expect(comparison.improvement).toBeGreaterThanOrEqual(0);
  });

  it('should identify missing indexes from table schema', () => {
    const sql = 'SELECT * FROM users WHERE email = "test@example.com"';
    const tables = { users: ['id', 'name', 'email'] };

    const analysis = analyzer.analyzeQuery(sql, tables);

    expect(analysis.missingIndexes).toBeDefined();
  });

  it('should flag UNION instead of UNION ALL', () => {
    const sql = 'SELECT id FROM users UNION SELECT id FROM posts';
    const analysis = analyzer.analyzeQuery(sql);

    const unionWarning = analysis.warnings.some((w) => w.includes('UNION ALL'));
    expect(unionWarning).toBe(true);
  });

  it('should flag NOT IN usage', () => {
    const sql = 'SELECT * FROM users WHERE id NOT IN (1, 2, 3)';
    const analysis = analyzer.analyzeQuery(sql);

    const notInWarning = analysis.warnings.some((w) => w.includes('NOT IN'));
    expect(notInWarning).toBe(true);
  });

  it('should increase complexity with joins', () => {
    const simple = analyzer.analyzeQuery('SELECT * FROM users');
    const complex = analyzer.analyzeQuery(
      'SELECT * FROM users u JOIN posts p ON u.id = p.user_id'
    );

    expect(complex.complexityScore).toBeGreaterThan(simple.complexityScore);
  });
});
