/**
 * Unit tests for Basic Analytics
 */

import { BasicAnalytics, createBasicAnalytics, BasicAnalyticsConfig } from './basic-analytics';

describe('BasicAnalytics', () => {
  let analytics: BasicAnalytics;
  const testConfig: BasicAnalyticsConfig = {
    productId: 'test-product',
    enableDebug: false
  };

  beforeEach(() => {
    analytics = new BasicAnalytics(testConfig);
  });

  afterEach(() => {
    analytics.clear();
  });

  describe('constructor', () => {
    it('should create analytics instance with config', () => {
      expect(analytics).toBeInstanceOf(BasicAnalytics);
    });

    it('should use debug mode when enabled', () => {
      const debugConfig: BasicAnalyticsConfig = {
        productId: 'test-debug',
        enableDebug: true
      };
      const debugAnalytics = new BasicAnalytics(debugConfig);
      expect(debugAnalytics).toBeInstanceOf(BasicAnalytics);
    });
  });

  describe('track', () => {
    it('should track events successfully', () => {
      const eventData = { action: 'click', element: 'button' };

      analytics.track('user_action', eventData);

      const events = analytics.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('user_action');
      expect(events[0].data).toEqual(eventData);
      expect(events[0].id).toBeDefined();
      expect(events[0].timestamp).toBeGreaterThan(0);
    });

    it('should track multiple events', () => {
      analytics.track('page_view', { path: '/home' });
      analytics.track('user_action', { action: 'click' });

      const events = analytics.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('page_view');
      expect(events[1].type).toBe('user_action');
    });

    it('should generate unique IDs for each event', () => {
      analytics.track('event1', {});
      analytics.track('event2', {});

      const events = analytics.getEvents();
      expect(events[0].id).not.toBe(events[1].id);
    });
  });

  describe('getEvents', () => {
    it('should return empty array when no events tracked', () => {
      const events = analytics.getEvents();
      expect(events).toEqual([]);
      expect(events).toHaveLength(0);
    });

    it('should return all tracked events', () => {
      analytics.track('event1', { data: 1 });
      analytics.track('event2', { data: 2 });
      analytics.track('event3', { data: 3 });

      const events = analytics.getEvents();
      expect(events).toHaveLength(3);
      expect(events[0].data).toEqual({ data: 1 });
      expect(events[1].data).toEqual({ data: 2 });
      expect(events[2].data).toEqual({ data: 3 });
    });

    it('should return a copy of events array', () => {
      analytics.track('event', {});
      const events1 = analytics.getEvents();
      const events2 = analytics.getEvents();

      expect(events1).not.toBe(events2); // Different references
      expect(events1).toEqual(events2);   // Same content
    });
  });

  describe('clear', () => {
    it('should clear all events', () => {
      analytics.track('event1', {});
      analytics.track('event2', {});

      expect(analytics.getEvents()).toHaveLength(2);

      analytics.clear();
      expect(analytics.getEvents()).toHaveLength(0);
    });

    it('should work when no events exist', () => {
      analytics.clear();
      expect(analytics.getEvents()).toHaveLength(0);
    });
  });
});

describe('createBasicAnalytics', () => {
  it('should create BasicAnalytics instance', () => {
    const config: BasicAnalyticsConfig = {
      productId: 'test-product',
      enableDebug: true
    };

    const analytics = createBasicAnalytics(config);
    expect(analytics).toBeInstanceOf(BasicAnalytics);
  });

  it('should use default config when none provided', () => {
    const analytics = createBasicAnalytics({ productId: 'test' });
    expect(analytics).toBeInstanceOf(BasicAnalytics);
  });
});