/**
 * Basic Analytics - Minimal Working Version
 */
export interface BasicAnalyticsEvent {
    id: string;
    type: string;
    timestamp: number;
    data: Record<string, any>;
}
export interface BasicAnalyticsConfig {
    productId: string;
    enableDebug?: boolean;
}
export declare class BasicAnalytics {
    private config;
    private events;
    constructor(config: BasicAnalyticsConfig);
    track(eventType: string, data: Record<string, any>): void;
    getEvents(): BasicAnalyticsEvent[];
    clear(): void;
}
export declare function createBasicAnalytics(config: BasicAnalyticsConfig): BasicAnalytics;
//# sourceMappingURL=basic-analytics.d.ts.map