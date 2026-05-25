/**
 * Shared Analytics Package
 *
 * Enterprise-grade analytics tracking for all products in the SDLC platform.
 * Provides GDPR-compliant user behavior tracking with Cloudflare integration.
 */
export { Analytics, createAnalytics } from './analytics';
export { SessionManager } from './session';
export type { AnalyticsEvent, AnalyticsConfig, AnalyticsFilter, AnalyticsMetrics, AnalyticsQuery, AnalyticsProvider, AnalyticsSession, DashboardWidget, GDPRConfig, EventType, EventMetadata, UserActionEvent, PageViewEvent, FormSubmitEvent, ApiCallEvent, ErrorEvent, PerformanceEvent, ConversionEvent, FeatureUsageEvent, AnalyticsContext, EventData, SamplingStrategy, StorageBackend, VisualizationConfig, CloudflareAnalyticsProvider } from './types';
export { CloudflareProvider } from './providers/cloudflare';
export { MemoryProvider } from './providers/memory';
export * from './utils';
export declare const ANALYTICS_VERSION = "1.0.0";
export declare const DEFAULT_CONFIG: Partial<AnalyticsConfig>;
export declare const DEFAULT_GDPR: Partial<GDPRConfig>;
export type { AnalyticsEvent as Event, AnalyticsMetrics as Metrics, AnalyticsConfig as Config };
//# sourceMappingURL=index.d.ts.map