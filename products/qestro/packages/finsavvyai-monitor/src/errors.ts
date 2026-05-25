/**
 * @finsavvyai/monitor — Error tracking and reporting
 */

import { incrementCounter } from './metrics.js';

export interface ErrorReport {
  message: string;
  stack?: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, unknown>;
  timestamp: string;
}

export function captureError(
  error: Error,
  context: Record<string, unknown> = {},
  severity: ErrorReport['severity'] = 'medium',
): ErrorReport {
  incrementCounter('errors_total', { severity, name: error.name });

  return {
    message: error.message,
    stack: error.stack,
    name: error.name,
    severity,
    context,
    timestamp: new Date().toISOString(),
  };
}

export function captureCritical(
  error: Error,
  context: Record<string, unknown> = {},
): ErrorReport {
  return captureError(error, context, 'critical');
}

export interface PerformanceTimer {
  end: () => number;
}

export function startTimer(label: string): PerformanceTimer {
  const start = Date.now();
  return {
    end: () => {
      const duration = Date.now() - start;
      incrementCounter('operation_duration_ms', { label }, duration);
      return duration;
    },
  };
}
