/**
 * Questro Database Service
 * Core database operations with error handling and caching
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, count, ilike, or } from 'drizzle-orm';
import * as schema from '../db/schema';

export class DatabaseService {
  private db: any;
  private cache: Map<string, any> = new Map();
  private metrics = { queries: 0, cacheHits: 0 };

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database, { schema });
  }

  async healthCheck() {
    const start = Date.now();
    try {
      await this.db.select().from(schema.users).limit(1);
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, latency: Date.now() - start };
    }
  }

  private async query(fn: () => Promise<any>, cacheKey?: string, ttl = 300000) {
    this.metrics.queries++;

    if (cacheKey && this.cache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.cache.get(cacheKey);
    }

    try {
      const result = await fn();

      if (cacheKey) {
        this.cache.set(cacheKey, result);
        setTimeout(() => this.cache.delete(cacheKey), ttl);
      }

      return result;
    } catch (error) {
      console.error('Database query failed:', error);
      throw error;
    }
  }

  // Users
  async createUser(userData: any) {
    return this.query(() =>
      this.db.insert(schema.users).values(userData).returning()
    );
  }

  async getUserById(id: string) {
    return this.query(() =>
      this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1),
      `user:${id}`
    );
  }

  async getUserByEmail(email: string) {
    return this.query(() =>
      this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
    );
  }

  async updateUser(id: string, data: any) {
    this.cache.delete(`user:${id}`);
    return this.query(() =>
      this.db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning()
    );
  }

  // Projects
  async createProject(projectData: any) {
    return this.query(() =>
      this.db.insert(schema.projects).values(projectData).returning()
    );
  }

  async getProjectById(id: string) {
    return this.query(() =>
      this.db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1),
      `project:${id}`
    );
  }

  async getProjectsByUserId(userId: string) {
    return this.query(() =>
      this.db.select().from(schema.projects).where(eq(schema.projects.createdBy, userId)),
      `projects:user:${userId}`
    );
  }

  async updateProject(id: string, data: any) {
    this.cache.delete(`project:${id}`);
    return this.query(() =>
      this.db.update(schema.projects).set(data).where(eq(schema.projects.id, id)).returning()
    );
  }

  // Test Cases
  async createTestCase(testCaseData: any) {
    return this.query(() =>
      this.db.insert(schema.testCases).values(testCaseData).returning()
    );
  }

  async getTestCaseById(id: string) {
    return this.query(() =>
      this.db.select().from(schema.testCases).where(eq(schema.testCases.id, id)).limit(1),
      `testCase:${id}`
    );
  }

  async getTestCasesBySuite(suiteId: string) {
    return this.query(() =>
      this.db.select().from(schema.testCases).where(eq(schema.testCases.testSuiteId, suiteId)),
      `testCases:suite:${suiteId}`
    );
  }

  // Test Runs
  async createTestRun(testRunData: any) {
    return this.query(() =>
      this.db.insert(schema.testRuns).values(testRunData).returning()
    );
  }

  async getTestRunsByProject(projectId: string, limit = 50) {
    return this.query(() =>
      this.db.select().from(schema.testRuns)
        .where(eq(schema.testRuns.projectId, projectId))
        .limit(limit)
        .orderBy(desc(schema.testRuns.createdAt))
    );
  }

  // Analytics
  async getProjectStats(projectId: string) {
    return this.query(async () => {
      const [testCases, testRuns] = await Promise.all([
        this.db.select({ count: count() }).from(schema.testCases).where(eq(schema.testCases.projectId, projectId)),
        this.db.select({ count: count() }).from(schema.testRuns).where(eq(schema.testRuns.projectId, projectId))
      ]);

      return {
        totalTestCases: testCases[0]?.count || 0,
        totalTestRuns: testRuns[0]?.count || 0
      };
    }, `stats:project:${projectId}`, 60000);
  }

  // Search
  async searchTestCases(query: string, projectId?: string, limit = 20) {
    return this.query(() => {
      let dbQuery = this.db.select().from(schema.testCases);

      const conditions = [
        ilike(schema.testCases.name, `%${query}%`),
        ilike(schema.testCases.description, `%${query}%`)
      ];

      if (projectId) {
        conditions.push(eq(schema.testCases.projectId, projectId));
      }

      return dbQuery.where(or(...conditions)).limit(limit);
    });
  }

  getMetrics() {
    return { ...this.metrics };
  }

  clearCache() {
    this.cache.clear();
  }
}

// Global instance
export let dbService: DatabaseService;

export function initializeDatabaseService(d1Database: D1Database) {
  dbService = new DatabaseService(d1Database);
  return dbService;
}
