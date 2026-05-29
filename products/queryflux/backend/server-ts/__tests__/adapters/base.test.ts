import { sanitizeSQL } from '../../adapters/base';

describe('sanitizeSQL', () => {
  it('allows simple SELECT statements', () => {
    expect(sanitizeSQL('SELECT * FROM users')).toEqual({ safe: true });
  });

  it('allows SELECT with WHERE clause', () => {
    expect(sanitizeSQL('SELECT name FROM users WHERE id = 1')).toEqual({ safe: true });
  });

  it('allows INSERT statement', () => {
    expect(sanitizeSQL("INSERT INTO users (name) VALUES ('Alice')")).toEqual({ safe: true });
  });

  it('blocks multiple statements', () => {
    const result = sanitizeSQL('SELECT 1; DROP TABLE users');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Multiple statements');
  });

  it('blocks OR 1=1 injection', () => {
    const result = sanitizeSQL("SELECT * FROM users WHERE name = '' OR 1=1");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Suspicious');
  });

  it('blocks WAITFOR DELAY injection', () => {
    const result = sanitizeSQL("SELECT * FROM users; WAITFOR DELAY '00:00:05'");
    expect(result.safe).toBe(false);
  });

  it('blocks SLEEP() injection', () => {
    const result = sanitizeSQL('SELECT SLEEP(5)');
    expect(result.safe).toBe(false);
  });

  it('blocks UNION SELECT injection', () => {
    const result = sanitizeSQL("SELECT name FROM users UNION SELECT password FROM admin");
    expect(result.safe).toBe(false);
  });

  it('blocks ; DROP injection', () => {
    const result = sanitizeSQL('SELECT 1; DROP TABLE users');
    expect(result.safe).toBe(false);
  });

  it('allows trailing semicolon on single statement', () => {
    expect(sanitizeSQL('SELECT 1;')).toEqual({ safe: true });
  });
});
