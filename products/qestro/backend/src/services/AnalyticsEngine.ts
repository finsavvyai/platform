/**
 * Analytics Engine - Comprehensive test analytics and metrics tracking
 *
 * Provides:
 * - Test execution trends (daily/weekly/monthly)
 * - Pass/failure rates and flakiness scoring
 * - Performance regression detection
 * - AI usage and cost tracking
 * - Time-series data with caching
 * - Multi-dimensional filtering
 */

import { logger } from '../utils/logger.js';

/**
 * Time-series analytics data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  date: string;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Test execution trend data
 */
export interface ExecutionTrend {
  period: 'daily' | 'weekly' | 'monthly';
  data: TimeSeriesPoint[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  avgDuration: number;
  trend: 'improving' | 'degrading' | 'stable';
}

/**
 * Flakiness score for a test (0-100)
 */
export interface FlakinessScore {
  testId: string;
  testName: string;
  flakiness: number;
  passFail: number[];
  totalRuns: number;
  confidence: number;
  recommendation: string;
}

/**
 * Test health and performance metrics
 */
export interface TestHealthReport {
  testId: string;
  testName: string;
  totalRuns: number;
  passRate: number;
  failRate: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  flakiness: number;
  trend: 'improving' | 'degrading' | 'stable';
  lastRun: number;
  regressions: RegressionDetection[];
}

/**
 * Performance regression detection
 */
export interface RegressionDetection {
  type: 'performance' | 'flakiness' | 'failure_rate';
  previousValue: number;
  currentValue: number;
  percentChange: number;
  severity: 'low' | 'medium' | 'high';
  detectedAt: number;
}

/**
 * AI usage and cost tracking
 */
export interface AIUsageStats {
  totalOperations: number;
  generationsCount: number;
  healingsCount: number;
  optimizationsCount: number;
  totalTokensUsed: number;
  totalCost: number;
  avgTokensPerOp: number;
  avgCostPerOp: number;
  successRate: number;
  topProviders: { provider: string; count: number; cost: number }[];
}

/**
 * Analytics query with flexible filtering
 */
export interface AnalyticsQuery {
  projectId?: string;
  testId?: string;
  startDate: number;
  endDate: number;
  period?: 'daily' | 'weekly' | 'monthly';
  groupBy?: 'project' | 'test' | 'status' | 'environment';
  limit?: number;
  offset?: number;
}

/**
 * Complete analytics result set
 */
export interface AnalyticsResult {
  query: AnalyticsQuery;
  executionTrends: ExecutionTrend[];
  passRates: TimeSeriesPoint[];
  failureRates: TimeSeriesPoint[];
  avgDurations: TimeSeriesPoint[];
  slowestTests: TestHealthReport[];
  flakyTests: FlakinessScore[];
  healthReports: TestHealthReport[];
  aiUsageStats: AIUsageStats;
  regressions: RegressionDetection[];
  generatedAt: number;
  cacheHit: boolean;
}

/**
 * Analytics cache entry
 */
interface CacheEntry {
  data: AnalyticsResult;
  timestamp: number;
}

/**
 * Main Analytics Engine
 */
export class AnalyticsEngine {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;

  constructor() {
    this.initializeCacheCleanup();
  }

  /**
   * Initialize periodic cache cleanup
   */
  private initializeCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      const entries = Array.from(this.cache.entries());
      for (const [key, entry] of entries) {
        if (now - entry.timestamp > this.CACHE_TTL) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`[Analytics] Cache cleanup: removed ${cleaned} stale entries`);
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Generate cache key from query
   */
  private getCacheKey(query: AnalyticsQuery): string {
    return `${query.projectId}:${query.testId}:${query.startDate}:${query.endDate}:${query.period}:${query.groupBy}`;
  }

  /**
   * Get cached analytics or compute new ones
   */
  async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const cacheKey = this.getCacheKey(query);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug(`[Analytics] Cache hit for ${cacheKey}`);
      return { ...cached.data, cacheHit: true };
    }

    const result = await this.computeAnalytics(query);
    this.setCacheEntry(cacheKey, result);
    return result;
  }

  /**
   * Store analytics result in cache
   */
  private setCacheEntry(key: string, data: AnalyticsResult): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Compute analytics (stub - would query database)
   */
  private async computeAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult> {
    try {
      const [
        executionTrends,
        passRates,
        failureRates,
        avgDurations,
        slowestTests,
        flakyTests,
        healthReports,
        aiUsageStats,
        regressions,
      ] = await Promise.all([
        this.computeExecutionTrends(query),
        this.computePassRates(query),
        this.computeFailureRates(query),
        this.computeAvgDurations(query),
        this.findSlowestTests(query),
        this.detectFlakyTests(query),
        this.generateHealthReports(query),
        this.getAIUsageStats(query),
        this.detectRegressions(query),
      ]);

      return {
        query,
        executionTrends,
        passRates,
        failureRates,
        avgDurations,
        slowestTests,
        flakyTests,
        healthReports,
        aiUsageStats,
        regressions,
        generatedAt: Date.now(),
        cacheHit: false,
      };
    } catch (error) {
      logger.error('[Analytics] Failed to compute analytics:', error);
      throw error;
    }
  }

  /**
   * Compute execution trends over time
   */
  private async computeExecutionTrends(query: AnalyticsQuery): Promise<ExecutionTrend[]> {
    // Stub implementation - would query database
    return [
      {
        period: query.period || 'daily',
        data: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        avgDuration: 0,
        trend: 'stable',
      },
    ];
  }

  /**
   * Compute pass rates over time
   */
  private async computePassRates(query: AnalyticsQuery): Promise<TimeSeriesPoint[]> {
    // Stub implementation
    return [];
  }

  /**
   * Compute failure rates over time
   */
  private async computeFailureRates(query: AnalyticsQuery): Promise<TimeSeriesPoint[]> {
    // Stub implementation
    return [];
  }

  /**
   * Compute average test durations over time
   */
  private async computeAvgDurations(query: AnalyticsQuery): Promise<TimeSeriesPoint[]> {
    // Stub implementation
    return [];
  }

  /**
   * Find slowest performing tests
   */
  private async findSlowestTests(query: AnalyticsQuery): Promise<TestHealthReport[]> {
    // Stub implementation
    return [];
  }

  /**
   * Detect flaky tests using statistical analysis
   */
  private async detectFlakyTests(query: AnalyticsQuery): Promise<FlakinessScore[]> {
    // Stub implementation
    return [];
  }

  /**
   * Generate health reports for all tests in query scope
   */
  private async generateHealthReports(query: AnalyticsQuery): Promise<TestHealthReport[]> {
    // Stub implementation
    return [];
  }

  /**
   * Get AI usage and cost statistics
   */
  private async getAIUsageStats(query: AnalyticsQuery): Promise<AIUsageStats> {
    // Stub implementation
    return {
      totalOperations: 0,
      generationsCount: 0,
      healingsCount: 0,
      optimizationsCount: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      avgTokensPerOp: 0,
      avgCostPerOp: 0,
      successRate: 100,
      topProviders: [],
    };
  }

  /**
   * Detect performance and failure rate regressions
   */
  private async detectRegressions(query: AnalyticsQuery): Promise<RegressionDetection[]> {
    // Stub implementation
    return [];
  }

  /**
   * Clear cache for specific project
   */
  clearCache(projectId?: string): number {
    if (!projectId) {
      const size = this.cache.size;
      this.cache.clear();
      logger.info(`[Analytics] Cleared entire cache (${size} entries)`);
      return size;
    }

    let cleared = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(projectId)) {
        this.cache.delete(key);
        cleared++;
      }
    }

    logger.info(`[Analytics] Cleared ${cleared} cache entries for project ${projectId}`);
    return cleared;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL,
    };
  }

  /**
   * Warm cache with precomputed analytics
   */
  async warmCache(projectIds: string[]): Promise<void> {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const projectId of projectIds) {
      const query: AnalyticsQuery = {
        projectId,
        startDate: sevenDaysAgo,
        endDate: now,
        period: 'daily',
      };

      await this.getAnalytics(query);
    }

    logger.info(`[Analytics] Warmed cache for ${projectIds.length} projects`);
  }
}

/**
 * Export singleton instance
 */
export const analyticsEngine = new AnalyticsEngine();
