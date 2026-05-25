/**
 * Questro AI-Powered Testing Automation Platform
 * Observability Middleware
 *
 * Express middleware for automatic observability data collection
 * including metrics, logging, tracing, and performance monitoring.
 */

import { Request, Response, NextFunction } from 'express';
import { ObservabilityManager } from '../observability-manager';
import { v4 as uuidv4 } from 'uuid';

export interface ObservabilityMiddlewareOptions {
  excludePaths?: string[];
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  traceHeaders?: boolean;
  collectMetrics?: boolean;
  collectLogs?: boolean;
  collectTraces?: boolean;
}

/**
 * Express middleware for observability
 */
export class ObservabilityMiddleware {
  private observabilityManager: ObservabilityManager;
  private options: ObservabilityMiddlewareOptions;

  constructor(observabilityManager: ObservabilityManager, options: ObservabilityMiddlewareOptions = {}) {
    this.observabilityManager = observabilityManager;
    this.options = {
      excludePaths: ['/health', '/metrics', '/favicon.ico'],
      includeRequestBody: false,
      includeResponseBody: false,
      traceHeaders: true,
      collectMetrics: true,
      collectLogs: true,
      collectTraces: true,
      ...options
    };
  }

  /**
   * Main middleware function
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip excluded paths
      if (this.shouldExcludePath(req.path)) {
        return next();
      }

      // Generate request ID
      const requestId = uuidv4();
      req.headers['x-request-id'] = requestId;

      // Start timing
      const startTime = Date.now();
      let traceSpan: any = null;

      // Start trace span if enabled
      if (this.options.collectTraces) {
        const parentTraceId = this.extractTraceId(req.headers);
        traceSpan = this.observabilityManager.startTrace(
          `${req.method} ${req.path}`,
          parentTraceId
        );
      }

      // Log request start
      if (this.options.collectLogs) {
        this.observabilityManager.addLog({
          timestamp: new Date(),
          level: 'info',
          service: 'api',
          message: `Incoming request: ${req.method} ${req.path}`,
          metadata: {
            method: req.method,
            path: req.path,
            userAgent: req.headers['user-agent'],
            ip: this.getClientIP(req),
            requestId,
            traceId: traceSpan?.traceId,
            spanId: traceSpan?.spanId,
            body: this.options.includeRequestBody ? req.body : undefined
          },
          traceId: traceSpan?.traceId,
          spanId: traceSpan?.spanId
        });
      }

      // Override response methods to capture data
      this.wrapResponse(res, req, startTime, traceSpan, requestId);

      next();
    };
  }

  /**
   * Wrap response object to capture data
   */
  private wrapResponse(res: Response, req: Request, startTime: number, traceSpan: any, requestId: string): void {
    const originalWrite = res.write;
    const originalEnd = res.end;
    const originalJson = res.json;
    let responseBody: any;
    let statusCode: number;

    // Capture status code
    res.on('finish', () => {
      statusCode = res.statusCode;
    });

    // Capture JSON response body
    res.json = function(data: any) {
      responseBody = data;
      return originalJson.call(this, data);
    };

    // Capture response body
    res.write = function(chunk: any, encoding?: any) {
      if (this.options.includeResponseBody && !responseBody) {
        responseBody = chunk;
      }
      return originalWrite.call(this, chunk, encoding);
    };

    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      const finalStatusCode = statusCode || res.statusCode;

      // Record metrics
      if (this.options.collectMetrics) {
        this.recordMetrics(req, finalStatusCode, duration);
      }

      // Log response
      if (this.options.collectLogs) {
        this.logResponse(req, finalStatusCode, duration, requestId, traceSpan, responseBody);
      }

      // Complete trace span
      if (this.options.collectTraces && traceSpan) {
        this.completeTraceSpan(traceSpan, req, finalStatusCode, duration);
      }

      return originalEnd.call(this, chunk, encoding);
    }.bind(this);
  }

  /**
   * Record metrics for the request
   */
  private recordMetrics(req: Request, statusCode: number, duration: number): void {
    const labels = {
      method: req.method,
      route: this.getRoutePattern(req),
      status: statusCode.toString()
    };

    // Record HTTP metrics
    this.observabilityManager.incrementCounter('http_requests_total', labels);
    this.observabilityManager.recordHistogram('http_request_duration_ms', duration, {
      method: req.method,
      route: this.getRoutePattern(req)
    });

    // Record error metrics
    if (statusCode >= 400) {
      this.observabilityManager.incrementCounter('http_errors_total', {
        method: req.method,
        route: this.getRoutePattern(req),
        status: statusCode.toString(),
        errorType: statusCode >= 500 ? 'server_error' : 'client_error'
      });
    }

    // Record success metrics
    if (statusCode >= 200 && statusCode < 300) {
      this.observabilityManager.incrementCounter('http_success_total', {
        method: req.method,
        route: this.getRoutePattern(req)
      });
    }
  }

  /**
   * Log response details
   */
  private logResponse(req: Request, statusCode: number, duration: number, requestId: string, traceSpan: any, responseBody?: any): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this.observabilityManager.addLog({
      timestamp: new Date(),
      level,
      service: 'api',
      message: `Request completed: ${req.method} ${req.path} - ${statusCode} (${duration}ms)`,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        requestId,
        traceId: traceSpan?.traceId,
        spanId: traceSpan?.spanId,
        responseSize: JSON.stringify(responseBody || {}).length,
        body: this.options.includeResponseBody ? responseBody : undefined
      },
      traceId: traceSpan?.traceId,
      spanId: traceSpan?.spanId
    });
  }

  /**
   * Complete trace span with tags
   */
  private completeTraceSpan(traceSpan: any, req: Request, statusCode: number, duration: number): void {
    const tags = {
      'http.method': req.method,
      'http.path': req.path,
      'http.status_code': statusCode.toString(),
      'http.duration_ms': duration.toString(),
      'component': 'express-middleware'
    };

    const status = statusCode >= 500 ? 'error' : 'ok';

    this.observabilityManager.finishTrace(traceSpan.traceId, traceSpan.spanId, tags, status);
  }

  /**
   * Check if path should be excluded
   */
  private shouldExcludePath(path: string): boolean {
    return this.options.excludePaths!.some(excludePath =>
      path.startsWith(excludePath) || path === excludePath
    );
  }

  /**
   * Extract trace ID from headers
   */
  private extractTraceId(headers: any): string | undefined {
    if (!this.options.traceHeaders) return undefined;

    // Try various trace header formats
    const traceHeaders = [
      'x-trace-id',
      'uber-trace-id',
      'x-b3-traceid',
      'x-request-id',
      'traceparent'
    ];

    for (const header of traceHeaders) {
      const value = headers[header];
      if (value) {
        // Parse different trace header formats
        if (header === 'traceparent') {
          // W3C Trace Context format: traceparent-00-traceId-parentId-flags
          const parts = value.split('-');
          if (parts.length >= 2) {
            return parts[1];
          }
        } else if (header === 'uber-trace-id') {
          // Jaeger format: traceId:spanId:parentSpanId:flags
          const parts = value.split(':');
          if (parts.length >= 1) {
            return parts[0];
          }
        } else {
          return value;
        }
      }
    }

    return undefined;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return req.headers['x-forwarded-for'] as string ||
           req.headers['x-real-ip'] as string ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  /**
   * Get route pattern (simplified)
   */
  private getRoutePattern(req: Request): string {
    // This would typically use your router's route pattern
    // For now, return the path with parameter placeholders
    return req.path
      .replace(/\/[a-f0-9]{24}/g, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid');
  }

  /**
   * Error handling middleware
   */
  errorHandler() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      const traceId = (req as any).traceId || uuidv4();

      // Log error
      this.observabilityManager.addLog({
        timestamp: new Date(),
        level: 'error',
        service: 'api',
        message: `Unhandled error in ${req.method} ${req.path}: ${err.message}`,
        metadata: {
          method: req.method,
          path: req.path,
          stack: err.stack,
          requestId: (req.headers['x-request-id'] as string),
          traceId
        },
        traceId
      });

      // Record error metrics
      this.observabilityManager.incrementCounter('unhandled_errors_total', {
        method: req.method,
        route: this.getRoutePattern(req),
        errorType: err.constructor.name
      });

      next(err);
    };
  }

  /**
   * Create route-specific middleware
   */
  routeMiddleware(routeName: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add route-specific metadata
      (req as any).routeName = routeName;

      // Record route-specific metrics
      this.observabilityManager.incrementCounter('route_requests_total', {
        route: routeName,
        method: req.method
      });

      next();
    };
  }

  /**
   * Database query middleware
   */
  databaseMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalQuery = (req as any).dbQuery;

      // Hook into database queries if available
      if (originalQuery) {
        (req as any).dbQuery = async (...args: any[]) => {
          const startTime = Date.now();
          try {
            const result = await originalQuery.apply(req, args);
            const duration = Date.now() - startTime;

            this.observabilityManager.recordHistogram('db_query_duration_ms', duration, {
              operation: args[0]?.toUpperCase() || 'unknown',
              table: this.extractTableFromQuery(args[0])
            });

            this.observabilityManager.incrementCounter('db_queries_total', {
              operation: args[0]?.toUpperCase() || 'unknown',
              table: this.extractTableFromQuery(args[0]),
              status: 'success'
            });

            return result;
          } catch (error) {
            const duration = Date.now() - startTime;

            this.observabilityManager.recordHistogram('db_query_duration_ms', duration, {
              operation: args[0]?.toUpperCase() || 'unknown',
              table: this.extractTableFromQuery(args[0])
            });

            this.observabilityManager.incrementCounter('db_queries_total', {
              operation: args[0]?.toUpperCase() || 'unknown',
              table: this.extractTableFromQuery(args[0]),
              status: 'error'
            });

            throw error;
          }
        };
      }

      next();
    };
  }

  /**
   * Extract table name from SQL query (simplified)
   */
  private extractTableFromQuery(query: string): string {
    if (!query || typeof query !== 'string') return 'unknown';

    const sql = query.toLowerCase().trim();

    // Simple regex to extract table name from common queries
    const match = sql.match(/(?:from|into|update)\s+(\w+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * AI service middleware
   */
  aiServiceMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const originalSend = res.send;

      res.send = function(data: any) {
        const duration = Date.now() - startTime;
        const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

        // Record AI service metrics
        this.observabilityManager.recordHistogram('ai_request_duration_ms', duration, {
          provider: 'openai', // This could be dynamic
          model: req.body?.model || 'unknown'
        });

        this.observabilityManager.incrementCounter('ai_requests_total', {
          provider: 'openai',
          model: req.body?.model || 'unknown',
          status: isSuccess ? 'success' : 'error'
        });

        // Extract token usage from response if available
        if (isSuccess && data) {
          try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            if (parsedData.usage) {
              this.observabilityManager.incrementCounter('ai_tokens_used_total',
                parsedData.usage.total_tokens || 0,
                {
                  provider: 'openai',
                  model: req.body?.model || 'unknown',
                  type: 'total'
                }
              );
            }
          } catch (error) {
            // Ignore JSON parsing errors
          }
        }

        return originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  /**
   * WebSocket middleware
   */
  websocketMiddleware() {
    return (socket: any, next: Function) => {
      const startTime = Date.now();
      const traceId = uuidv4();

      // Record connection metrics
      this.observabilityManager.incrementCounter('websocket_connections_total', {
        status: 'success'
      });

      this.observabilityManager.setGauge('websocket_connections_active',
        (this.observabilityManager.getMetrics().get('websocket_connections_active')?.values?.get('default') || 0) + 1
      );

      // Log connection
      this.observabilityManager.addLog({
        timestamp: new Date(),
        level: 'info',
        service: 'websocket',
        message: 'WebSocket connection established',
        metadata: {
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          traceId
        },
        traceId
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        const duration = Date.now() - startTime;

        this.observabilityManager.setGauge('websocket_connections_active',
          Math.max(0, (this.observabilityManager.getMetrics().get('websocket_connections_active')?.values?.get('default') || 0) - 1)
        );

        this.observabilityManager.addLog({
          timestamp: new Date(),
          level: 'info',
          service: 'websocket',
          message: `WebSocket connection closed: ${reason}`,
          metadata: {
            reason,
            duration,
            traceId
          },
          traceId
        });

        this.observabilityManager.recordHistogram('websocket_connection_duration_ms', duration);
      });

      // Handle messages
      socket.on('message', (message: any) => {
        this.observabilityManager.incrementCounter('websocket_messages_total', {
          type: typeof message,
          direction: 'incoming'
        });
      });

      // Override emit to track outgoing messages
      const originalEmit = socket.emit;
      socket.emit = (event: string, ...args: any[]) => {
        this.observabilityManager.incrementCounter('websocket_messages_total', {
          type: event,
          direction: 'outgoing'
        });

        return originalEmit.apply(socket, [event, ...args]);
      };

      next();
    };
  }
}

export { ObservabilityMiddleware };
