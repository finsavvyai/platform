/**
 * Database Performance Controller
 * Provides performance monitoring and optimization APIs
 */
import { DatabaseService } from './database.js';

export class DatabasePerformanceController {
  constructor(env) {
    this.env = env;
    this.db = env.db || new DatabaseService(env);
  }

  /**
   * Get comprehensive database performance metrics
   */
  async getPerformanceMetrics() {
    try {
      const metrics = this.db.getPerformanceMetrics();
      const recommendations = this.db.getPerformanceRecommendations();

      return {
        success: true,
        data: {
          metrics,
          recommendations,
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve performance metrics',
        error_code: 'metrics_retrieval_failed',
        details: error.message
      };
    }
  }

  /**
   * Get slow queries analysis
   */
  async getSlowQueries(options = {}) {
    const { limit = 50, minTime = 50 } = options;

    try {
      const query = `
        SELECT
          metric_name,
          table_name,
          AVG(execution_time_ms) as avg_execution_time,
          MAX(execution_time_ms) as max_execution_time,
          COUNT(*) as execution_count,
          created_at
        FROM performance_stats
        WHERE execution_time_ms > ?
        GROUP BY metric_name, table_name
        ORDER BY avg_execution_time DESC
        LIMIT ?
      `;

      const result = await this.db.executeQuery(query, [minTime, limit]);

      return {
        success: true,
        data: {
          slow_queries: result.results || [],
          analysis: {
            total_slow_queries: result.results?.length || 0,
            average_slow_query_time: result.results?.length > 0
              ? result.results.reduce((sum, q) => sum + q.avg_execution_time, 0) / result.results.length
              : 0,
            threshold_ms: minTime
          },
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve slow queries',
        error_code: 'slow_queries_failed',
        details: error.message
      };
    }
  }

  /**
   * Get cache performance analysis
   */
  async getCachePerformance() {
    try {
      const query = `
        SELECT
          table_name,
          query_type,
          COUNT(*) as total_queries,
          SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
          ROUND(
            (SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) * 100.0) / COUNT(*),
            2
          ) as cache_hit_rate_percent
        FROM performance_stats
        WHERE created_at > datetime('now', '-24 hours')
        GROUP BY table_name, query_type
        ORDER BY cache_hit_rate_percent ASC
      `;

      const result = await this.db.executeQuery(query);

      const overallHitRate = result.results?.length > 0
        ? result.results.reduce((sum, r) => sum + r.cache_hit_rate_percent, 0) / result.results.length
        : 0;

      return {
        success: true,
        data: {
          cache_performance: result.results || [],
          overall_hit_rate: Math.round(overallHitRate * 100) / 100,
          recommendations: this.generateCacheRecommendations(overallHitRate, result.results || []),
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve cache performance',
        error_code: 'cache_performance_failed',
        details: error.message
      };
    }
  }

  /**
   * Get index performance recommendations
   */
  async getIndexRecommendations() {
    try {
      const indexesMigration = this.db.generatePerformanceIndexes();

      return {
        success: true,
        data: {
          recommended_indexes: this.parseIndexMigration(indexesMigration),
          migration_sql: indexesMigration,
          estimated_improvements: [
            {
              table: 'team_audit_log',
              query_type: 'analytics',
              expected_improvement: '60-80%',
              reason: 'Composite index on team_id, action, created_at'
            },
            {
              table: 'team_members',
              query_type: 'member_lookup',
              expected_improvement: '40-60%',
              reason: 'Composite index on team_id, status, role'
            },
            {
              table: 'conversations',
              query_type: 'conversation_history',
              expected_improvement: '50-70%',
              reason: 'Composite index on user_id, session_id, created_at'
            }
          ],
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to generate index recommendations',
        error_code: 'index_recommendations_failed',
        details: error.message
      };
    }
  }

  /**
   * Run performance optimization
   */
  async runOptimization(options = {}) {
    const { dryRun = true, analyzeTables = true, createIndexes = false } = options;

    try {
      const results = {
        analysis: null,
        optimization_results: [],
        recommendations: []
      };

      if (analyzeTables) {
        // Analyze table statistics
        const tables = ['users', 'teams', 'team_members', 'team_audit_log', 'conversations', 'usage_stats'];
        const analysisResults = [];

        for (const table of tables) {
          try {
            const analyzeQuery = `ANALYZE ${table}`;
            await this.db.executeQuery(analyzeQuery);
            analysisResults.push({ table, status: 'analyzed' });
          } catch (error) {
            analysisResults.push({ table, status: 'failed', error: error.message });
          }
        }

        results.analysis = analysisResults;
      }

      if (createIndexes && !dryRun) {
        // Create performance indexes
        const indexesMigration = this.db.generatePerformanceIndexes();
        const indexStatements = this.parseIndexMigration(indexesMigration);

        for (const statement of indexStatements) {
          try {
            await this.db.executeQuery(statement.sql);
            results.optimization_results.push({
              type: 'index_created',
              table: statement.table,
              index: statement.index_name,
              status: 'success'
            });
          } catch (error) {
            results.optimization_results.push({
              type: 'index_creation_failed',
              table: statement.table,
              index: statement.index_name,
              status: 'failed',
              error: error.message
            });
          }
        }
      }

      // Generate recommendations
      const metrics = this.db.getPerformanceMetrics();
      results.recommendations = this.generateOptimizationRecommendations(metrics, dryRun);

      return {
        success: true,
        data: {
          ...results,
          dry_run: dryRun,
          completed_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Optimization failed',
        error_code: 'optimization_failed',
        details: error.message
      };
    }
  }

  /**
   * Get query execution plan
   */
  async getQueryPlan(query, params = []) {
    try {
      // Add EXPLAIN QUERY PLAN to get execution details
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
      const result = await this.db.executeQuery(explainQuery, params);

      return {
        success: true,
        data: {
          original_query: query,
          params,
          execution_plan: result.results || [],
          recommendations: this.analyzeQueryPlan(result.results || []),
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to analyze query plan',
        error_code: 'query_plan_failed',
        details: error.message
      };
    }
  }

  /**
   * Get database health check
   */
  async getHealthCheck() {
    try {
      const startTime = performance.now();

      // Test basic database connectivity
      const testQuery = 'SELECT 1 as test';
      const connectivityResult = await this.db.executeQuery(testQuery);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const metrics = this.db.getPerformanceMetrics();
      const slowQueries = await this.getSlowQueries({ limit: 10 });

      const health = {
        status: 'healthy',
        response_time_ms: Math.round(responseTime * 100) / 100,
        connectivity_test: connectivityResult.success,
        performance_metrics: {
          total_queries: metrics.totalQueries,
          average_query_time_ms: Math.round(metrics.avgQueryTime * 100) / 100,
          slow_queries_count: metrics.slowQueries,
          cache_hit_rate: Math.round(metrics.cacheHitRate * 10000) / 100, // Convert to percentage
          active_connections: metrics.activeQueries
        },
        recent_slow_queries: slowQueries.data?.slow_queries?.slice(0, 5) || [],
        recommendations: []
      };

      // Determine overall health status
      if (responseTime > 100) {
        health.status = 'degraded';
        health.recommendations.push('Database response time is high (>100ms)');
      }

      if (metrics.slowQueries > metrics.totalQueries * 0.1) {
        health.status = 'degraded';
        health.recommendations.push('High percentage of slow queries detected');
      }

      if (metrics.cacheHitRate < 0.7) {
        health.recommendations.push('Cache hit rate is below optimal (>70%)');
      }

      return {
        success: true,
        data: {
          ...health,
          checked_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Health check failed',
        error_code: 'health_check_failed',
        details: error.message,
        data: {
          status: 'unhealthy',
          checked_at: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(options = {}) {
    const { period = '24h', includeRecommendations = true, includeQueryPlans = false } = options;

    try {
      const metrics = this.db.getPerformanceMetrics();
      const slowQueries = await this.getSlowQueries({ limit: 100 });
      const cachePerformance = await this.getCachePerformance();
      const indexRecommendations = await this.getIndexRecommendations();

      const report = {
        period,
        generated_at: new Date().toISOString(),
        summary: {
          total_queries: metrics.totalQueries,
          average_response_time_ms: Math.round(metrics.avgQueryTime * 100) / 100,
          slow_queries_percentage: Math.round((metrics.slowQueries / metrics.totalQueries) * 10000) / 100,
          cache_hit_rate_percentage: Math.round(metrics.cacheHitRate * 10000) / 100,
          overall_performance_score: this.calculatePerformanceScore(metrics)
        },
        details: {
          metrics,
          slow_queries: slowQueries.data?.slow_queries || [],
          cache_performance: cachePerformance.data?.cache_performance || []
        }
      };

      if (includeRecommendations) {
        report.recommendations = [
          ...cachePerformance.data?.recommendations || [],
          ...indexRecommendations.data?.estimated_improvements || [],
          ...this.generateOptimizationRecommendations(metrics)
        ];
      }

      if (includeQueryPlans) {
        // Add query plans for top slow queries
        report.query_plans = await this.generateTopSlowQueryPlans(slowQueries.data?.slow_queries?.slice(0, 5) || []);
      }

      return {
        success: true,
        data: report
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to generate performance report',
        error_code: 'report_generation_failed',
        details: error.message
      };
    }
  }

  // Private helper methods

  parseIndexMigration(migrationSql) {
    const lines = migrationSql.split('\n');
    const statements = [];

    let currentStatement = '';
    let inStatement = false;
    let currentTable = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('--')) continue;

      if (trimmedLine.toUpperCase().startsWith('CREATE INDEX')) {
        inStatement = true;
        currentStatement = trimmedLine;

        // Extract table and index name
        const indexMatch = trimmedLine.match(/idx_\w+_([^_\s]+)/);
        const tableMatch = trimmedLine.match(/ON (\w+)/);

        currentTable = tableMatch ? tableMatch[1] : 'unknown';
      } else if (inStatement) {
        currentStatement += ' ' + trimmedLine;

        if (trimmedLine.endsWith(';')) {
          const indexNameMatch = currentStatement.match(/CREATE INDEX IF NOT EXISTS (\w+)/);
          statements.push({
            sql: currentStatement,
            table: currentTable,
            index_name: indexNameMatch ? indexNameMatch[1] : 'unknown',
            type: 'index'
          });

          inStatement = false;
          currentStatement = '';
          currentTable = '';
        }
      }
    }

    return statements;
  }

  generateCacheRecommendations(overallHitRate, cacheData) {
    const recommendations = [];

    if (overallHitRate < 0.7) {
      recommendations.push({
        priority: 'high',
        category: 'cache_performance',
        description: `Overall cache hit rate is ${(overallHitRate * 100).toFixed(1)}% (target: >70%)`,
        actions: [
          'Increase cache TTL for frequently accessed data',
          'Cache more query results',
          'Implement cache warming strategies'
        ]
      });
    }

    const lowHitRateTables = cacheData.filter(table => table.cache_hit_rate_percent < 50);
    if (lowHitRateTables.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'table_cache',
        description: `${lowHitRateTables.length} tables have low cache hit rates`,
        actions: lowHitRateTables.map(table =>
          `Optimize caching for ${table.table_name} ${table.query_type} queries`
        )
      });
    }

    return recommendations;
  }

  generateOptimizationRecommendations(metrics, dryRun = true) {
    const recommendations = [];

    if (metrics.avgQueryTime > 30) {
      recommendations.push({
        type: 'query_optimization',
        priority: 'high',
        description: `Average query time is ${metrics.avgQueryTime.toFixed(1)}ms (target: <30ms)`,
        actions: [
          'Add composite indexes for common query patterns',
          'Optimize frequently executed slow queries',
          'Consider query result pagination'
        ]
      });
    }

    if (metrics.slowQueries > metrics.totalQueries * 0.1) {
      recommendations.push({
        type: 'slow_queries',
        priority: 'high',
        description: `${((metrics.slowQueries / metrics.totalQueries) * 100).toFixed(1)}% of queries are slow`,
        actions: [
          'Review and optimize slow queries',
          'Add appropriate database indexes',
          'Implement query result caching'
        ]
      });
    }

    if (metrics.cacheHitRate < 0.8) {
      recommendations.push({
        type: 'cache_optimization',
        priority: 'medium',
        description: `Cache hit rate is ${(metrics.cacheHitRate * 100).toFixed(1)}% (target: >80%)`,
        actions: [
          'Increase cache TTL for stable data',
          'Implement cache warming for popular queries',
          'Review cache invalidation strategy'
        ]
      });
    }

    if (dryRun) {
      recommendations.push({
        type: 'dry_run_notice',
        priority: 'info',
        description: 'This was a dry run. No optimizations were applied.',
        actions: ['Run with dryRun=false to apply optimizations']
      });
    }

    return recommendations;
  }

  analyzeQueryPlan(executionPlan) {
    const recommendations = [];

    for (const step of executionPlan) {
      if (step.detail && step.detail.includes('SCAN')) {
        recommendations.push({
          type: 'table_scan',
          severity: 'medium',
          description: 'Table scan detected - consider adding index',
          suggestion: `Add index on columns used in WHERE clause for ${step.table || 'table'}`
        });
      }

      if (step.detail && step.detail.includes('TEMP B-TREE')) {
        recommendations.push({
          type: 'temporary_index',
          severity: 'low',
          description: 'Temporary index created - query could benefit from permanent index',
          suggestion: 'Consider creating a permanent index for this query pattern'
        });
      }
    }

    return recommendations;
  }

  calculatePerformanceScore(metrics) {
    let score = 100;

    // Deduct points for slow average query time
    if (metrics.avgQueryTime > 50) score -= 30;
    else if (metrics.avgQueryTime > 30) score -= 15;
    else if (metrics.avgQueryTime > 20) score -= 5;

    // Deduct points for low cache hit rate
    if (metrics.cacheHitRate < 0.5) score -= 25;
    else if (metrics.cacheHitRate < 0.7) score -= 15;
    else if (metrics.cacheHitRate < 0.8) score -= 5;

    // Deduct points for high percentage of slow queries
    const slowQueryPercentage = metrics.slowQueries / Math.max(metrics.totalQueries, 1);
    if (slowQueryPercentage > 0.2) score -= 20;
    else if (slowQueryPercentage > 0.1) score -= 10;
    else if (slowQueryPercentage > 0.05) score -= 5;

    return Math.max(0, Math.round(score));
  }

  async generateTopSlowQueryPlans(slowQueries) {
    const plans = [];

    for (const queryInfo of slowQueries) {
      try {
        // This is conceptual - actual query reconstruction would need more context
        const planResult = await this.getQueryPlan(
          `SELECT * FROM ${queryInfo.table_name} WHERE 1=1`, // Placeholder
          []
        );

        plans.push({
          table_name: queryInfo.table_name,
          avg_execution_time: queryInfo.avg_execution_time,
          execution_plan: planResult.data?.execution_plan || [],
          recommendations: planResult.data?.recommendations || []
        });
      } catch (error) {
        plans.push({
          table_name: queryInfo.table_name,
          avg_execution_time: queryInfo.avg_execution_time,
          execution_plan: [],
          error: error.message
        });
      }
    }

    return plans;
  }
}

export default DatabasePerformanceController;