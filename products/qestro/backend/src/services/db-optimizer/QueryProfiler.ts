/**
 * Query Profiler - Database Query Performance Analysis
 *
 * Tracks query execution times, identifies slow queries, detects N+1 patterns,
 * and suggests missing indexes for optimization.
 */

import { createHash } from 'crypto';
import { logger } from '../../utils/logger.js';
import type { QueryProfile, SlowQuery, IndexSuggestion, QueryStats } from './types.js';

export class QueryProfiler {
  private profiles: Map<string, QueryProfile[]> = new Map();
  private slowQueriesCache: Map<string, SlowQuery> = new Map();
  private slowQueryThresholdMs: number;
  private maxProfilesPerQuery: number;

  constructor(slowQueryThresholdMs: number = 1000, maxProfilesPerQuery: number = 100) {
    this.slowQueryThresholdMs = slowQueryThresholdMs;
    this.maxProfilesPerQuery = maxProfilesPerQuery;
  }

  /**
   * Profile a database query
   */
  profileQuery(sql: string, params: unknown[], durationMs: number, rowsAffected: number = 0): void {
    const queryId = this.hashQuery(sql);
    const profile: QueryProfile = {
      queryId,
      sql,
      parameters: params,
      durationMs,
      rowsAffected,
      executedAt: Date.now(),
    };

    // Store profile
    if (!this.profiles.has(queryId)) {
      this.profiles.set(queryId, []);
    }

    const profiles = this.profiles.get(queryId)!;
    profiles.push(profile);

    // Keep only recent profiles to prevent memory bloat
    if (profiles.length > this.maxProfilesPerQuery) {
      profiles.shift();
    }

    // Update slow query cache if applicable
    if (durationMs > this.slowQueryThresholdMs) {
      this.updateSlowQueryCache(queryId, sql, durationMs);
    }
  }

  /**
   * Get all slow queries with aggregated stats
   */
  getSlowQueries(threshold: number = this.slowQueryThresholdMs): SlowQuery[] {
    const slowQueries: SlowQuery[] = [];

    const entries = Array.from(this.profiles.entries());
    for (const entry of entries) {
      const [queryHash, profiles] = entry;
      const slowProfiles = profiles.filter((p) => p.durationMs > threshold);

      if (slowProfiles.length === 0) continue;

      const durations = slowProfiles.map((p) => p.durationMs);
      const sql = slowProfiles[0].sql;

      const slowQuery: SlowQuery = {
        queryHash,
        sql,
        count: slowProfiles.length,
        totalDurationMs: durations.reduce((a, b) => a + b, 0),
        averageDurationMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        maxDurationMs: Math.max(...durations),
        minDurationMs: Math.min(...durations),
        lastExecutedAt: slowProfiles[slowProfiles.length - 1].executedAt,
        examples: slowProfiles.slice(-5), // Last 5 examples
        isN1Query: this.detectN1Pattern(queryHash),
        fullTableScan: this.detectFullTableScan(sql),
      };

      slowQueries.push(slowQuery);
    }

    // Sort by total duration
    return slowQueries.sort((a, b) => b.totalDurationMs - a.totalDurationMs);
  }

  /**
   * Get comprehensive query statistics
   */
  getQueryStats(): QueryStats {
    const allProfiles: QueryProfile[] = [];
    const profileValues = Array.from(this.profiles.values());
    for (const profiles of profileValues) {
      allProfiles.push(...profiles);
    }

    if (allProfiles.length === 0) {
      return {
        totalQueries: 0,
        uniqueQueries: 0,
        totalDurationMs: 0,
        averageDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        slowQueriesCount: 0,
        slowQueriesThresholdMs: this.slowQueryThresholdMs,
        n1QueriesDetected: 0,
        fullTableScans: 0,
        topQueries: [],
      };
    }

    const durations = allProfiles.map((p) => p.durationMs).sort((a, b) => a - b);
    const slowQueries = this.getSlowQueries();
    const n1Count = slowQueries.filter((q) => q.isN1Query).length;
    const fullScans = slowQueries.filter((q) => q.fullTableScan).length;

    // Calculate percentiles
    const getPercentile = (arr: number[], p: number) => {
      const index = Math.ceil((arr.length * p) / 100) - 1;
      return arr[Math.max(0, index)];
    };

    // Top queries by total duration
    const queryStats: Array<{ sql: string; count: number; totalDurationMs: number }> = [];
    const profilesEntries = Array.from(this.profiles.entries());
    for (const entry of profilesEntries) {
      const [, profiles] = entry;
      queryStats.push({
        sql: profiles[0].sql,
        count: profiles.length,
        totalDurationMs: profiles.reduce((sum, p) => sum + p.durationMs, 0),
      });
    }

    return {
      totalQueries: allProfiles.length,
      uniqueQueries: this.profiles.size,
      totalDurationMs: durations.reduce((a, b) => a + b, 0),
      averageDurationMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p50DurationMs: getPercentile(durations, 50),
      p95DurationMs: getPercentile(durations, 95),
      p99DurationMs: getPercentile(durations, 99),
      slowQueriesCount: slowQueries.length,
      slowQueriesThresholdMs: this.slowQueryThresholdMs,
      n1QueriesDetected: n1Count,
      fullTableScans: fullScans,
      topQueries: queryStats.sort((a, b) => b.totalDurationMs - a.totalDurationMs).slice(0, 10),
    };
  }

  /**
   * Suggest missing indexes based on query patterns
   */
  suggestIndexes(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];
    const slowQueries = this.getSlowQueries();

    for (const slowQuery of slowQueries) {
      // Analyze WHERE clauses for index opportunities
      const whereMatch = slowQuery.sql.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)/i);
      if (whereMatch) {
        const conditions = whereMatch[1];
        const tableMatch = slowQuery.sql.match(/FROM\s+(\w+)/i);
        const table = tableMatch ? tableMatch[1] : 'unknown';

        // Extract column names from WHERE clause
        const columnMatches = conditions.match(/(\w+)\s*[=<>]/g) || [];
        const columns = columnMatches.map((m) => m.replace(/\s*[=<>].*/, ''));

        if (columns.length > 0) {
          const suggestion: IndexSuggestion = {
            table,
            columns,
            type: columns.length > 1 ? 'composite' : 'simple',
            estimatedImpact: Math.min(100, slowQuery.count * 5), // Impact based on frequency
            reason: `Used in WHERE clause of frequently slow query (avg ${slowQuery.averageDurationMs}ms)`,
            frequency: slowQuery.count,
            estimatedSizeMB: columns.length * 8, // Rough estimate
            createStatement: this.generateCreateIndexStatement(table, columns),
          };

          suggestions.push(suggestion);
        }
      }
    }

    // Remove duplicates and sort by impact
    const uniqueSuggestions = Array.from(
      new Map(suggestions.map((s) => [s.createStatement, s])).values()
    );

    return uniqueSuggestions.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }

  /**
   * Reset all profiling data
   */
  reset(): void {
    this.profiles.clear();
    this.slowQueriesCache.clear();
    logger.info('Query profiler reset');
  }

  /**
   * Clear profiles older than specified duration
   */
  clearOldProfiles(maxAgeMs: number = 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    let removedCount = 0;

    const hashEntries = Array.from(this.profiles.entries());
    for (const [hash, profiles] of hashEntries) {
      const filtered = profiles.filter((p) => p.executedAt > cutoff);
      if (filtered.length === 0) {
        this.profiles.delete(hash);
        removedCount++;
      } else if (filtered.length !== profiles.length) {
        this.profiles.set(hash, filtered);
        removedCount += profiles.length - filtered.length;
      }
    }

    if (removedCount > 0) {
      logger.debug(`Query profiler: removed ${removedCount} old profiles`);
    }
  }

  // Private helpers

  private hashQuery(sql: string): string {
    // Normalize SQL before hashing (remove comments, extra whitespace)
    const normalized = sql
      .replace(/--.*$/gm, '') // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toUpperCase();

    return createHash('sha256').update(normalized).digest('hex');
  }

  private updateSlowQueryCache(queryHash: string, sql: string, durationMs: number): void {
    const cached = this.slowQueriesCache.get(queryHash) || {
      queryHash,
      sql,
      count: 0,
      totalDurationMs: 0,
      averageDurationMs: 0,
      maxDurationMs: 0,
      minDurationMs: durationMs,
      lastExecutedAt: Date.now(),
      examples: [],
    };

    cached.count++;
    cached.totalDurationMs += durationMs;
    cached.averageDurationMs = Math.round(cached.totalDurationMs / cached.count);
    cached.maxDurationMs = Math.max(cached.maxDurationMs, durationMs);
    cached.minDurationMs = Math.min(cached.minDurationMs, durationMs);
    cached.lastExecutedAt = Date.now();

    this.slowQueriesCache.set(queryHash, cached);
  }

  private detectN1Pattern(queryHash: string): boolean {
    const profiles = this.profiles.get(queryHash) || [];
    if (profiles.length < 2) return false;

    // If same query repeated many times in short window, likely N+1
    const fiveMinutes = 5 * 60 * 1000;
    const now = Date.now();
    const recent = profiles.filter((p) => now - p.executedAt < fiveMinutes);

    return recent.length > profiles.length * 0.7; // 70% of executions in 5 mins
  }

  private detectFullTableScan(sql: string): boolean {
    // Simple heuristic: check for SELECT * or missing WHERE
    const hasSelectAll = /SELECT\s+\*/i.test(sql);
    const hasMissingWhere = !/WHERE\s+/i.test(sql) && !/GROUP\s+BY/i.test(sql);

    return hasSelectAll && hasMissingWhere;
  }

  private generateCreateIndexStatement(table: string, columns: string[]): string {
    const indexName = `idx_${table}_${columns.join('_')}`;
    const columnList = columns.join(', ');
    return `CREATE INDEX ${indexName} ON ${table} (${columnList});`;
  }
}

export default QueryProfiler;
