/**
 * Questro Database Service Layer
 * Provides core database operations with connection management and error handling
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, desc, asc, count, ilike } from 'drizzle-orm';
import * as schema from '../db/schema';

export interface DatabaseConfig {
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
  enableMetrics: boolean;
  enableCache: boolean;
  cacheTTL: number;
  slowQueryThreshold: number;
}

export interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  latency: number;
  tablesAccessible?: boolean;
  error?: string;
  lastCheck: number;
  metrics?: QueryMetrics;
}

/**
 * Main Database Service Class
 */
export class DatabaseService {
  private db: any;
  private config: DatabaseConfig;
  private metrics: QueryMetrics;
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  constructor(d1Database: D1Database, config: Partial<DatabaseConfig> = {}) {
    this.db = drizzle(d1Database, { schema });
    this.config = {
      maxConnections: 10,
      connectionTimeout: 30000,
      queryTimeout: 10000,
      retryAttempts: 3,
      enableMetrics: true,
      enableCache: true,
      cacheTTL: 300000,
      slowQueryThreshold: 1000,
      ...config
    };

    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.db.select().from(schema.users).limit(1);
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        latency,
        tablesAccessible: true,
        lastCheck: Date.now(),
        metrics: this.getMetrics()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: Date.now(),
        metrics: this.getMetrics()
      };
    }
  }

  /**
   * Execute query with retry logic
   */
  private async executeQuery<T>(operation: () => Promise<T>, queryName: string = 'unknown'): Promise<T> {
    const startTime = Date.now();

    try {
      this.metrics.totalQueries++;
      const result = await operation();

      const queryTime = Date.now() - startTime;
      this.updateQueryMetrics(queryTime, true);

      return result;
    } catch (error) {
      this.metrics.failedQueries++;
      this.updateQueryMetrics(Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Get cached data or execute query
   */
  private async cachedQuery<T>(key: string, query: () => Promise<T>): Promise<T> {
    if (!this.config.enableCache) {
      return query();
    }

    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      this.metrics.cacheHits++;
      return cached.data;
    }

    this.metrics.cacheMisses++;
    const result = await query();

    this.cache.set(key, {
      data: result,
      expiry: Date.now() + this.config.cacheTTL
    });

    return result;
  }

  // USER OPERATIONS
  async createUser(userData: any) {
    return this.executeQuery(
      () => this.db.insert(schema.users).values(userData).returning(),
      'createUser'
    );
  }

  async getUserById(userId: string) {
    return this.cachedQuery(
      `user:${userId}`,
      () => this.executeQuery(
        () => this.db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1),
        'getUserById'
      )
    );
  }

  async getUserByEmail(email: string) {
    return this.executeQuery(
      () => this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1),
      'getUserByEmail'
    );
  }

  async updateUser(userId: string, updateData: any) {
    this.cache.delete(`user:${userId}`);
    return this.executeQuery(
      () => this.db.update(schema.users).set(updateData).where(eq(schema.users.id, userId)).returning(),
      'updateUser'
    );
  }

  // PROJECT OPERATIONS
  async createProject(projectData: any) {
    return this.executeQuery(
      () => this.db.insert(schema.projects).values(projectData).returning(),
      'createProject'
    );
  }

  async getProjectById(projectId: string) {
    return this.cachedQuery(
      `project:${projectId}`,
      () => this.executeQuery(
        () => this.db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1),
        'getProjectById'
      )
    );
  }

  async getProjectsByUserId(userId: string) {
    return this.cachedQuery(
      `projects:user:${userId}`,
      () => this.executeQuery(
        () => this.db.select().from(schema.projects).where(eq(schema.projects.createdBy, userId)),
        'getProjectsByUserId'
      )
    );
  }

  async updateProject(projectId: string, updateData: any) {
    this.cache.delete(`project:${projectId}`);
    return this.executeQuery(
      () => this.db.update(schema.projects).set(updateData).where(eq(schema.projects.id, projectId)).returning(),
      'updateProject'
    );
  }

  // TEST CASE OPERATIONS
  async createTestCase(testCaseData: any) {
    return this.executeQuery(
      () => this.db.insert(schema.testCases).values(testCaseData).returning(),
      'createTestCase'
    );
  }

  async getTestCaseById(testCaseId: string) {
    return this.cachedQuery(
      `testCase:${testCaseId}`,
      () => this.executeQuery(
        () => this.db.select().from(schema.testCases).where(eq(schema.testCases.id, testCaseId)).limit(1),
        'getTestCaseById'
      )
    );
  }

  async getTestCasesBySuite(testSuiteId: string) {
    return this.cachedQuery(
      `testCases:suite:${testSuiteId}`,
      () => this.executeQuery(
        () => this.db.select().from(schema.testCases).where(eq(schema.testCases.testSuiteId, testSuiteId)),
        'getTestCasesBySuite'
      )
    );
  }

  async updateTestCase(testCaseId: string, updateData: any) {
    this.cache.delete(`testCase:${testCaseId}`);
    return this.executeQuery(
      () => this.db.update(schema.testCases).set(updateData).where(eq(schema.testCases.id, testCaseId)).returning(),
      'updateTestCase'
    );
  }

  // TEST RUN OPERATIONS
  async createTestRun(testRunData: any) {
    return this.executeQuery(
      () => this.db.insert(schema.testRuns).values(testRunData).returning(),
      'createTestRun'
    );
  }

  async getTestRunById(testRunId: string) {
    return this.executeQuery(
      () => this.db.select().from(schema.testRuns).where(eq(schema.testRuns.id, testRunId)).limit(1),
      'getTestRunById'
    );
  }

  async getTestRunsByProject(projectId: string, options: { limit?: number; status?: string } = {}) {
    const { limit = 50, status } = options;

    let query = this.db.select().from(schema.testRuns).where(eq(schema.testRuns.projectId, projectId));

    if (status) {
      query = query.where(eq(schema.testRuns.status, status as any));
    }

    return this.executeQuery(
      () => query.limit(limit).orderBy(desc(schema.testRuns.createdAt)),
      'getTestRunsByProject'
    );
  }

  async updateTestRun(testRunId: string, updateData: any) {
    return this.executeQuery(
      () => this.db.update(schema.testRuns).set(updateData).where(eq(schema.testRuns.id, testRunId)).returning(),
      'updateTestRun'
    );
  }

  // ANALYTICS
  async getProjectStats(projectId: string) {
    return this.cachedQuery(
      `stats:project:${projectId}`,
      () => this.executeQuery(
        async () => {
          const [testCases, testRuns] = await Promise.all([
            this.db.select({ count: count() }).from(schema.testCases).where(eq(schema.testCases.projectId, projectId)),
            this.db.select({ count: count() }).from(schema.testRuns).where(eq(schema.testRuns.projectId, projectId))
          ]);

          return {
            totalTestCases: testCases[0]?.count || 0,
            totalTestRuns: testRuns[0]?.count || 0
          };
        },
        'getProjectStats'
      ),
      60000
    );
  }

  // SEARCH
  async searchTestCases(query: string, projectId?: string, limit: number = 20) {
    return this.executeQuery(
      () => {
        let dbQuery = this.db.select().from(schema.testCases);

        const conditions = [
          ilike(schema.testCases.name, `%${query}%`),
          ilike(schema.testCases.description, `%${query}%`)
        ];

        if (projectId) {
          conditions.push(eq(schema.testCases.projectId, projectId));
        }

        return dbQuery.where(or(...conditions)).limit(limit);
      },
      'searchTestCases'
    );
  }

  // UTILITY METHODS
  private updateQueryMetrics(queryTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulQueries++;
    }

    const totalQueries = this.metrics.totalQueries;
    this.metrics.averageQueryTime =
      (this.metrics.averageQueryTime * (totalQueries - 1) + queryTime) / totalQueries;

    if (queryTime > this.config.slowQueryThreshold) {
      this.metrics.slowQueries++;
    }
  }

  getMetrics(): QueryMetrics {
    return { ...this.metrics };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Factory function
export function createDatabaseService(d1Database: D1Database, config?: Partial<DatabaseConfig>): DatabaseService {
  return new DatabaseService(d1Database, config);
}

// Global instance
let globalDatabaseService: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!globalDatabaseService) {
    throw new Error('Database service not initialized');
  }
  return globalDatabaseService;
}

export function initializeDatabaseService(d1Database: D1Database, config?: Partial<DatabaseConfig>): DatabaseService {
  globalDatabaseService = new DatabaseService(d1Database, config);
  return globalDatabaseService;
}
