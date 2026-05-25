/**
 * Analytics Service — lightweight event tracking for LunaOS Dashboard
 *
 * Supports pluggable backends (PostHog, Plausible, or custom).
 * All tracking is opt-in and respects Do Not Track.
 */

type EventProperties = Record<string, string | number | boolean>;

interface AnalyticsConfig {
    enabled: boolean;
    endpoint?: string;
    debug?: boolean;
}

const config: AnalyticsConfig = {
    enabled: typeof window !== 'undefined'
        && navigator?.doNotTrack !== '1'
        && process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true',
    endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '/api/analytics',
    debug: process.env.NODE_ENV === 'development',
};

/** Queue events in memory before flushing */
const queue: Array<{ event: string; properties: EventProperties; timestamp: number }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Track a named event with optional properties */
export function trackEvent(event: string, properties: EventProperties = {}) {
    if (!config.enabled) return;

    const entry = {
        event,
        properties: {
            ...properties,
            url: typeof window !== 'undefined' ? window.location.pathname : '',
            referrer: typeof document !== 'undefined' ? document.referrer : '',
        },
        timestamp: Date.now(),
    };

    if (config.debug) {
        console.debug('[analytics]', entry.event, entry.properties);
    }

    queue.push(entry);

    // Flush every 5 seconds or when queue reaches 10
    if (queue.length >= 10) {
        flush();
    } else if (!flushTimer) {
        flushTimer = setTimeout(flush, 5000);
    }
}

/** Track a page view */
export function trackPageView(path?: string) {
    trackEvent('page_view', {
        path: path || (typeof window !== 'undefined' ? window.location.pathname : ''),
    });
}

/** Flush queued events to the analytics endpoint */
async function flush() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (queue.length === 0 || !config.endpoint) return;

    const batch = queue.splice(0, queue.length);

    try {
        await fetch(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: batch }),
            keepalive: true,
        });
    } catch {
        // Silently fail — analytics should never break the app
        if (config.debug) {
            console.warn('[analytics] flush failed, re-queuing', batch.length, 'events');
        }
        queue.unshift(...batch);
    }
}

/** Flush on page unload */
if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
    });
}

/** Predefined event helpers */
export const analytics = {
    agentRun: (agentId: string, model: string) =>
        trackEvent('agent_run', { agentId, model }),
    chainRun: (chainId: string, nodeCount: number) =>
        trackEvent('chain_run', { chainId, nodeCount }),
    apiKeyCreated: () => trackEvent('api_key_created'),
    repoConnected: (provider: string) =>
        trackEvent('repo_connected', { provider }),
    tierUpgrade: (from: string, to: string) =>
        trackEvent('tier_upgrade', { from, to }),
    search: (query: string, resultCount: number) =>
        trackEvent('search', { query, resultCount }),
};
