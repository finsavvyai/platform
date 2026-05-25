import type { EventContracts } from "./types";

export type EventHandler<T = any> = (payload: T) => void;

export interface Subscription {
  unsubscribe(): void;
}

export interface EventMiddleware {
  (event: string, payload: any, next: () => void): void;
}

export interface EventBatch {
  events: Array<{
    event: string;
    payload: any;
    timestamp: number;
  }>;
  size: number;
}

export interface EventBusConfig {
  enableBatching: boolean;
  batchDelay: number;
  maxBatchSize: number;
  enableHistory: boolean;
  maxHistorySize: number;
  enableMetrics: boolean;
}

export interface EventHistory {
  event: string;
  payload: any;
  timestamp: number;
  id: string;
}

export interface EventBusMetrics {
  totalEvents: number;
  eventsByType: Map<string, number>;
  averageProcessingTime: number;
  errorCount: number;
  subscriptionCount: number;
}

/**
 * Enhanced EventBus with type safety, middleware, batching, and history
 */
export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private middleware: EventMiddleware[] = [];
  private history: EventHistory[] = [];
  private metrics: EventBusMetrics;
  private config: EventBusConfig;
  private batchQueue: EventBatch | null = null;
  private batchTimer: any = null;
  private eventCounter = 0;

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = {
      enableBatching: false,
      batchDelay: 50, // 50ms batching delay
      maxBatchSize: 100,
      enableHistory: true,
      maxHistorySize: 1000,
      enableMetrics: true,
      ...config
    };

    this.metrics = {
      totalEvents: 0,
      eventsByType: new Map(),
      averageProcessingTime: 0,
      errorCount: 0,
      subscriptionCount: 0
    };
  }

  /**
   * Subscribe to typed event with type safety
   */
  onTyped<K extends keyof EventContracts>(
    event: K,
    handler: EventHandler<EventContracts[K]>
  ): Subscription {
    return this.on(event as string, handler);
  }

  /**
   * Subscribe to event (backward compatibility)
   */
  on<T = any>(event: string, handler: EventHandler<T>): Subscription {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const handlerSet = this.handlers.get(event)!;
    handlerSet.add(handler as EventHandler);
    this.metrics.subscriptionCount++;

    return {
      unsubscribe: () => {
        handlerSet.delete(handler as EventHandler);
        this.metrics.subscriptionCount = Math.max(0, this.metrics.subscriptionCount - 1);

        if (handlerSet.size === 0) {
          this.handlers.delete(event);
        }
      }
    };
  }

  /**
   * Emit typed event with type safety
   */
  emitTyped<K extends keyof EventContracts>(
    event: K,
    payload: EventContracts[K]
  ): void {
    this.emit(event as string, payload);
  }

  /**
   * Emit event with enhanced features
   */
  emit<T = any>(event: string, payload: T): void {
    const startTime = Date.now();

    try {
      // Update metrics
      this.updateMetrics(event);

      // Add to history if enabled
      if (this.config.enableHistory) {
        this.addToHistory(event, payload);
      }

      // Handle batching
      if (this.config.enableBatching && this.shouldBatch(event)) {
        this.addToBatch(event, payload);
        return;
      }

      // Process immediately
      this.processEvent(event, payload);

      // Update processing time
      const processingTime = Date.now() - startTime;
      this.updateProcessingTime(processingTime);

    } catch (error) {
      this.metrics.errorCount++;
      this.handleEmitError(event, payload, error);
    }
  }

  /**
   * Emit multiple events in a batch
   */
  emitBatch(events: Array<{ event: string; payload: any }>): void {
    for (const { event, payload } of events) {
      this.emit(event, payload);
    }
  }

  /**
   * Add middleware for event processing
   */
  use(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(middleware: EventMiddleware): void {
    const index = this.middleware.indexOf(middleware);
    if (index > -1) {
      this.middleware.splice(index, 1);
    }
  }

  /**
   * Get event history
   */
  getHistory(event?: string, limit?: number): EventHistory[] {
    let history = this.history;

    if (event) {
      history = history.filter(h => h.event === event);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * Replay events from history
   */
  replayHistory(event?: string, limit?: number): void {
    const events = this.getHistory(event, limit);
    for (const eventHistory of events) {
      this.emit(eventHistory.event, eventHistory.payload);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): EventBusMetrics {
    return {
      ...this.metrics,
      eventsByType: new Map(this.metrics.eventsByType)
    };
  }

  /**
   * Get subscription count for event
   */
  getSubscriptionCount(event: string): number {
    return this.handlers.get(event)?.size || 0;
  }

  /**
   * Get all event names with subscribers
   */
  getSubscribedEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers, history, and metrics
   */
  clear(): void {
    this.handlers.clear();
    this.history = [];
    this.metrics = {
      totalEvents: 0,
      eventsByType: new Map(),
      averageProcessingTime: 0,
      errorCount: 0,
      subscriptionCount: 0
    };
    this.clearBatch();
  }

  /**
   * Clear only history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Clear only metrics
   */
  clearMetrics(): void {
    this.metrics = {
      totalEvents: 0,
      eventsByType: new Map(),
      averageProcessingTime: 0,
      errorCount: 0,
      subscriptionCount: this.metrics.subscriptionCount
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clear();
    this.clearBatch();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Process event through middleware and handlers
   */
  private processEvent(event: string, payload: any): void {
    let middlewareIndex = 0;

    const next = () => {
      if (middlewareIndex < this.middleware.length) {
        const middleware = this.middleware[middlewareIndex++];
        try {
          middleware(event, payload, next);
        } catch (error) {
          this.metrics.errorCount++;
          console.error('[EventBus] Middleware error:', error);
        }
      } else {
        // All middleware executed, now call handlers
        this.callHandlers(event, payload);
      }
    };

    next();
  }

  /**
   * Call all event handlers
   */
  private callHandlers(event: string, payload: any): void {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) return;

    // Create a copy to avoid issues if handlers are modified during iteration
    const handlersArray = Array.from(handlers);

    for (const handler of handlersArray) {
      try {
        handler(payload);
      } catch (error) {
        this.metrics.errorCount++;
        console.error(`[EventBus] Handler error for event "${event}":`, error);
      }
    }
  }

  /**
   * Update event metrics
   */
  private updateMetrics(event: string): void {
    this.metrics.totalEvents++;
    const currentCount = this.metrics.eventsByType.get(event) || 0;
    this.metrics.eventsByType.set(event, currentCount + 1);
  }

  /**
   * Update average processing time
   */
  private updateProcessingTime(processingTime: number): void {
    const total = this.metrics.totalEvents;
    if (total === 1) {
      this.metrics.averageProcessingTime = processingTime;
    } else {
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime * (total - 1) + processingTime) / total;
    }
  }

  /**
   * Add event to history
   */
  private addToHistory(event: string, payload: any): void {
    const eventHistory: EventHistory = {
      event,
      payload,
      timestamp: Date.now(),
      id: `event_${++this.eventCounter}_${Date.now()}`
    };

    this.history.push(eventHistory);

    // Limit history size
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Determine if event should be batched
   */
  private shouldBatch(event: string): boolean {
    // High-frequency events should be batched
    const highFrequencyEvents = [
      'performance:metric',
      'cache:hit',
      'cache:miss',
      'graph:updated',
      'mode:progress'
    ];

    return highFrequencyEvents.includes(event);
  }

  /**
   * Add event to batch
   */
  private addToBatch(event: string, payload: any): void {
    if (!this.batchQueue) {
      this.batchQueue = {
        events: [],
        size: 0
      };
    }

    this.batchQueue.events.push({
      event,
      payload,
      timestamp: Date.now()
    });

    this.batchQueue.size++;

    // Process batch if it's full or set timer
    if (this.batchQueue.size >= this.config.maxBatchSize) {
      this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.batchDelay);
    }
  }

  /**
   * Process current batch
   */
  private processBatch(): void {
    if (!this.batchQueue || this.batchQueue.events.length === 0) {
      return;
    }

    const batch = this.batchQueue;
    this.batchQueue = null;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Group events by type for efficient processing
    const eventsByType = new Map<string, any[]>();
    for (const eventItem of batch.events) {
      if (!eventsByType.has(eventItem.event)) {
        eventsByType.set(eventItem.event, []);
      }
      eventsByType.get(eventItem.event)!.push(eventItem.payload);
    }

    // Process each event type
    for (const [eventType, payloads] of eventsByType) {
      // For batched events, we can send aggregated data
      if (payloads.length === 1) {
        this.processEvent(eventType, payloads[0]);
      } else {
        // Create aggregated payload for multiple events
        this.processEvent(eventType, {
          batch: true,
          count: payloads.length,
          data: payloads
        });
      }
    }
  }

  /**
   * Clear batch timer and queue
   */
  private clearBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.batchQueue = null;
  }

  /**
   * Handle emit errors
   */
  private handleEmitError(event: string, payload: any, error: any): void {
    console.error(`[EventBus] Error emitting event "${event}":`, error);

    // Emit error event if possible (avoid infinite loops)
    if (event !== 'lunaforge:error') {
      try {
        this.emit('lunaforge:error', {
          error: error.message || String(error),
          context: `EventBus.emit("${event}")`,
          originalEvent: event,
          originalPayload: payload
        });
      } catch (emitError) {
        console.error('[EventBus] Error emitting error event:', emitError);
      }
    }
  }
}
