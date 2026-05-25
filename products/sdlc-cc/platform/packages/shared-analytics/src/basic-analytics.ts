/**
 * Basic Analytics - Minimal Working Version
 */

export interface BasicAnalyticsEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface BasicAnalyticsConfig {
  productId: string;
  enableDebug?: boolean;
}

export class BasicAnalytics {
  private config: BasicAnalyticsConfig;
  private events: BasicAnalyticsEvent[] = [];

  constructor(config: BasicAnalyticsConfig) {
    this.config = config;
  }

  track(eventType: string, data: Record<string, unknown>): void {
    const event: BasicAnalyticsEvent = {
      id: Math.random().toString(36).substring(7),
      type: eventType,
      timestamp: Date.now(),
      data
    };

    this.events.push(event);

    if (this.config.enableDebug) {
      console.log('Analytics event tracked:', event);
    }
  }

  getEvents(): BasicAnalyticsEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

export function createBasicAnalytics(config: BasicAnalyticsConfig): BasicAnalytics {
  return new BasicAnalytics(config);
}