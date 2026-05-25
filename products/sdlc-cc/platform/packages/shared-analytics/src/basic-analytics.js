/**
 * Basic Analytics - Minimal Working Version
 */
export class BasicAnalytics {
    config;
    events = [];
    constructor(config) {
        this.config = config;
    }
    track(eventType, data) {
        const event = {
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
    getEvents() {
        return [...this.events];
    }
    clear() {
        this.events = [];
    }
}
export function createBasicAnalytics(config) {
    return new BasicAnalytics(config);
}
//# sourceMappingURL=basic-analytics.js.map