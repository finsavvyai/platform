export interface AnalyticsEvent {
    id: string;
    type: 'page_view' | 'user_action' | 'form_submit' | 'api_call' | 'error' | 'performance' | 'conversion' | 'feature_usage' | 'session_start' | 'session_end' | 'custom';
    timestamp: number;
    userId?: string;
    sessionId: string;
    data: Record<string, any>;
    metadata?: {
        url?: string;
        userAgent?: string;
        referrer?: string;
        ip?: string;
    };
}
export interface AnalyticsConfig {
    productId: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    enableDebug?: boolean;
    enableGDPR?: boolean;
    retentionDays?: number;
    batchSize?: number;
    flushInterval?: number;
    enableSampling?: boolean;
    samplingRate?: number;
    enableRealTime?: boolean;
}
export interface GDPRConfig {
    enabled: boolean;
    consentRequired?: boolean;
    anonymizeIP?: boolean;
    dataRetentionDays?: number;
    cookiePolicy?: 'strict' | 'lax' | 'none';
    doNotTrack?: boolean;
    regionalRestrictions?: string[];
}
//# sourceMappingURL=core-types.d.ts.map