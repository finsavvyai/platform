/**
 * Structured Logging System
 * P2-4 FIX: Implement structured logging with correlation IDs and log levels
 */

export class Logger {
  constructor(context = {}) {
    this.context = context;
    this.requestId = context.requestId || this.generateRequestId();
    this.environment = context.environment || 'production';
    this.logLevel = this.parseLogLevel(context.logLevel || 'info');
  }

  /**
   * Parse log level to numeric value
   */
  parseLogLevel(level) {
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level.toLowerCase()] || 1;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Format log message as structured JSON
   */
  formatMessage(level, message, metadata = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      requestId: this.requestId,
      environment: this.environment,
      message,
      ...this.context,
      ...metadata
    };
  }

  /**
   * Check if log level should be logged
   */
  shouldLog(level) {
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] >= this.logLevel;
  }

  /**
   * Log debug message
   */
  debug(message, metadata = {}) {
    if (this.shouldLog('debug')) {
      console.log(JSON.stringify(this.formatMessage('debug', message, metadata)));
    }
  }

  /**
   * Log info message
   */
  info(message, metadata = {}) {
    if (this.shouldLog('info')) {
      console.log(JSON.stringify(this.formatMessage('info', message, metadata)));
    }
  }

  /**
   * Log warning message
   */
  warn(message, metadata = {}) {
    if (this.shouldLog('warn')) {
      console.warn(JSON.stringify(this.formatMessage('warn', message, metadata)));
    }
  }

  /**
   * Log error message
   */
  error(message, metadata = {}) {
    if (this.shouldLog('error')) {
      const errorData = this.formatMessage('error', message, metadata);

      // Add stack trace if error object provided
      if (metadata.error instanceof Error) {
        errorData.stack = metadata.error.stack;
        errorData.errorName = metadata.error.name;
      }

      console.error(JSON.stringify(errorData));
    }
  }

  /**
   * Log request start
   */
  logRequest(method, path, metadata = {}) {
    this.info(`${method} ${path}`, {
      ...metadata,
      type: 'request_start'
    });
  }

  /**
   * Log request end
   */
  logResponse(method, path, statusCode, duration, metadata = {}) {
    this.info(`${method} ${path} ${statusCode} ${duration}ms`, {
      ...metadata,
      type: 'request_end',
      statusCode,
      duration
    });
  }

  /**
   * Log database query
   */
  logQuery(query, duration, metadata = {}) {
    this.debug(`DB Query: ${query}`, {
      ...metadata,
      type: 'database_query',
      duration,
      query: query.substring(0, 200) // Truncate long queries
    });
  }

  /**
   * Log cache operation
   */
  logCache(operation, key, hit, metadata = {}) {
    this.debug(`Cache ${operation}: ${key}`, {
      ...metadata,
      type: 'cache_operation',
      operation,
      key,
      hit
    });
  }

  /**
   * Log security event
   */
  logSecurity(event, metadata = {}) {
    this.warn(`Security: ${event}`, {
      ...metadata,
      type: 'security_event',
      event
    });
  }

  /**
   * Log business metric
   */
  logMetric(metric, value, metadata = {}) {
    this.info(`Metric: ${metric} = ${value}`, {
      ...metadata,
      type: 'metric',
      metric,
      value
    });
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext = {}) {
    return new Logger({
      ...this.context,
      ...additionalContext,
      requestId: this.requestId,
      environment: this.environment
    });
  }

  /**
   * Log with custom level
   */
  log(level, message, metadata = {}) {
    switch (level.toLowerCase()) {
      case 'debug':
        this.debug(message, metadata);
        break;
      case 'info':
        this.info(message, metadata);
        break;
      case 'warn':
        this.warn(message, metadata);
        break;
      case 'error':
        this.error(message, metadata);
        break;
      default:
        this.info(message, metadata);
    }
  }
}

/**
 * Create logger from request
 */
export function createLogger(request, env) {
  const requestId = request.headers.get('x-request-id') ||
                   request.headers.get('cf-ray') ||
                   `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return new Logger({
    requestId,
    environment: env.ENVIRONMENT || 'production',
    logLevel: env.LOG_LEVEL || 'info',
    method: request.method,
    path: new URL(request.url).pathname,
    userAgent: request.headers.get('user-agent'),
    cfRay: request.headers.get('cf-ray'),
    cfCountry: request.headers.get('cf-ipcountry')
  });
}

export default Logger;
