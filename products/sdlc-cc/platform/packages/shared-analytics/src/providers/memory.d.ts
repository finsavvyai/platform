import { AnalyticsProvider, AnalyticsEvent, AnalyticsMetrics, AnalyticsQuery } from '../types';
/**
 * Memory Analytics Provider
 *
 * Development/testing provider that stores events in memory.
 * Useful for local development and testing without requiring
 * external services.
 */
export declare class MemoryProvider implements AnalyticsProvider {
    name: string;
    private events;
    private maxEvents;
    initialize(config: any): Promise<void>;
    track(event: AnalyticsEvent): Promise<void>;
    getMetrics(query: AnalyticsQuery): Promise<AnalyticsMetrics>;
    flush(): Promise<void>;
    destroy(): Promise<void>;
    getEventCount(): number;
    getEvents(): AnalyticsEvent[];
    clear(): void;
}
//# sourceMappingURL=memory.d.ts.map