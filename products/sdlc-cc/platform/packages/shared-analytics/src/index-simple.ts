/**
 * Shared Analytics Package - Simple Version
 *
 * Basic analytics functionality without complex Cloudflare dependencies.
 */

// Core analytics functionality
export { Analytics, createAnalytics } from './analytics';
export { SessionManager } from './session';

// Core types
export type { AnalyticsEvent, AnalyticsConfig, GDPRConfig } from './core-types';

// Analytics providers
export { MemoryProvider } from './providers/memory';

// Utility functions
export * from './utils';

// Constants
export const ANALYTICS_VERSION = '1.0.0';
export const DEFAULT_CONFIG = {
  batchSize: 10,
  flushInterval: 5000, // 5 seconds
  enableDebug: false,
  enableSampling: false,
  samplingRate: 1.0,
  enableGDPR: true,
  retentionDays: 365,
  enableRealTime: true
};

export const DEFAULT_GDPR = {
  enabled: true,
  consentRequired: false,
  anonymizeIP: true,
  dataRetentionDays: 365,
  cookiePolicy: 'strict' as const,
  doNotTrack: false,
  regionalRestrictions: []
};