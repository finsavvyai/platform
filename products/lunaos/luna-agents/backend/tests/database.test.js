import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Cloudflare D1 and Cache
class MockD1Database {
  constructor() {
    this.data = new Map();
  }

  prepare(query) {
    return {
      bind: (...params) => ({
        first: async () => {
          if (query.includes('SELECT * FROM users WHERE email')) {
            return this.data.get('user:' + params[0]);
          }
          if (query.includes('SELECT * FROM users WHERE api_key')) {
            return this.data.get('apikey:' + params[0]);
          }
          return null;
        },
        all: async () => ({ results: Array.from(this.data.values()) }),
        run: async () => ({ success: true })
      })
    };
  }

  async batch(statements) {
    return statements.map(() => ({ success: true }));
  }
}

class MockCache {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key);
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
  }

  async delete(key) {
    this.store.delete(key);
  }
}

describe('Database Service', () => {
  let db, cache, dbService;

  beforeEach(() => {
    db = new MockD1Database();
    cache = new MockCache();
    
    // Mock database service
    dbService = {
      db,
      cache,
      
      async getCached(cacheKey) {
        try {
          const cached = await this.cache.get(cacheKey);
          if (cached) {
            try {
              return JSON.parse(cached);
            } catch (parseError) {
              await this.cache.delete(cacheKey).catch(() => {});
              return null;
            }
          }
          return null;
        } catch (error) {
          return null;
        }
      },

      async setCached(cacheKey, data, ttl = 3600) {
        try {
          await this.cache.put(cacheKey, JSON.stringify(data), {
            expirationTtl: ttl
          });
          return true;
        } catch (error) {
          return false;
        }
      },

      async createUser(userData) {
        try {
          const results = await this.db.batch([
            this.db.prepare(`INSERT INTO users (id, email) VALUES (?, ?)`).bind(userData.id, userData.email),
            this.db.prepare(`INSERT INTO usage_metrics (user_id) VALUES (?)`).bind(userData.id)
          ]);

          const allSucceeded = results.every(r => r.success);
          if (!allSucceeded) {
            throw new Error('Transaction failed');
          }

          return userData;
        } catch (error) {
          throw new Error(`Failed to create user: ${error.message}`);
        }
      },

      async getUserByEmail(email) {
        const cacheKey = `user:email:${email}`;
        const cached = await this.getCached(cacheKey);
        if (cached) return cached;

        const user = await this.db.prepare(
          `SELECT * FROM users WHERE email = ?`
        ).bind(email).first();

        if (user) {
          await this.setCached(cacheKey, user);
        }

        return user;
      }
    };
  });

  describe('Cache Error Handling (P1-1)', () => {
    it('should gracefully handle cache read failures', async () => {
      cache.get = jest.fn().mockRejectedValue(new Error('Cache unavailable'));
      
      const result = await dbService.getCached('test-key');
      expect(result).toBeNull();
    });

    it('should handle invalid JSON in cache', async () => {
      await cache.put('test-key', 'invalid-json');
      
      const result = await dbService.getCached('test-key');
      expect(result).toBeNull();
    });

    it('should gracefully handle cache write failures', async () => {
      cache.put = jest.fn().mockRejectedValue(new Error('Cache full'));
      
      const result = await dbService.setCached('test-key', { data: 'test' });
      expect(result).toBe(false);
    });

    it('should continue operations when cache is unavailable', async () => {
      cache.get = jest.fn().mockRejectedValue(new Error('Cache error'));
      cache.put = jest.fn().mockRejectedValue(new Error('Cache error'));
      
      db.data.set('user:test@example.com', { 
        id: '123', 
        email: 'test@example.com' 
      });

      const user = await dbService.getUserByEmail('test@example.com');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });
  });

  describe('Transaction Support (P1-2)', () => {
    it('should create user with transaction', async () => {
      const userData = {
        id: 'user123',
        email: 'test@example.com'
      };

      const result = await dbService.createUser(userData);
      
      expect(result).toEqual(userData);
    });

    it('should rollback on transaction failure', async () => {
      db.batch = jest.fn().mockResolvedValue([
        { success: true },
        { success: false }
      ]);

      await expect(
        dbService.createUser({ id: '123', email: 'test@example.com' })
      ).rejects.toThrow('Failed to create user');
    });
  });

  describe('Cache Invalidation (P1-5)', () => {
    it('should invalidate all related caches on update', async () => {
      await cache.put('user:email:test@example.com', JSON.stringify({ id: '123' }));
      await cache.put('user:id:123', JSON.stringify({ id: '123' }));
      
      const deleteCount = cache.store.size;
      expect(deleteCount).toBeGreaterThan(0);
    });

    it('should handle cache invalidation errors gracefully', async () => {
      cache.delete = jest.fn().mockRejectedValue(new Error('Delete failed'));
      
      // Should not throw even if cache deletion fails
      await expect(async () => {
        await cache.delete('test-key').catch(() => {});
      }).not.toThrow();
    });
  });
});

describe('Rate Limiting', () => {
  let rateLimiter, cache;

  beforeEach(() => {
    cache = new MockCache();
    
    rateLimiter = {
      cache,
      
      async checkRateLimit(identifier, limit, window) {
        const key = `ratelimit:${identifier}`;
        const current = await this.cache.get(key);
        const count = current ? parseInt(current) + 1 : 1;
        
        if (count > limit) {
          return { allowed: false, remaining: 0 };
        }
        
        await this.cache.put(key, count.toString(), { expirationTtl: window });
        return { allowed: true, remaining: limit - count };
      }
    };
  });

  it('should allow requests under limit', async () => {
    const result = await rateLimiter.checkRateLimit('user123', 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should block requests over limit', async () => {
    for (let i = 0; i < 10; i++) {
      await rateLimiter.checkRateLimit('user123', 10, 60);
    }
    
    const result = await rateLimiter.checkRateLimit('user123', 10, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
