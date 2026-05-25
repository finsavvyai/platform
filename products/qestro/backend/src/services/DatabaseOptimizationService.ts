/**
 * Database Optimization Service
 * Query optimization, indexing, and performance monitoring for PostgreSQL
 */

import { DatabaseService } from './DatabaseService.js';
import { logger } from '../utils/logger.js';

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  rowsReturned: number;
  memoryUsage: number;
  indexHits: number;
  indexMisses: number;
  cacheHitRatio: number;
  timestamp: Date;
}

export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  indexType: 'btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin';
  estimatedPerformanceGain: number;
  priority: 'high' | 'medium' | 'low';
  existingIndexes: string[];
}

export interface TableStats {
  tableName: string;
  totalRows: number;
  estimatedSize: number;
  indexCount: number;
  vacuumStatus: string;
  analyzeStatus: string;
  lastVacuum: Date;
  lastAnalyze: Date;
  deadRows: number;
  bloat: number;
}

export interface QueryAnalysis {
  query: string;
  normalizedQuery: string;
  executionPlan: any;
  estimatedCost: number;
  estimatedRows: number;
  suggestedIndex?: IndexRecommendation;
  performanceIssues: string[];
  recommendations: string[];
}

export class DatabaseOptimizationService {
  private db: DatabaseService;
  private queryMetrics: Map<string, QueryPerformanceMetrics[]> = new Map();
  private slowQueryThreshold: number;
  private enableAutoAnalysis: boolean;

  constructor(db: DatabaseService, options: {
    slowQueryThreshold?: number;
    enableAutoAnalysis?: boolean;
  } = {}) {
    this.db = db;
    this.slowQueryThreshold = options.slowQueryThreshold || 100; // milliseconds
    this.enableAutoAnalysis = options.enableAutoAnalysis !== false;
  }

  /**
   * Execute query with performance monitoring
   */
  async executeQueryWithMetrics<T>(
    query: string,
    params: any[] = [],
    options: {
      normalize?: boolean;
      collectMetrics?: boolean;
      analyzeIfSlow?: boolean;
    } = {}
  ): Promise<{ data: T; metrics: QueryPerformanceMetrics | null }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const data = await this.db.query(query, params);
      const executionTime = Date.now() - startTime;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;

      let metrics: QueryPerformanceMetrics | null = null;

      if (options.collectMetrics !== false) {
        metrics = {
          query: options.normalize ? this.normalizeQuery(query) : query,
          executionTime,
          rowsReturned: data.rowCount,
          memoryUsage,
          indexHits: 0, // Will be populated from EXPLAIN
          indexMisses: 0,
          cacheHitRatio: 0,
          timestamp: new Date(),
        };

        // Collect additional metrics
        await this.enrichQueryMetrics(metrics);

        // Store metrics for analysis
        this.storeQueryMetrics(metrics);

        // Auto-analyze slow queries
        if (this.enableAutoAnalysis && executionTime > this.slowQueryThreshold && options.analyzeIfSlow !== false) {
          this.analyzeSlowQuery(query, params);
        }

        // Log slow queries
        if (executionTime > this.slowQueryThreshold) {
          logger.warn(`Slow query detected (${executionTime}ms): ${query}`, {
            executionTime,
            rowsReturned: data.rowCount,
            parameters: params.length > 0 ? params : undefined,
          });
        }
      }

      return { data, metrics };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Query failed (${executionTime}ms): ${query}`, { error, parameters: params });
      throw error;
    }
  }

  /**
   * Normalize query for comparison
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\s*=\s*/g, ' = ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      .replace(/\s*;\s*$/, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Enrich query metrics with database performance data
   */
  private async enrichQueryMetrics(metrics: QueryPerformanceMetrics): Promise<void> {
    try {
      // Get index usage statistics
      const indexStatsQuery = `
        SELECT
          idx_scan as index_hits,
          idx_tup_read as rows_read_from_index,
          idx_tup_fetch as rows_fetched_from_index
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        LIMIT 1
      `;

      const indexStats = await this.db.query(indexStatsQuery);
      if (indexStats.rows.length > 0) {
        metrics.indexHits = parseInt(indexStats.rows[0].index_hits) || 0;
      }

      // Get cache hit ratio
      const cacheQuery = `
        SELECT
          heap_blks_hit * 100.0 / (heap_blks_hit + heap_blks_read) as cache_hit_ratio
        FROM pg_statio_user_tables
        WHERE heap_blks_hit + heap_blks_read > 0
        LIMIT 1
      `;

      const cacheStats = await this.db.query(cacheQuery);
      if (cacheStats.rows.length > 0) {
        metrics.cacheHitRatio = parseFloat(cacheStats.rows[0].cache_hit_ratio) || 0;
      }

    } catch (error) {
      logger.error('Failed to enrich query metrics:', error);
    }
  }

  /**
   * Store query metrics for analysis
   */
  private storeQueryMetrics(metrics: QueryPerformanceMetrics): void {
    const normalizedQuery = metrics.query;

    if (!this.queryMetrics.has(normalizedQuery)) {
      this.queryMetrics.set(normalizedQuery, []);
    }

    const queryHistory = this.queryMetrics.get(normalizedQuery)!;
    queryHistory.push(metrics);

    // Keep only last 100 executions
    if (queryHistory.length > 100) {
      queryHistory.shift();
    }
  }

  /**
   * Analyze slow query and provide recommendations
   */
  private async analyzeSlowQuery(query: string, params: any[]): Promise<void> {
    try {
      const analysis = await this.explainQuery(query, params);

      if (analysis.estimatedCost > 1000 || analysis.performanceIssues.length > 0) {
        logger.warn('Slow query analysis:', {
          query,
          estimatedCost: analysis.estimatedCost,
          estimatedRows: analysis.estimatedRows,
          issues: analysis.performanceIssues,
          recommendations: analysis.recommendations,
        });
      }

    } catch (error) {
      logger.error('Failed to analyze slow query:', error);
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(tableName?: string): Promise<TableStats[]> {
    try {
      let whereClause = '';
      let params: any[] = [];

      if (tableName) {
        whereClause = 'WHERE t.tablename = $1';
        params = [tableName];
      }

      const query = `
        SELECT
          t.tablename as table_name,
          s.n_live_tup as total_rows,
          s.n_dead_tup as dead_rows,
          pg_total_relation_size(t.schemaname || '.' || t.tablename) as estimated_size,
          (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.tablename) as index_count,
          s.last_vacuum,
          s.last_autovacuum,
          s.last_analyze,
          s.last_autoanalyze,
          COALESCE(s.n_dead_tup * 100.0 / (s.n_live_tup + s.n_dead_tup), 0) as bloat_percentage,
          CASE
            WHEN s.last_vacuum IS NOT NULL OR s.last_autovacuum IS NOT NULL THEN 'completed'
            ELSE 'pending'
          END as vacuum_status,
          CASE
            WHEN s.last_analyze IS NOT NULL OR s.last_autoanalyze IS NOT NULL THEN 'completed'
            ELSE 'pending'
          END as analyze_status
        FROM pg_tables t
        LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname
        WHERE t.schemaname = 'public'
        ${whereClause}
        ORDER BY n_live_tup DESC
      `;

      const result = await this.db.query(query, params);

      return result.rows.map((row: any) => ({
        tableName: row.table_name,
        totalRows: parseInt(row.total_rows) || 0,
        estimatedSize: parseInt(row.estimated_size) || 0,
        indexCount: parseInt(row.index_count) || 0,
        vacuumStatus: row.vacuum_status,
        analyzeStatus: row.analyze_status,
        lastVacuum: row.last_vacuum,
        lastAnalyze: row.last_analyze,
        deadRows: parseInt(row.dead_rows) || 0,
        bloat: parseFloat(row.bloat_percentage) || 0,
      }));

    } catch (error) {
      logger.error('Failed to get table statistics:', error);
      return [];
    }
  }

  /**
   * Get index recommendations
   */
  async getIndexRecommendations(): Promise<IndexRecommendation[]> {
    try {
      const recommendations: IndexRecommendation[] = [];

      // Find queries that are frequently slow
      const slowQueries = this.getFrequentSlowQueries();

      for (const queryMetrics of slowQueries) {
        const analysis = await this.explainQuery(queryMetrics.query);
        if (analysis.suggestedIndex) {
          recommendations.push(analysis.suggestedIndex);
        }
      }

      // Additional analysis for missing indexes
      const missingIndexesQuery = `
        SELECT
          schemaname || '.' || tablename as table_name,
          indexrelname as index_name,
          idx_scan as index_usage,
          idx_tup_read as rows_read,
          idx_tup_fetch as rows_fetched
        FROM pg_stat_user_indexes
        WHERE idx_scan < 10
        ORDER BY idx_scan ASC
        LIMIT 10
      `;

      const result = await this.db.query(missingIndexesQuery);

      for (const row of result.rows) {
        recommendations.push({
          tableName: row.table_name,
          columns: [], // Would need query analysis to determine columns
          indexType: 'btree',
          estimatedPerformanceGain: 50,
          priority: row.index_usage === 0 ? 'high' : 'medium',
          existingIndexes: [row.index_name],
        });
      }

      return recommendations;

    } catch (error) {
      logger.error('Failed to get index recommendations:', error);
      return [];
    }
  }

  /**
   * Get frequently executed slow queries
   */
  private getFrequentSlowQueries(): QueryPerformanceMetrics[] {
    const slowQueries: QueryPerformanceMetrics[] = [];

    for (const [query, metrics] of this.queryMetrics.entries()) {
      const avgExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;

      if (avgExecutionTime > this.slowQueryThreshold && metrics.length > 5) {
        slowQueries.push({
          query,
          executionTime: avgExecutionTime,
          rowsReturned: metrics.reduce((sum, m) => sum + m.rowsReturned, 0) / metrics.length,
          memoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length,
          indexHits: metrics.reduce((sum, m) => sum + m.indexHits, 0) / metrics.length,
          indexMisses: metrics.reduce((sum, m) => sum + m.indexMisses, 0) / metrics.length,
          cacheHitRatio: metrics.reduce((sum, m) => sum + m.cacheHitRatio, 0) / metrics.length,
          timestamp: new Date(),
        });
      }
    }

    return slowQueries;
  }

  /**
   * Explain query execution plan
   */
  async explainQuery(query: string, params: any[] = []): Promise<QueryAnalysis> {
    try {
      const explainQuery = `EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS) ${query}`;
      const result = await this.db.query(explainQuery, params);

      const plan = JSON.parse(result.rows[0]['QUERY PLAN'])[0];
      const executionPlan = plan.Plan;

      return {
        query,
        normalizedQuery: this.normalizeQuery(query),
        executionPlan,
        estimatedCost: executionPlan['Total Cost'] || 0,
        estimatedRows: executionPlan['Plan Rows'] || 0,
        performanceIssues: this.analyzeExecutionPlan(executionPlan),
        recommendations: this.generateRecommendations(executionPlan),
      };

    } catch (error) {
      logger.error('Failed to explain query:', error);
      return {
        query,
        normalizedQuery: this.normalizeQuery(query),
        executionPlan: null,
        estimatedCost: 0,
        estimatedRows: 0,
        performanceIssues: ['Failed to analyze query'],
        recommendations: ['Check query syntax and try again'],
      };
    }
  }

  /**
   * Analyze execution plan for performance issues
   */
  private analyzeExecutionPlan(plan: any): string[] {
    const issues: string[] = [];

    const checkPlan = (node: any, depth = 0) => {
      if (!node) return;

      // Check for Seq Scan on large tables
      if (node['Node Type'] === 'Seq Scan' && (node['Plan Rows'] || 0) > 10000) {
        issues.push(`Sequential scan on large table (estimated ${node['Plan Rows']} rows)`);
      }

      // Check for missing indexes in filter conditions
      if (node['Node Type'] === 'Seq Scan' && node['Filter']) {
        issues.push('Potential missing index for filter condition');
      }

      // Check for expensive joins
      if (node['Node Type'] === 'Hash Join' && (node['Plan Rows'] || 0) > 10000) {
        issues.push('Expensive hash join operation');
      }

      // Check for high cost
      if ((node['Total Cost'] || 0) > 10000) {
        issues.push('High execution cost detected');
      }

      // Recursively check child nodes
      if (node.Plans) {
        node.Plans.forEach((child: any) => checkPlan(child, depth + 1));
      }
    };

    checkPlan(plan);
    return issues;
  }

  /**
   * Generate recommendations based on execution plan
   */
  private generateRecommendations(plan: any): string[] {
    const recommendations: string[] = [];

    const checkPlanForRecommendations = (node: any) => {
      if (!node) return;

      if (node['Node Type'] === 'Seq Scan') {
        recommendations.push('Consider adding indexes for frequently queried columns');
      }

      if (node['Node Type'] === 'Hash Join') {
        recommendations.push('Ensure join columns are properly indexed');
      }

      if (node['Actual Loops'] > 1) {
        recommendations.push('Consider query optimization to reduce execution loops');
      }

      if (node.Plans) {
        node.Plans.forEach((child: any) => checkPlanForRecommendations(child));
      }
    };

    checkPlanForRecommendations(plan);

    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push('Query appears well-optimized');
    }

    return recommendations;
  }

  /**
   * Create recommended index
   */
  async createIndex(tableName: string, columns: string[], indexType: string = 'btree'): Promise<boolean> {
    try {
      const indexName = `idx_${tableName}_${columns.join('_')}`;
      const createIndexQuery = `
        CREATE INDEX CONCURRENTLY ${indexName}
        ON ${tableName} USING ${indexType} (${columns.join(', ')})
      `;

      await this.db.query(createIndexQuery);
      logger.info(`Created index ${indexName} on table ${tableName}`);
      return true;

    } catch (error) {
      logger.error(`Failed to create index on ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Vacuum and analyze table
   */
  async vacuumAnalyze(tableName: string, options: {
    full?: boolean;
    analyze?: boolean;
    verbose?: boolean;
  } = {}): Promise<boolean> {
    try {
      const vacuumOptions = [];
      if (options.full) vacuumOptions.push('FULL');
      if (options.analyze !== false) vacuumOptions.push('ANALYZE');
      if (options.verbose) vacuumOptions.push('VERBOSE');

      const optionString = vacuumOptions.length > 0 ? `(${vacuumOptions.join(', ')})` : '';
      const query = `VACUUM ${optionString} ${tableName}`;

      await this.db.query(query);
      logger.info(`Vacuum/analyze completed for table ${tableName}`);
      return true;

    } catch (error) {
      logger.error(`Failed to vacuum/analyze table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Get query performance metrics summary
   */
  getQueryMetricsSummary(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    cacheHitRatio: number;
    topSlowQueries: Array<{
      query: string;
      avgTime: number;
      executions: number;
    }>;
  } {
    let totalQueries = 0;
    let totalTime = 0;
    let slowQueryCount = 0;
    let totalCacheHits = 0;
    let totalCacheHitsPlusMisses = 0;

    const slowQueryList: Array<{
      query: string;
      avgTime: number;
      executions: number;
    }> = [];

    for (const [query, metrics] of this.queryMetrics.entries()) {
      const avgTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
      const executions = metrics.length;

      totalQueries += executions;
      totalTime += metrics.reduce((sum, m) => sum + m.executionTime, 0);

      if (avgTime > this.slowQueryThreshold) {
        slowQueryCount += executions;
        slowQueryList.push({ query, avgTime, executions });
      }

      // Calculate cache statistics
      for (const metric of metrics) {
        totalCacheHits += metric.cacheHitRatio * 100; // Convert to percentage
        totalCacheHitsPlusMisses += 100;
      }
    }

    const averageExecutionTime = totalQueries > 0 ? totalTime / totalQueries : 0;
    const cacheHitRatio = totalCacheHitsPlusMisses > 0 ? totalCacheHits / totalCacheHitsPlusMisses : 0;

    // Sort and limit top slow queries
    slowQueryList.sort((a, b) => b.avgTime - a.avgTime);
    const topSlowQueries = slowQueryList.slice(0, 10);

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries: slowQueryCount,
      cacheHitRatio,
      topSlowQueries,
    };
  }

  /**
   * Clear query metrics
   */
  clearMetrics(): void {
    this.queryMetrics.clear();
    logger.info('Database optimization metrics cleared');
  }
}

// Export singleton instance
export const dbOptimizationService = new DatabaseOptimizationService(
  DatabaseService.getInstance(),
  {
    slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '100'),
    enableAutoAnalysis: process.env.DB_ENABLE_AUTO_ANALYSIS !== 'false',
  }
);

export default dbOptimizationService;