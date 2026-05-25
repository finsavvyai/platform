/**
 * APMIntegration: Factory and setup for APM system
 * Initializes all APM components with default configuration
 */

import { TraceCollector } from './TraceCollector.js';
import { MetricsEngine } from './MetricsEngine.js';
import { AlertManager } from './AlertManager.js';
import { APMMiddleware } from './APMMiddleware.js';
import { createAPMRoutes } from './routes/apm.routes.js';
import { Express } from 'express';

export class APMIntegration {
  static traceCollector: TraceCollector;
  static metricsEngine: MetricsEngine;
  static alertManager: AlertManager;
  static apmMiddleware: APMMiddleware;

  /**
   * Initialize APM system
   */
  static initialize() {
    this.traceCollector = new TraceCollector({
      maxTracesInBuffer: 1000,
      enableAutoFlush: true,
      flushIntervalMs: 60000,
    });

    this.metricsEngine = new MetricsEngine({
      retentionMs: 86400000, // 24 hours
      aggregationIntervals: ['minute', 'hour'],
    });

    this.alertManager = new AlertManager(this.metricsEngine);

    this.apmMiddleware = new APMMiddleware(
      this.traceCollector,
      this.metricsEngine
    );

    return {
      traceCollector: this.traceCollector,
      metricsEngine: this.metricsEngine,
      alertManager: this.alertManager,
      apmMiddleware: this.apmMiddleware,
    };
  }

  /**
   * Register APM middleware in Express app
   */
  static registerMiddleware(app: Express) {
    app.use(this.apmMiddleware.middleware());
    app.use(this.apmMiddleware.errorMiddleware());
  }

  /**
   * Register APM routes in Express app
   */
  static registerRoutes(app: Express) {
    const apmRoutes = createAPMRoutes(
      this.traceCollector,
      this.metricsEngine,
      this.alertManager
    );

    app.use('/api/apm', apmRoutes);
  }

  /**
   * Start periodic alert evaluation
   */
  static startAlertEvaluation(intervalMs: number = 30000) {
    return setInterval(async () => {
      try {
        await this.alertManager.evaluate();
      } catch (error) {
        console.error('Alert evaluation error:', error);
      }
    }, intervalMs);
  }

  /**
   * Get comprehensive APM status
   */
  static getStatus() {
    return {
      traces: this.traceCollector.getStats(),
      metrics: this.metricsEngine.getMetricNames(),
      alerts: {
        active: this.alertManager.getActiveAlerts().length,
        rules: this.alertManager.getRules().length,
      },
      timestamp: Date.now(),
    };
  }
}
