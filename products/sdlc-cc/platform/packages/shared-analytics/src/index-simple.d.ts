/**
 * Shared Analytics Package - Simple Version
 *
 * Basic analytics functionality without complex Cloudflare dependencies.
 */
export { Analytics, createAnalytics } from './analytics';
export { SessionManager } from './session';
export type { AnalyticsEvent, AnalyticsConfig, GDPRConfig } from './core-types';
export { MemoryProvider } from './providers/memory';
export * from './utils';
export declare const ANALYTICS_VERSION = "1.0.0";
export declare const DEFAULT_CONFIG: {
    batchSize: number;
    flushInterval: number;
    enableDebug: boolean;
    enableSampling: boolean;
    samplingRate: number;
    enableGDPR: boolean;
    retentionDays: number;
    enableRealTime: boolean;
};
export declare const DEFAULT_GDPR: {
    enabled: boolean;
    consentRequired: boolean;
    anonymizeIP: boolean;
    dataRetentionDays: number;
    cookiePolicy: "strict";
    doNotTrack: boolean;
    regionalRestrictions: never[];
};
//# sourceMappingURL=index-simple.d.ts.map