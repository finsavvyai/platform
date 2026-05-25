/**
 * @finsavvyai/monitor — Monitoring, logging, and error tracking
 *
 * Features:
 * - Structured JSON logging with child loggers
 * - Sentry error capture integration
 * - Prometheus-compatible metrics (counter, gauge, histogram)
 * - Performance timers
 */

export {
  createLogger,
  configureSentry,
  type Logger,
  type LoggerConfig,
  type LogLevel,
  type LogContext,
} from './logger.js';

export {
  incrementCounter,
  setGauge,
  observeHistogram,
  getMetrics,
  getPrometheusOutput,
  resetMetrics,
  type MetricType,
  type MetricEntry,
} from './metrics.js';

export {
  captureError,
  captureCritical,
  startTimer,
  type ErrorReport,
  type PerformanceTimer,
} from './errors.js';
