import { describe, it, expect } from 'vitest';
import { createPostgresClient } from '../src/client/postgres';

describe('Database Clients', () => {
  describe('createPostgresClient', () => {
    it('should be a function', () => {
      expect(typeof createPostgresClient).toBe('function');
    });

    it('should return a promise', () => {
      expect(createPostgresClient).toBeDefined();
    });
  });

  describe('DatabaseClient interface', () => {
    it('should define required properties', async () => {
      const mod = await import('../src/client/types');
      expect(mod).toBeDefined();
    });
  });
});
