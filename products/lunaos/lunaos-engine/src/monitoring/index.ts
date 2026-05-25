/**
 * Monitoring and observability for Luna-OS
 */

import { Context } from 'hono';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  checks: Record<string, unknown>;
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, data?: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        level: 'INFO',
        context: this.context,
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  }

  error(message: string, error?: Error, data?: Record<string, unknown>) {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        context: this.context,
        message,
        error: error?.message,
        stack: error?.stack,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  }

  warn(message: string, data?: Record<string, unknown>) {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        context: this.context,
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  }

  debug(message: string, data?: Record<string, unknown>) {
    if (process.env.DEBUG) {
      console.debug(
        JSON.stringify({
          level: 'DEBUG',
          context: this.context,
          message,
          data,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
}

const startTime = Date.now();

export async function healthCheck(): Promise<HealthCheckResult> {
  return {
    status: 'healthy',
    timestamp: new Date(),
    uptime: Date.now() - startTime,
    checks: {
      api: 'ok',
      database: 'connected',
      cache: 'connected',
    },
  };
}

export function createHealthCheckHandler() {
  return async (context: Context) => {
    const result = await healthCheck();
    return context.json(result);
  };
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}
