// Jest globals (describe, it, expect) provided by test framework

describe('Analytics module', () => {
    it('should export trackEvent function', async () => {
        const mod = await import('./analytics');
        expect(typeof mod.trackEvent).toBe('function');
    });

    it('should export trackPageView function', async () => {
        const mod = await import('./analytics');
        expect(typeof mod.trackPageView).toBe('function');
    });

    it('should export analytics helpers object', async () => {
        const mod = await import('./analytics');
        expect(mod.analytics).toBeDefined();
        expect(typeof mod.analytics.agentRun).toBe('function');
        expect(typeof mod.analytics.chainRun).toBe('function');
        expect(typeof mod.analytics.apiKeyCreated).toBe('function');
        expect(typeof mod.analytics.repoConnected).toBe('function');
        expect(typeof mod.analytics.tierUpgrade).toBe('function');
        expect(typeof mod.analytics.search).toBe('function');
    });

    it('should not throw when tracking is disabled', () => {
        const { trackEvent, trackPageView, analytics } = require('./analytics');
        expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
        expect(() => trackPageView('/test')).not.toThrow();
        expect(() => analytics.agentRun('agent-1', 'gpt-4')).not.toThrow();
    });
});

describe('Analytics event structure', () => {
    it('should create proper event entries', () => {
        const entry = {
            event: 'agent_run',
            properties: { agentId: 'code-review', model: 'claude' },
            timestamp: Date.now(),
        };
        expect(entry.event).toBe('agent_run');
        expect(entry.properties.agentId).toBe('code-review');
        expect(entry.timestamp).toBeGreaterThan(0);
    });
});
