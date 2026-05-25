import { AnalyticsProvider, AnalyticsEvent, AnalyticsMetrics, AnalyticsQuery } from '../types';

/**
 * Cloudflare Analytics Provider
 *
 * Implements analytics storage and retrieval using Cloudflare's infrastructure:
 * - KV for event storage
 * - D1 for structured analytics data
 * - Analytics Engine for real-time metrics
 * - Workers for distributed processing
 */

export class CloudflareProvider implements AnalyticsProvider {
  name = 'cloudflare';
  private kvNamespace?: KVNamespace;
  private d1Database?: D1Database;
  private analyticsEngine?: unknown;
  private isInitialized = false;

  async initialize(config: AnalyticsConfig): Promise<void> {
    try {
      // Initialize Cloudflare resources
      this.kvNamespace = (globalThis as Record<string, unknown>).ANALYTICS_KV as KVNamespace | undefined;
      this.d1Database = (globalThis as Record<string, unknown>).ANALYTICS_DB as D1Database | undefined;
      this.analyticsEngine = (globalThis as Record<string, unknown>).AnalyticsEngine;

      // Initialize D1 database tables
      if (this.d1Database) {
        await this.initializeDatabase();
      }

      this.isInitialized = true;

      console.log('Cloudflare Analytics Provider initialized');
    } catch (error) {
      console.error('Failed to initialize Cloudflare provider:', error);
      throw error;
    }
  }

  /**
   * Initialize D1 database tables
   */
  private async initializeDatabase(): Promise<void> {
    if (!this.d1Database) return;

    const createTablesSQL = `
      -- Analytics events table
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- User sessions table
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration INTEGER,
        page_views INTEGER DEFAULT 0,
        events INTEGER DEFAULT 0,
        bounce_rate REAL DEFAULT 1.0,
        country TEXT,
        city TEXT,
        device TEXT,
        browser TEXT,
        os TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Daily aggregates table
      CREATE TABLE IF NOT EXISTS daily_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        product_id TEXT NOT NULL,
        total_events INTEGER DEFAULT 0,
        unique_users INTEGER DEFAULT 0,
        total_sessions INTEGER DEFAULT 0,
        bounce_rate REAL DEFAULT 0,
        avg_session_duration INTEGER DEFAULT 0,
        page_views INTEGER DEFAULT 0,
        conversion_rate REAL DEFAULT 0,
        error_rate REAL DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(date, product_id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_session_id ON analytics_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(type);
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON user_sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_metrics(date);
    `;

    await this.d1Database.exec(createTablesSQL);
  }

  /**
   * Track analytics event
   */
  async track(event: AnalyticsEvent): Promise<void> {
    try {
      // Store in KV for quick access
      if (this.kvNamespace) {
        const kvKey = `event:${event.timestamp}:${event.id}`;
        await this.kvNamespace.put(kvKey, JSON.stringify(event), {
          expirationTtl: 30 * 24 * 60 * 60 // 30 days
        });
      }

      // Store in D1 for structured queries
      if (this.d1Database) {
        await this.storeEventInD1(event);
      }

      // Send to Analytics Engine for real-time metrics
      if (this.analyticsEngine) {
        await this.sendToAnalyticsEngine(event);
      }

    } catch (error) {
      console.error('Failed to track event:', error);
      throw error;
    }
  }

  /**
   * Store event in D1 database
   */
  private async storeEventInD1(event: AnalyticsEvent): Promise<void> {
    if (!this.d1Database) return;

    const stmt = this.d1Database.prepare(`
      INSERT OR REPLACE INTO analytics_events
      (id, type, user_id, session_id, timestamp, data, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      event.id,
      event.type,
      event.userId || null,
      event.sessionId,
      event.timestamp,
      JSON.stringify(event.data),
      JSON.stringify(event.metadata)
    ).run();
  }

  /**
   * Send event to Analytics Engine
   */
  private async sendToAnalyticsEngine(event: AnalyticsEvent): Promise<void> {
    if (!this.analyticsEngine) return;

    // Convert event to Analytics Engine format
    const analyticsData = {
      blobs: [
        {
          dataset: 'events',
          metrics: [{ count: 1 }],
          dimensions: [
            'event',
            event.type,
            event.metadata.productId,
            event.metadata.environment,
            event.metadata.platform || 'web'
          ]
        }
      ]
    };

    // Send to Analytics Engine
    await this.analyticsEngine.writeData(analyticsData);
  }

  /**
   * Get analytics metrics
   */
  async getMetrics(query: AnalyticsQuery): Promise<AnalyticsMetrics> {
    if (!this.d1Database) {
      throw new Error('D1 database not available');
    }

    try {
      const filters = this.buildSQLFilters(query.filters);

      // Get total events
      const totalEventsResult = await this.d1Database.prepare(`
        SELECT COUNT(*) as count FROM analytics_events
        WHERE ${filters || '1=1'}
      `).first();

      const totalEvents = totalEventsResult?.count || 0;

      // Get unique users
      const uniqueUsersResult = await this.d1Database.prepare(`
        SELECT COUNT(DISTINCT user_id) as count FROM analytics_events
        WHERE user_id IS NOT NULL AND ${filters || '1=1'}
      `).first();

      const uniqueUsers = uniqueUsersResult?.count || 0;

      // Get total sessions
      const totalSessionsResult = await this.d1Database.prepare(`
        SELECT COUNT(DISTINCT session_id) as count FROM analytics_events
        WHERE ${filters || '1=1'}
      `).first();

      const totalSessions = totalSessionsResult?.count || 0;

      // Get bounce rate
      const bounceRateResult = await this.d1Database.prepare(`
        SELECT AVG(bounce_rate) as rate FROM user_sessions
        WHERE ${filters || '1=1'}
      `).first();

      const bounceRate = bounceRateResult?.rate || 0;

      // Get average session duration
      const avgDurationResult = await this.d1Database.prepare(`
        SELECT AVG(duration) as avg_duration FROM user_sessions
        WHERE duration IS NOT NULL AND ${filters || '1=1'}
      `).first();

      const avgSessionDuration = avgDurationResult?.avg_duration || 0;

      // Get top pages
      const topPagesResult = await this.d1Database.prepare(`
        SELECT
          json_extract(data, '$.path') as path,
          COUNT(*) as views
        FROM analytics_events
        WHERE type = 'page_view' AND ${filters || '1=1'}
        GROUP BY json_extract(data, '$.path')
        ORDER BY views DESC
        LIMIT 10
      `).all();

      const topPages = (topPagesResult as { results: Array<Record<string, unknown>> }).results.map((row) => ({
        path: row.path || '/',
        views: row.views
      }));

      // Get top events
      const topEventsResult = await this.d1Database.prepare(`
        SELECT type, COUNT(*) as count
        FROM analytics_events
        WHERE ${filters || '1=1'}
        GROUP BY type
        ORDER BY count DESC
        LIMIT 10
      `).all();

      const topEvents = (topEventsResult as { results: Array<Record<string, unknown>> }).results.map((row) => ({
        type: row.type,
        count: row.count
      }));

      // Calculate conversion rate (form submits / page views)
      const conversionRateResult = await this.d1Database.prepare(`
        SELECT
          SUM(CASE WHEN type = 'form_submit' AND json_extract(data, '$.success') = true THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(SUM(CASE WHEN type = 'page_view' THEN 1 ELSE 0 END), 0) as rate
        FROM analytics_events
        WHERE ${filters || '1=1'}
      `).first();

      const conversionRate = conversionRateResult?.rate || 0;

      // Calculate error rate
      const errorRateResult = await this.d1Database.prepare(`
        SELECT
          SUM(CASE WHEN type = 'error' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(*), 0) as rate
        FROM analytics_events
        WHERE ${filters || '1=1'}
      `).first();

      const errorRate = errorRateResult?.rate || 0;

      return {
        totalEvents,
        uniqueUsers,
        totalSessions,
        bounceRate,
        avgSessionDuration,
        topPages,
        topEvents,
        conversionRate,
        errorRate,
        performanceMetrics: {}
      };

    } catch (error) {
      console.error('Failed to get metrics:', error);
      throw error;
    }
  }

  /**
   * Build SQL filters from AnalyticsFilter
   */
  private buildSQLFilters(filters: AnalyticsFilter): string {
    const conditions: string[] = [];

    if (filters.startDate) {
      conditions.push(`timestamp >= ${Math.floor(filters.startDate.getTime() / 1000)}`);
    }

    if (filters.endDate) {
      conditions.push(`timestamp <= ${Math.floor(filters.endDate.getTime() / 1000)}`);
    }

    if (filters.userId) {
      conditions.push(`user_id = '${filters.userId}'`);
    }

    if (filters.sessionId) {
      conditions.push(`session_id = '${filters.sessionId}'`);
    }

    if (filters.eventTypes && filters.eventTypes.length > 0) {
      const types = filters.eventTypes.map((t: string) => `'${t}'`).join(', ');
      conditions.push(`type IN (${types})`);
    }

    if (filters.products && filters.products.length > 0) {
      const products = filters.products.map((p: string) => `'${p}'`).join(', ');
      conditions.push(`json_extract(metadata, '$.productId') IN (${products})`);
    }

    return conditions.join(' AND ');
  }

  /**
   * Flush any pending events
   */
  async flush(): Promise<void> {
    // Cloudflare provider tracks events immediately, so no flush needed
  }

  /**
   * Destroy provider and clean up resources
   */
  async destroy(): Promise<void> {
    this.kvNamespace = undefined;
    this.d1Database = undefined;
    this.analyticsEngine = undefined;
    this.isInitialized = false;
  }

  /**
   * Get raw events for analysis
   */
  async getEvents(filters: AnalyticsFilter, limit: number = 100, offset: number = 0): Promise<AnalyticsEvent[]> {
    if (!this.d1Database) {
      throw new Error('D1 database not available');
    }

    const sqlFilter = this.buildSQLFilters(filters);
    const limitClause = `LIMIT ${limit} OFFSET ${offset}`;

    const result = await this.d1Database.prepare(`
      SELECT * FROM analytics_events
      WHERE ${sqlFilter || '1=1'}
      ORDER BY timestamp DESC
      ${limitClause}
    `).all();

    return (result as { results: Array<Record<string, unknown>> }).results.map((row) => ({
      id: row.id,
      type: row.type,
      userId: row.user_id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      data: JSON.parse(row.data),
      metadata: JSON.parse(row.metadata)
    }));
  }

  /**
   * Get session information
   */
  async getSession(sessionId: string): Promise<unknown> {
    if (!this.d1Database) {
      throw new Error('D1 database not available');
    }

    const result = await this.d1Database.prepare(`
      SELECT * FROM user_sessions WHERE id = ?
    `).bind(sessionId).first();

    return result;
  }

  /**
   * Create daily aggregates
   */
  async createDailyAggregates(date: string): Promise<void> {
    if (!this.d1Database) return;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const startTime = Math.floor(startOfDay.getTime() / 1000);
    const endTime = Math.floor(endOfDay.getTime() / 1000);

    // Calculate metrics for the day
    const metrics = await this.getMetrics({
      filters: {
        startDate: startOfDay,
        endDate: endOfDay
      },
      metrics: ['totalEvents', 'uniqueUsers', 'totalSessions'],
      dimensions: []
    });

    // Store in daily metrics table
    await this.d1Database.prepare(`
      INSERT OR REPLACE INTO daily_metrics
      (date, product_id, total_events, unique_users, total_sessions, bounce_rate,
       avg_session_duration, page_views, conversion_rate, error_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      date,
      'sdlc-platform', // TODO: Get from config
      metrics.totalEvents,
      metrics.uniqueUsers,
      metrics.totalSessions,
      metrics.bounceRate,
      metrics.avgSessionDuration,
      metrics.topPages.reduce((sum, page) => sum + page.views, 0),
      metrics.conversionRate,
      metrics.errorRate
    ).run();
  }
}