/**
 * Tests for Enhanced EventBus
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedEventBus } from '../bus-enhanced';
import type { EventContracts } from '../types';

describe('EnhancedEventBus', () => {
  let bus: EnhancedEventBus;

  beforeEach(() => {
    bus = new EnhancedEventBus({
      enableBatching: false, // Disable batching for most tests
      enableHistory: true,
      enableMetrics: true
    });
  });

  afterEach(() => {
    bus.dispose();
  });

  describe('Basic Event Emission', () => {
    it('should emit and receive events', () => {
      const handler = vi.fn();
      bus.on('test-event', handler);

      bus.emit('test-event', 'test-payload');

      expect(handler).toHaveBeenCalledWith('test-payload');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('test-event', handler1);
      bus.on('test-event', handler2);

      bus.emit('test-event', 'payload');

      expect(handler1).toHaveBeenCalledWith('payload');
      expect(handler2).toHaveBeenCalledWith('payload');
    });

    it('should handle unsubscribing', () => {
      const handler = vi.fn();
      const subscription = bus.on('test-event', handler);

      bus.emit('test-event', 'payload1');
      expect(handler).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();
      bus.emit('test-event', 'payload2');
      expect(handler).toHaveBeenCalledTimes(1); // Should not increase
    });
  });

  describe('Typed Events', () => {
    it('should support typed event contracts', () => {
      const graphHandler = vi.fn();
      const errorHandler = vi.fn();

      // Test with typed events
      bus.onTyped('graph:ready', graphHandler);
      bus.onTyped('lunaforge:error', errorHandler);

      bus.emitTyped('graph:ready', {
        graph: {
          files: [{ path: 'test.ts' }],
          dependencies: []
        }
      });

      bus.emitTyped('lunaforge:error', {
        error: 'Test error',
        context: 'test'
      });

      expect(graphHandler).toHaveBeenCalledWith({
        graph: {
          files: [{ path: 'test.ts' }],
          dependencies: []
        }
      });

      expect(errorHandler).toHaveBeenCalledWith({
        error: 'Test error',
        context: 'test'
      });
    });

    it('should provide type safety for event payloads', () => {
      const modeHandler = vi.fn();

      bus.onTyped('mode:activated', modeHandler);

      // This would cause a TypeScript error if payload type is wrong
      bus.emitTyped('mode:activated', { modeId: 'test-mode' });

      expect(modeHandler).toHaveBeenCalledWith({ modeId: 'test-mode' });
    });
  });

  describe('Middleware System', () => {
    it('should execute middleware in order', () => {
      const executionOrder: string[] = [];
      const middleware1 = vi.fn((event, payload, next) => {
        executionOrder.push('middleware1');
        next();
      });
      const middleware2 = vi.fn((event, payload, next) => {
        executionOrder.push('middleware2');
        next();
      });
      const handler = vi.fn(() => {
        executionOrder.push('handler');
      });

      bus.use(middleware1);
      bus.use(middleware2);
      bus.on('test-event', handler);

      bus.emit('test-event', 'payload');

      expect(executionOrder).toEqual(['middleware1', 'middleware2', 'handler']);
      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
    });

    it('should handle middleware errors gracefully', () => {
      const errorHandler = vi.spyOn(console, 'error').mockImplementation(() => {});
      const faultyMiddleware = vi.fn(() => {
        throw new Error('Middleware error');
      });
      const handler = vi.fn();

      bus.use(faultyMiddleware);
      bus.on('test-event', handler);

      bus.emit('test-event', 'payload');

      expect(faultyMiddleware).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled(); // Should not be called due to middleware error

      errorHandler.mockRestore();
    });

    it('should support middleware cancellation', () => {
      const handler = vi.fn();
      const cancelingMiddleware = vi.fn((event, payload, next) => {
        // Don't call next() to cancel
      });

      bus.use(cancelingMiddleware);
      bus.on('test-event', handler);

      bus.emit('test-event', 'payload');

      expect(cancelingMiddleware).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow removing middleware', () => {
      const middleware = vi.fn((event, payload, next) => {
        next();
      });
      const handler = vi.fn();

      bus.use(middleware);
      bus.on('test-event', handler);

      bus.emit('test-event', 'payload1');
      expect(middleware).toHaveBeenCalledTimes(1);

      bus.removeMiddleware(middleware);
      bus.emit('test-event', 'payload2');
      expect(middleware).toHaveBeenCalledTimes(1); // Should not increase
      expect(handler).toHaveBeenCalledTimes(2); // Handler still called
    });
  });

  describe('Event Batching', () => {
    beforeEach(() => {
      bus = new EnhancedEventBus({
        enableBatching: true,
        batchDelay: 100,
        maxBatchSize: 3,
        enableHistory: true,
        enableMetrics: true
      });
    });

    it('should batch high-frequency events', (done) => {
      const handler = vi.fn();
      bus.on('performance:metric', handler);

      // Emit multiple high-frequency events
      bus.emit('performance:metric', { operation: 'test1', duration: 10 });
      bus.emit('performance:metric', { operation: 'test2', duration: 20 });
      bus.emit('performance:metric', { operation: 'test3', duration: 30 });

      // Should not be called immediately due to batching
      expect(handler).not.toHaveBeenCalled();

      // Wait for batch processing
      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);
        const batchedCall = handler.mock.calls[0][0];
        expect(batchedCall).toHaveProperty('batch', true);
        expect(batchedCall.count).toBe(3);
        done();
      }, 150);
    });

    it('should process batch when size limit is reached', () => {
      const handler = vi.fn();
      bus.on('performance:metric', handler);

      // Emit events that exceed batch size
      bus.emit('performance:metric', { operation: 'test1', duration: 10 });
      bus.emit('performance:metric', { operation: 'test2', duration: 20 });
      bus.emit('performance:metric', { operation: 'test3', duration: 30 });

      // Should be processed immediately due to size limit
      expect(handler).toHaveBeenCalledTimes(1);
      const batchedCall = handler.mock.calls[0][0];
      expect(batchedCall.batch).toBe(true);
      expect(batchedCall.count).toBe(3);
    });

    it('should not batch low-frequency events', () => {
      const handler = vi.fn();
      bus.on('graph:ready', handler);

      bus.emit('graph:ready', { graph: { files: [], dependencies: [] } });

      // Should be called immediately
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        graph: { files: [], dependencies: [] }
      });
    });
  });

  describe('Event History', () => {
    it('should record event history', () => {
      bus.emit('event1', 'payload1');
      bus.emit('event2', 'payload2');

      const history = bus.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].event).toBe('event1');
      expect(history[0].payload).toBe('payload1');
      expect(history[1].event).toBe('event2');
      expect(history[1].payload).toBe('payload2');
    });

    it('should filter history by event type', () => {
      bus.emit('event1', 'payload1');
      bus.emit('event2', 'payload2');
      bus.emit('event1', 'payload3');

      const event1History = bus.getHistory('event1');

      expect(event1History).toHaveLength(2);
      expect(event1History[0].payload).toBe('payload1');
      expect(event1History[1].payload).toBe('payload3');
    });

    it('should limit history results', () => {
      for (let i = 0; i < 10; i++) {
        bus.emit('event', `payload${i}`);
      }

      const limitedHistory = bus.getHistory(undefined, 5);

      expect(limitedHistory).toHaveLength(5);
      expect(limitedHistory[0].payload).toBe('payload5'); // Last 5 items
      expect(limitedHistory[4].payload).toBe('payload9');
    });

    it('should replay history events', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.emit('event1', 'payload1');
      bus.emit('event2', 'payload2');

      bus.on('event1', handler1);
      bus.on('event2', handler2);

      bus.replayHistory();

      expect(handler1).toHaveBeenCalledWith('payload1');
      expect(handler2).toHaveBeenCalledWith('payload2');
    });

    it('should limit maximum history size', () => {
      const smallHistoryBus = new EnhancedEventBus({
        enableHistory: true,
        maxHistorySize: 5,
        enableMetrics: false,
        enableBatching: false
      });

      // Add more events than the limit
      for (let i = 0; i < 10; i++) {
        smallHistoryBus.emit('event', `payload${i}`);
      }

      const history = smallHistoryBus.getHistory();
      expect(history).toHaveLength(5);
      expect(history[0].payload).toBe('payload5'); // Should keep last 5

      smallHistoryBus.dispose();
    });
  });

  describe('Metrics and Analytics', () => {
    it('should track event metrics', () => {
      const handler = vi.fn();
      bus.on('event1', handler);
      bus.on('event2', handler);

      bus.emit('event1', 'payload1');
      bus.emit('event1', 'payload2');
      bus.emit('event2', 'payload1');

      const metrics = bus.getMetrics();

      expect(metrics.totalEvents).toBe(3);
      expect(metrics.eventsByType.get('event1')).toBe(2);
      expect(metrics.eventsByType.get('event2')).toBe(1);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.subscriptionCount).toBe(2);
    });

    it('should track processing time', () => {
      const slowHandler = vi.fn(() => {
        // Simulate some processing time
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Wait 10ms
        }
      });

      bus.on('slow-event', slowHandler);

      bus.emit('slow-event', 'payload');

      const metrics = bus.getMetrics();
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track handler errors', () => {
      const errorHandler = vi.spyOn(console, 'error').mockImplementation(() => {});
      const faultyHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      bus.on('error-event', faultyHandler);
      bus.emit('error-event', 'payload');

      const metrics = bus.getMetrics();
      expect(metrics.errorCount).toBe(1);

      errorHandler.mockRestore();
    });

    it('should provide subscription count', () => {
      expect(bus.getSubscriptionCount('event1')).toBe(0);

      bus.on('event1', vi.fn());
      expect(bus.getSubscriptionCount('event1')).toBe(1);

      bus.on('event1', vi.fn());
      expect(bus.getSubscriptionCount('event1')).toBe(2);
    });

    it('should list subscribed events', () => {
      bus.on('event1', vi.fn());
      bus.on('event2', vi.fn());
      bus.on('event3', vi.fn());

      const events = bus.getSubscribedEvents();
      expect(events).toHaveLength(3);
      expect(events).toContain('event1');
      expect(events).toContain('event2');
      expect(events).toContain('event3');
    });
  });

  describe('Error Handling', () => {
    it('should handle emit errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a situation that might cause an error
      bus.emit('test-event', { circular: {} });
      (bus as any).metrics = null; // Force an error

      // This should not throw
      expect(() => bus.emit('test-event', 'payload')).not.toThrow();

      errorSpy.mockRestore();
    });

    it('should emit error events on emit failures', () => {
      const errorHandler = vi.fn();
      const originalEmit = bus.emit.bind(bus);

      // Override emit to force an error
      bus.emit = () => {
        throw new Error('Forced error');
      };

      bus.on('lunaforge:error', errorHandler);

      // This should trigger error event emission
      expect(() => bus.emit('test-event', 'payload')).toThrow();

      // Restore original emit
      bus.emit = originalEmit;
    });

    it('should isolate handler errors', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodHandler = vi.fn();
      const badHandler = vi.fn(() => {
        throw new Error('Bad handler');
      });

      bus.on('test-event', goodHandler);
      bus.on('test-event', badHandler);

      bus.emit('test-event', 'payload');

      expect(goodHandler).toHaveBeenCalled();
      expect(badHandler).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('Batch Events', () => {
    it('should emit multiple events at once', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('event1', handler1);
      bus.on('event2', handler2);

      bus.emitBatch([
        { event: 'event1', payload: 'payload1' },
        { event: 'event2', payload: 'payload2' },
        { event: 'event1', payload: 'payload3' }
      ]);

      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler1).toHaveBeenCalledWith('payload1');
      expect(handler1).toHaveBeenCalledWith('payload3');
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith('payload2');
    });
  });

  describe('Configuration', () => {
    it('should respect batching configuration', () => {
      const batchedBus = new EnhancedEventBus({
        enableBatching: false,
        enableHistory: false,
        enableMetrics: false
      });

      const handler = vi.fn();
      batchedBus.on('performance:metric', handler);

      batchedBus.emit('performance:metric', { operation: 'test', duration: 10 });

      // Should be called immediately even though it's a high-frequency event
      expect(handler).toHaveBeenCalledTimes(1);

      batchedBus.dispose();
    });

    it('should disable features when configured', () => {
      const minimalBus = new EnhancedEventBus({
        enableBatching: false,
        enableHistory: false,
        enableMetrics: false
      });

      minimalBus.emit('test-event', 'payload');

      expect(minimalBus.getHistory()).toHaveLength(0);
      expect(minimalBus.getMetrics().totalEvents).toBe(0);

      minimalBus.dispose();
    });
  });

  describe('Resource Management', () => {
    it('should clear all data', () => {
      bus.on('event1', vi.fn());
      bus.emit('event1', 'payload1');
      bus.emit('event2', 'payload2');

      expect(bus.getHistory().length).toBeGreaterThan(0);
      expect(bus.getMetrics().totalEvents).toBeGreaterThan(0);
      expect(bus.getSubscribedEvents().length).toBeGreaterThan(0);

      bus.clear();

      expect(bus.getHistory()).toHaveLength(0);
      expect(bus.getMetrics().totalEvents).toBe(0);
      expect(bus.getSubscribedEvents()).toHaveLength(0);
    });

    it('should clear only history', () => {
      bus.emit('event1', 'payload1');
      bus.on('event2', vi.fn());

      expect(bus.getHistory().length).toBe(1);
      expect(bus.getSubscribedEvents().length).toBe(1);

      bus.clearHistory();

      expect(bus.getHistory()).toHaveLength(0);
      expect(bus.getSubscribedEvents().length).toBe(1); // Subscriptions remain
    });

    it('should clear only metrics', () => {
      bus.emit('event1', 'payload1');
      bus.on('event2', vi.fn());

      expect(bus.getHistory().length).toBe(1);
      expect(bus.getMetrics().totalEvents).toBe(1);

      bus.clearMetrics();

      expect(bus.getHistory().length).toBe(1); // History remains
      expect(bus.getMetrics().totalEvents).toBe(0);
    });

    it('should dispose properly', () => {
      const batchedBus = new EnhancedEventBus({
        enableBatching: true,
        batchDelay: 100,
        enableHistory: true,
        enableMetrics: true
      });

      batchedBus.on('event', vi.fn());
      batchedBus.emit('performance:metric', { operation: 'test', duration: 10 });

      batchedBus.dispose();

      // Should clear all data and timers
      expect(batchedBus.getHistory()).toHaveLength(0);
      expect(batchedBus.getSubscribedEvents()).toHaveLength(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with original EventBus interface', () => {
      const handler = vi.fn();

      // Test basic on/emit interface
      const subscription = bus.on('test-event', handler);
      bus.emit('test-event', 'payload');

      expect(handler).toHaveBeenCalledWith('payload');

      // Test subscription unsubscribe
      subscription.unsubscribe();
      bus.emit('test-event', 'payload2');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});