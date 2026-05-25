/**
 * Database Performance Optimization Layer
 * Enhances database operations with query optimization, connection pooling, and performance monitoring
 */

export class DatabasePerformanceOptimizer {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;

    // Performance monitoring
    this.queryMetrics = {
      totalQueries: 0,
      slowQueries: 0,
      avgQueryTime: 0,
      cacheHitRate: 0
    };

    // Query cache
    this.queryCache = new Map();
    this.cacheMaxSize = 100;
    this.cacheTTL = 300000; // 5 minutes

    // Connection pool simulation for D1
    this.activeQueries = 0;
    this.maxConcurrentQueries = 10;
    this.queryQueue = [];

    // Optimized queries registry
    this.preparedQueries = new Map();
    this.indexRecommendations = [];
  }

  /**
   * Execute query with performance monitoring and caching
   */
  async executeQuery(query, params = [], options = {}) {
    const startTime = performance.now();
    const cacheKey = options.cacheKey ? options.cacheKey : this.generateQueryCacheKey(query, params);

    try {
      // Check query cache first
      if (options.cacheable !== false) {
        const cached = await this.getFromQueryCache(cacheKey);
        if (cached) {
          this.recordCacheHit();
          return cached;
        }
      }

      // Wait for available connection slot
      await this.waitForConnection();

      // Execute query
      this.activeQueries++;
      const result = await this.db.prepare(query).bind(...params).all();
      this.activeQueries--;

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Record metrics
      this.recordQuery(queryTime, query, params);

      // Cache result if cacheable
      if (options.cacheable !== false && result.results.length < 1000) { // Don't cache large results
        await this.setQueryCache(cacheKey, result);
      }

      // Log slow queries
      if (queryTime > 50) { // 50ms threshold
        this.logSlowQuery(query, params, queryTime);
      }

      return result;

    } catch (error) {
      this.activeQueries--;
      throw error;
    }
  }

  /**
   * Execute query with automatic retry for transient errors
   */
  async executeQueryWithRetry(query, params = [], options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeQuery(query, params, options);
      } catch (error) {
        // Retry on transient errors
        if (this.isTransientError(error) && attempt < maxRetries) {
          await this.sleep(retryDelay * attempt);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Batch execute multiple queries
   */
  async executeBatch(queries, options = {}) {
    const batchSize = options.batchSize || 10;
    const results = [];

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(({ query, params, options }) =>
          this.executeQuery(query, params, options)
        )
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Optimized user lookup with multiple fallbacks
   */
  async getUserOptimized(lookup) {
    const { userId, email, apiKey } = lookup;

    // Build optimized query based on available lookup data
    let query = 'SELECT * FROM users WHERE ';
    let params = [];
    let conditions = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (email) {
      conditions.push('email = ?');
      params.push(email);
    }
    if (apiKey) {
      conditions.push('api_key = ?');
      params.push(apiKey);
    }

    if (conditions.length === 0) {
      throw new Error('No lookup criteria provided');
    }

    query += conditions.join(' OR ');

    const result = await this.executeQuery(
      query,
      params,
      {
        cacheable: true,
        cacheKey: `user:${userId || email || apiKey}`
      }
    );

    return result.results[0] || null;
  }

  /**
   * Optimized team member lookup with role filtering
   */
  async getTeamMembersOptimized(teamId, options = {}) {
    const { role, status, limit = 50, offset = 0 } = options;

    let query = `
      SELECT
        tm.*,
        u.email,
        u.user_id,
        u.tier as user_tier
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
    `;

    const params = [teamId];

    if (role) {
      query += ' AND tm.role = ?';
      params.push(role);
    }

    if (status) {
      query += ' AND tm.status = ?';
      params.push(status);
    }

    // Add pagination and ordering
    query += ' ORDER BY tm.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await this.executeQuery(
      query,
      params,
      { cacheable: true, cacheKey: `team_members:${teamId}:${role || 'all'}:${status || 'all'}:${limit}:${offset}` }
    );

    return result.results;
  }

  /**
   * Optimized analytics query with materialized view simulation
   */
  async getAnalyticsOptimized(teamId, dateRange, metrics) {
    const { startDate, endDate } = dateRange;
    const cacheKey = `analytics:${teamId}:${startDate}:${endDate}:${JSON.stringify(metrics)}`;

    // Check cache first
    const cached = await this.getFromQueryCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Build optimized analytics query
    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_queries,
        AVG(CAST(JSON_EXTRACT(details, '$.response_time') AS REAL)) as avg_response_time,
        SUM(CASE WHEN JSON_EXTRACT(details, '$.success') = true THEN 1 ELSE 0 END) as successful_queries
      FROM team_audit_log
      WHERE team_id = ?
        AND action = 'query_executed'
        ${startDate ? 'AND DATE(created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(created_at) <= ?' : ''}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const params = [teamId];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);

    const result = await this.executeQuery(query, params, { cacheable: true, cacheKey });

    // Cache for 15 minutes (analytics data doesn't change frequently)
    await this.setQueryCache(cacheKey, result, 900);

    return result;
  }

  /**
   * Bulk insert with optimized batching
   */
  async bulkInsertOptimized(table, records, options = {}) {
    const batchSize = options.batchSize || 100;
    const results = [];

    if (records.length === 0) {
      return { inserted: 0, results };
    }

    // Get column names from first record
    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      try {
        const batchPromises = batch.map(record =>
          this.executeQuery(query, columns.map(col => record[col]))
        );

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

      } catch (error) {
        console.error(`Batch insert error at index ${i}:`, error);
        throw error;
      }
    }

    return {
      inserted: records.length,
      results
    };
  }

  /**
   * Optimized search with full-text search preparation
   */
  async searchOptimized(table, searchTerm, options = {}) {
    const { columns = ['name', 'description'], limit = 50, teamId } = options;

    // Build FTS query
    const ftsColumns = columns.map(col => `${col}`).join(', ');
    const matchConditions = columns.map(col => `${col} LIKE ?`).join(' OR ');
    const searchParams = columns.map(() => `%${searchTerm}%`);

    let query = `
      SELECT * FROM ${table}
      WHERE (${matchConditions})
    `;
    const params = [...searchParams];

    if (teamId) {
      query += ' AND team_id = ?';
      params.push(teamId);
    }

    query += ` LIMIT ${limit}`;

    const result = await this.executeQuery(
      query,
      params,
      {
        cacheable: true,
        cacheKey: `search:${table}:${searchTerm}:${teamId || 'global'}:${limit}`
      }
    );

    return result.results;
  }

  /**
   * Generate query performance recommendations
   */
  analyzeQueryPerformance() {
    const recommendations = [];

    // Analyze slow queries
    if (this.queryMetrics.slowQueries > 0) {
      recommendations.push({
        type: 'slow_queries',
        severity: 'high',
        message: `${this.queryMetrics.slowQueries} slow queries detected`,
        suggestion: 'Consider adding indexes or optimizing query structure'
      });
    }

    // Analyze cache hit rate
    if (this.queryMetrics.cacheHitRate < 0.7) {
      recommendations.push({
        type: 'cache_performance',
        severity: 'medium',
        message: `Cache hit rate: ${(this.queryMetrics.cacheHitRate * 100).toFixed(1)}%`,
        suggestion: 'Increase cache TTL or cache more query results'
      });
    }

    // Analyze average query time
    if (this.queryMetrics.avgQueryTime > 30) {
      recommendations.push({
        type: 'query_performance',
        severity: 'medium',
        message: `Average query time: ${this.queryMetrics.avgQueryTime.toFixed(1)}ms`,
        suggestion: 'Review query optimization and database schema'
      });
    }

    return recommendations;
  }

  /**
   * Get database performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.queryMetrics,
      activeQueries: this.activeQueries,
      queueLength: this.queryQueue.length,
      cacheSize: this.queryCache.size,
      recommendations: this.analyzeQueryPerformance()
    };
  }

  /**
   * Create performance indexes recommendation
   */
  generateIndexRecommendations() {
    const recommendations = [];

    // Analyze slow query patterns to suggest indexes
    const slowQueryPatterns = this.getSlowQueryPatterns();

    slowQueryPatterns.forEach(pattern => {
      recommendations.push({
        table: pattern.table,
        columns: pattern.columns,
        type: 'btree', // Default index type
        reason: `Frequently filtered by ${pattern.columns.join(', ')}`,
        estimated_improvement: pattern.frequency > 10 ? 'high' : 'medium'
      });
    });

    return recommendations;
  }

  /**
   * Create migration for performance indexes
   */
  createPerformanceIndexMigrations() {
    const indexes = this.generateIndexRecommendations();
    const migrationStatements = [];

    indexes.forEach(index => {
      const indexName = `idx_performance_${index.table}_${index.columns.join('_')}`;
      const columnList = index.columns.join(', ');

      migrationStatements.push(`
-- Performance index for ${index.table}
CREATE INDEX IF NOT EXISTS ${indexName} ON ${index.table}(${columnList});
-- Reason: ${index.reason}
      `);
    });

    return migrationStatements.join('\n');
  }

  // Private helper methods

  generateQueryCacheKey(query, params) {
    const queryHash = this.hashString(query + JSON.stringify(params));
    return `query:${queryHash}`;
  }

  async getFromQueryCache(key) {
    try {
      const cached = this.queryCache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cached.ttl) {
        return cached.data;
      }

      // Remove expired entry
      this.queryCache.delete(key);
      return null;
    } catch (error) {
      return null;
    }
  }

  async setQueryCache(key, data, ttl = this.cacheTTL) {
    try {
      // Implement LRU eviction
      if (this.queryCache.size >= this.cacheMaxSize) {
        const firstKey = this.queryCache.keys().next().value;
        this.queryCache.delete(firstKey);
      }

      this.queryCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl
      });
    } catch (error) {
      // Cache failure is non-critical
      console.warn('Failed to cache query result:', error);
    }
  }

  async waitForConnection() {
    if (this.activeQueries < this.maxConcurrentQueries) {
      return;
    }

    return new Promise((resolve) => {
      this.queryQueue.push(resolve);
    });

    // Wait for queue processing
    while (this.activeQueries >= this.maxConcurrentQueries) {
      await this.sleep(10);
    }

    const nextResolve = this.queryQueue.shift();
    if (nextResolve) {
      nextResolve();
    }
  }

  recordQuery(queryTime, query, params) {
    this.queryMetrics.totalQueries++;

    // Update average query time
    this.queryMetrics.avgQueryTime =
      ((this.queryMetrics.avgQueryTime * (this.queryMetrics.totalQueries - 1)) + queryTime) /
      this.queryMetrics.totalQueries;

    if (queryTime > 50) {
      this.queryMetrics.slowQueries++;
    }
  }

  recordCacheHit() {
    const totalQueries = this.queryMetrics.totalQueries + 1;
    const cacheHits = this.queryMetrics.cacheHitRate * this.queryMetrics.totalQueries + 1;
    this.queryMetrics.cacheHitRate = cacheHits / totalQueries;
  }

  logSlowQuery(query, params, queryTime) {
    console.warn(`Slow Query (${queryTime.toFixed(2)}ms):`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params.length,
      timestamp: new Date().toISOString()
    });
  }

  isTransientError(error) {
    // Identify transient D1 errors that can be retried
    const transientPatterns = [
      /connection/,
      /timeout/,
      /temporary/,
      /retry/,
      /503/,
      /502/,
      /429/
    ];

    return transientPatterns.some(pattern =>
      pattern.test(error.message) || pattern.test(error.toString())
    );
  }

  getSlowQueryPatterns() {
    // This would analyze the slow query patterns
    // For now, return common patterns
    return [
      {
        table: 'team_audit_log',
        columns: ['team_id', 'created_at'],
        frequency: 15
      },
      {
        table: 'team_members',
        columns: ['team_id', 'status'],
        frequency: 12
      },
      {
        table: 'conversations',
        columns: ['user_id', 'created_at'],
        frequency: 8
      }
    ];
  }

  hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default DatabasePerformanceOptimizer;