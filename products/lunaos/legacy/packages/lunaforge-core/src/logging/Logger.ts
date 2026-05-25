/**
 * Logging system for LunaForge with structured logging and error handling
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  error?: Error;
  correlationId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFileLogging: boolean;
  maxLogEntries: number;
  logFilePath?: string;
}

/**
 * Structured logger for LunaForge
 */
export class Logger {
  private logs: LogEntry[] = [];
  private config: LoggerConfig;
  private correlationId: string;

  constructor(category: string, config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFileLogging: false,
      maxLogEntries: 1000,
      ...config
    };
    this.correlationId = this.generateCorrelationId();
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.FATAL, message, data, error);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (level < this.config.level) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category: this.getCategory(),
      message,
      data,
      error,
      correlationId: this.correlationId
    };

    this.addLogEntry(entry);
    this.outputLog(entry);
  }

  /**
   * Add log entry to memory
   */
  private addLogEntry(entry: LogEntry): void {
    this.logs.push(entry);

    // Keep only recent entries
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Output log entry to console and/or file
   */
  private outputLog(entry: LogEntry): void {
    const formattedMessage = this.formatLogEntry(entry);

    if (this.config.enableConsole) {
      this.outputToConsole(entry, formattedMessage);
    }

    if (this.config.enableFileLogging && this.config.logFilePath) {
      this.outputToFile(formattedMessage);
    }
  }

  /**
   * Output to console with appropriate styling
   */
  private outputToConsole(entry: LogEntry, formattedMessage: string): void {
    const { level, message, error } = entry;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage);
        if (error) console.error(error);
        break;
    }
  }

  /**
   * Output to file (placeholder implementation)
   */
  private outputToFile(formattedMessage: string): void {
    // File logging implementation would go here
    // For now, this is a placeholder
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const { category, message, data, correlationId } = entry;

    let formatted = `[${timestamp}] [${levelName}] [${category}]`;

    if (correlationId) {
      formatted += ` [${correlationId}]`;
    }

    formatted += `: ${message}`;

    if (data) {
      formatted += ` | Data: ${JSON.stringify(data)}`;
    }

    return formatted;
  }

  /**
   * Get category name from class name
   */
  private getCategory(): string {
    return this.constructor.name;
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent log entries
   */
  getLogs(level?: LogLevel, limit = 100): LogEntry[] {
    let filtered = this.logs;

    if (level !== undefined) {
      filtered = this.logs.filter(entry => entry.level >= level);
    }

    return filtered.slice(-limit);
  }

  /**
   * Get log statistics
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0
    };

    for (const entry of this.logs) {
      switch (entry.level) {
        case LogLevel.DEBUG:
          stats.debug++;
          break;
        case LogLevel.INFO:
          stats.info++;
          break;
        case LogLevel.WARN:
          stats.warn++;
          break;
        case LogLevel.ERROR:
          stats.error++;
          break;
        case LogLevel.FATAL:
          stats.fatal++;
          break;
      }
    }

    return stats;
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.logs = [];
  }
}

/**
 * Error boundary class for handling errors gracefully
 */
export class ErrorBoundary {
  private logger: Logger;
  private errorHandlers: Array<(error: Error, context?: string) => void> = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute function with error handling
   */
  async execute<T>(
    fn: () => Promise<T> | T,
    context?: string,
    onError?: (error: Error) => T | Promise<T>
  ): Promise<T> {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.logger.error(`Error in ${context || 'unknown context'}`, err, { context });

      // Call registered error handlers
      for (const handler of this.errorHandlers) {
        try {
          handler(err, context);
        } catch (handlerError) {
          this.logger.error('Error handler failed', handlerError instanceof Error ? handlerError : new Error(String(handlerError)));
        }
      }

      // Call provided error handler
      if (onError) {
        return onError(err);
      }

      throw err;
    }
  }

  /**
   * Register error handler
   */
  onError(handler: (error: Error, context?: string) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Remove error handler
   */
  removeErrorHandler(handler: (error: Error, context?: string) => void): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }
}

/**
 * Create logger instance
 */
export function createLogger(category: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(category, config);
}