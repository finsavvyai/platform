import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

class Logger {
  private logPath: string;
  private logLevel: LogLevel;

  constructor() {
    // Set up log file path in user data directory
    const userDataPath = app.getPath('userData');
    const logsPath = path.join(userDataPath, 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    this.logPath = path.join(logsPath, `queryflux-${timestamp}.log`);

    // Set log level from environment or default to INFO
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private writeLog(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const formattedMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;

    const logEntry = `[${timestamp}] [${pid}] [${level.toUpperCase()}] ${formattedMessage}\\n`;

    try {
      fs.appendFileSync(this.logPath, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    // Also output to console for development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === LogLevel.ERROR ? 'error' :
                           level === LogLevel.WARN ? 'warn' :
                           level === LogLevel.DEBUG ? 'debug' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}]`, message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.ERROR, message, ...args);
  }

  // Log database operations
  logDatabase(operation: string, connectionId: string, details?: any): void {
    this.info(`Database: ${operation}`, { connectionId, ...details });
  }

  // Log query execution
  logQuery(connectionId: string, query: string, executionTime: number, success: boolean): void {
    const logData = {
      connectionId,
      query: query.length > 200 ? query.substring(0, 200) + '...' : query,
      executionTime,
      success
    };

    if (success) {
      this.debug('Query executed successfully', logData);
    } else {
      this.warn('Query execution failed', logData);
    }
  }

  // Log AI operations
  logAI(operation: string, inputLength: number, outputLength: number, success: boolean): void {
    const logData = {
      operation,
      inputLength,
      outputLength,
      success
    };

    if (success) {
      this.debug('AI operation completed', logData);
    } else {
      this.error('AI operation failed', logData);
    }
  }

  // Log application events
  logEvent(event: string, details?: any): void {
    this.info(`Event: ${event}`, details);
  }

  // Get log file path
  getLogPath(): string {
    return this.logPath;
  }

  // Clean up old log files (keep last 7 days)
  cleanupOldLogs(): void {
    try {
      const userDataPath = app.getPath('userData');
      const logsPath = path.join(userDataPath, 'logs');

      if (fs.existsSync(logsPath)) {
        const files = fs.readdirSync(logsPath);
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        files.forEach(file => {
          if (file.startsWith('queryflux-') && file.endsWith('.log')) {
            const filePath = path.join(logsPath, file);
            const stats = fs.statSync(filePath);

            if (stats.mtime < sevenDaysAgo) {
              fs.unlinkSync(filePath);
              this.debug('Deleted old log file', { file });
            }
          }
        });
      }
    } catch (error) {
      this.error('Failed to cleanup old logs:', error);
    }
  }

  // Set log level
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('Log level changed', { from: this.logLevel, to: level });
  }
}

export const logger = new Logger();