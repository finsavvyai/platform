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
export declare class CloudflareProvider implements AnalyticsProvider {
    name: string;
    private kvNamespace?;
    private d1Database?;
    private analyticsEngine?;
    private isInitialized;
    initialize(config: any): Promise<void>;
    /**
     * Initialize D1 database tables
     */
    private initializeDatabase;
    /**
     * Track analytics event
     */
    track(event: AnalyticsEvent): Promise<void>;
    /**
     * Store event in D1 database
     */
    private storeEventInD1;
    /**
     * Send event to Analytics Engine
     */
    private sendToAnalyticsEngine;
    /**
     * Get analytics metrics
     */
    getMetrics(query: AnalyticsQuery): Promise<AnalyticsMetrics>;
    /**
     * Build SQL filters from AnalyticsFilter
     */
    private buildSQLFilters;
    /**
     * Flush any pending events
     */
    flush(): Promise<void>;
    /**
     * Destroy provider and clean up resources
     */
    destroy(): Promise<void>;
    /**
     * Get raw events for analysis
     */
    getEvents(filters: any, limit?: number, offset?: number): Promise<AnalyticsEvent[]>;
    /**
     * Get session information
     */
    getSession(sessionId: string): Promise<any>;
    /**
     * Create daily aggregates
     */
    createDailyAggregates(date: string): Promise<void>;
}
//# sourceMappingURL=cloudflare.d.ts.map