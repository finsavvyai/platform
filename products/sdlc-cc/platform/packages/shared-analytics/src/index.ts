/**
 * Shared Analytics Package
 *
 * Enterprise-grade analytics tracking for all products in the SDLC platform.
 * Provides GDPR-compliant user behavior tracking with Cloudflare integration.
 */

// Core analytics functionality
export { Analytics, createAnalytics } from './analytics';
export { SessionManager } from './session';

// Types and interfaces
export type {
  AnalyticsEvent,
  AnalyticsConfig,
  AnalyticsFilter,
  AnalyticsMetrics,
  AnalyticsQuery,
  AnalyticsProvider,
  AnalyticsSession,
  DashboardWidget,
  GDPRConfig,
  EventType,
  EventMetadata,
  UserActionEvent,
  PageViewEvent,
  FormSubmitEvent,
  ApiCallEvent,
  ErrorEvent,
  PerformanceEvent,
  ConversionEvent,
  FeatureUsageEvent,
  AnalyticsContext,
  EventData,
  SamplingStrategy,
  StorageBackend,
  VisualizationConfig,
  CloudflareAnalyticsProvider
} from './types';

// Analytics providers
export { CloudflareProvider } from './providers/cloudflare';
export { MemoryProvider } from './providers/memory';

// Utility functions
export * from './utils';

// Constants
export const ANALYTICS_VERSION = '1.0.0';
export const DEFAULT_CONFIG: Partial<import('./types').AnalyticsConfig> = {
  batchSize: 10,
  flushInterval: 5000, // 5 seconds
  enableDebug: false,
  enableSampling: false,
  samplingRate: 1.0,
  enableGDPR: true,
  retentionDays: 365,
  enableRealTime: true
};

export const DEFAULT_GDPR: Partial<import('./types').GDPRConfig> = {
  enabled: true,
  consentRequired: false,
  anonymizeIP: true,
  dataRetentionDays: 365,
  cookiePolicy: 'strict',
  doNotTrack: false,
  regionalRestrictions: []
};

// Re-export for convenience
export type {
  AnalyticsEvent as Event,
  AnalyticsMetrics as Metrics,
  AnalyticsConfig as Config
} from './types';