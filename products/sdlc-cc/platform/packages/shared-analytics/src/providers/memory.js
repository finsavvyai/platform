/**
 * Memory Analytics Provider
 *
 * Development/testing provider that stores events in memory.
 * Useful for local development and testing without requiring
 * external services.
 */
export class MemoryProvider {
    name = 'memory';
    events = [];
    maxEvents = 10000; // Limit memory usage
    async initialize(config) {
        this.events = [];
        console.log('Memory Analytics Provider initialized');
    }
    async track(event) {
        this.events.push(event);
        // Limit memory usage
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
    }
    async getMetrics(query) {
        const filters = query.filters;
        let filteredEvents = this.events;
        // Apply filters
        if (filters.startDate) {
            const startTime = filters.startDate.getTime();
            filteredEvents = filteredEvents.filter(e => e.timestamp >= startTime);
        }
        if (filters.endDate) {
            const endTime = filters.endDate.getTime();
            filteredEvents = filteredEvents.filter(e => e.timestamp <= endTime);
        }
        if (filters.userId) {
            filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
        }
        if (filters.sessionId) {
            filteredEvents = filteredEvents.filter(e => e.sessionId === filters.sessionId);
        }
        if (filters.eventTypes && filters.eventTypes.length > 0) {
            filteredEvents = filteredEvents.filter(e => filters.eventTypes.includes(e.type));
        }
        // Calculate metrics
        const totalEvents = filteredEvents.length;
        const uniqueUsers = new Set(filteredEvents.filter(e => e.userId).map(e => e.userId)).size;
        const sessionIds = new Set(filteredEvents.map(e => e.sessionId));
        const totalSessions = sessionIds.size;
        // Calculate bounce rate (sessions with only one page view)
        const sessionPageViews = new Map();
        filteredEvents.filter(e => e.type === 'page_view').forEach(e => {
            sessionPageViews.set(e.sessionId, (sessionPageViews.get(e.sessionId) || 0) + 1);
        });
        const singlePageViewSessions = Array.from(sessionPageViews.values()).filter(count => count === 1).length;
        const bounceRate = totalSessions > 0 ? singlePageViewSessions / totalSessions : 0;
        // Calculate average session duration
        const sessionDurations = new Map();
        sessionIds.forEach(sessionId => {
            const sessionEvents = filteredEvents.filter(e => e.sessionId === sessionId);
            if (sessionEvents.length > 0) {
                const start = Math.min(...sessionEvents.map(e => e.timestamp));
                const end = Math.max(...sessionEvents.map(e => e.timestamp));
                sessionDurations.set(sessionId, end - start);
            }
        });
        const avgSessionDuration = sessionDurations.size > 0
            ? Array.from(sessionDurations.values()).reduce((a, b) => a + b, 0) / sessionDurations.size
            : 0;
        // Get top pages
        const pageViews = new Map();
        filteredEvents.filter(e => e.type === 'page_view').forEach(e => {
            const path = e.data.path || '/';
            pageViews.set(path, (pageViews.get(path) || 0) + 1);
        });
        const topPages = Array.from(pageViews.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([path, views]) => ({ path, views }));
        // Get top events
        const eventCounts = new Map();
        filteredEvents.forEach(e => {
            eventCounts.set(e.type, (eventCounts.get(e.type) || 0) + 1);
        });
        const topEvents = Array.from(eventCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([type, count]) => ({ type, count }));
        // Calculate conversion rate
        const pageViewCount = filteredEvents.filter(e => e.type === 'page_view').length;
        const successfulFormSubmits = filteredEvents.filter(e => e.type === 'form_submit' && e.data.success === true).length;
        const conversionRate = pageViewCount > 0 ? (successfulFormSubmits / pageViewCount) * 100 : 0;
        // Calculate error rate
        const errorCount = filteredEvents.filter(e => e.type === 'error').length;
        const errorRate = totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0;
        return {
            totalEvents,
            uniqueUsers,
            totalSessions,
            bounceRate,
            avgSessionDuration,
            topPages,
            topEvents,
            conversionRate,
            errorRate,
            performanceMetrics: {}
        };
    }
    async flush() {
        // Memory provider doesn't need flushing
    }
    async destroy() {
        this.events = [];
    }
    // Additional helper methods for testing
    getEventCount() {
        return this.events.length;
    }
    getEvents() {
        return [...this.events];
    }
    clear() {
        this.events = [];
    }
}
//# sourceMappingURL=memory.js.map