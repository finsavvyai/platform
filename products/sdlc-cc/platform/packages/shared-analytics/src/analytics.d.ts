import { AnalyticsConfig, GDPRConfig } from './core-types';
import { AnalyticsFilter, AnalyticsMetrics, EventType, AnalyticsProvider } from './types';
/**
 * Main Analytics Class
 *
 * Provides enterprise-grade analytics tracking capabilities with GDPR compliance
 * and Cloudflare integration for all products in the platform.
 */
export declare class Analytics {
    private config;
    private gdpr;
    private sessionManager;
    private provider;
    private eventQueue;
    private isInitialized;
    private flushTimer;
    constructor(config: AnalyticsConfig, gdpr: GDPRConfig);
    /**
     * Initialize analytics with specified provider
     */
    initialize(provider?: AnalyticsProvider): Promise<void>;
    /**
     * Create default Cloudflare analytics provider
     */
    private createDefaultProvider;
    /**
     * Setup automatic event flushing
     */
    private setupAutoFlush;
    /**
     * Track a custom event
     */
    track<T extends EventType>(eventType: T, data: any, userId?: string): Promise<void>;
    /**
     * Track page view
     */
    trackPageView(path: string, title?: string): Promise<void>;
    /**
     * Track user action
     */
    trackUserAction(action: string, target?: string, value?: any, context?: Record<string, any>): Promise<void>;
    /**
     * Track form submission
     */
    trackFormSubmit(formName: string, fields: Record<string, any>, success: boolean, duration?: number, errors?: string[]): Promise<void>;
    /**
     * Track API call
     */
    trackApiCall(endpoint: string, method: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number): Promise<void>;
    /**
     * Track error
     */
    trackError(error: Error | string, context?: Record<string, any>, severity?: 'low' | 'medium' | 'high' | 'critical'): Promise<void>;
    /**
     * Track performance metric
     */
    trackPerformance(metric: string, value: number, unit?: 'ms' | 'bytes' | 'count' | 'percent', context?: Record<string, any>): Promise<void>;
    /**
     * Track conversion event
     */
    trackConversion(type: string, value?: number, currency?: string, context?: Record<string, any>): Promise<void>;
    /**
     * Track feature usage
     */
    trackFeatureUsage(feature: string, action?: string, parameters?: Record<string, any>): Promise<void>;
    /**
     * Create analytics event
     */
    private createEvent;
    /**
     * Detect platform type
     */
    private detectPlatform;
    /**
     * Get page load time
     */
    private getLoadTime;
    /**
     * Sanitize form fields for GDPR compliance
     */
    private sanitizeFields;
    /**
     * Hash user ID for GDPR compliance
     */
    private hashUserId;
    /**
     * Check if event should be tracked based on GDPR settings
     */
    private shouldTrack;
    /**
     * Check if user has given consent
     */
    private hasUserConsent;
    /**
     * Check if event should be sampled
     */
    private shouldSample;
    /**
     * Add event to queue
     */
    private addEventToQueue;
    /**
     * Flush events to provider
     */
    flush(): Promise<void>;
    /**
     * Get analytics metrics
     */
    getMetrics(filters?: AnalyticsFilter): Promise<AnalyticsMetrics>;
    /**
     * Set user consent
     */
    setUserConsent(granted: boolean): void;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<AnalyticsConfig>): void;
    /**
     * Update GDPR settings
     */
    updateGDPRSettings(gdpr: Partial<GDPRConfig>): void;
    /**
     * Get current session
     */
    getSession(): Promise<import("./types").AnalyticsSession>;
    /**
     * Destroy analytics instance
     */
    destroy(): Promise<void>;
}
export declare function createAnalytics(config: AnalyticsConfig, gdpr?: Partial<GDPRConfig>): Analytics;
//# sourceMappingURL=analytics.d.ts.map