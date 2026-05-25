/**
 * Qestro Workers - Logger Utility
 *
 * Structured logging utility for Workers with request correlation
 */

export interface LogContext {
  requestId?: string
  userId?: string
  projectId?: string
  environment?: string
  [key: string]: any
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: Error
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export class Logger {
  private requestId?: string
  private environment: string

  constructor(requestId?: string, environment = 'development') {
    this.requestId = requestId
    this.environment = environment
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        requestId: context?.requestId || this.requestId,
        environment: context?.environment || this.environment
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }
  }

  private log(entry: LogEntry): void {
    const logLevel = entry.level.toUpperCase()
    const logMessage = `[${logLevel}] ${entry.timestamp} - ${entry.message}`

    if (entry.context) {
      console.log(logMessage, 'Context:', entry.context)
    } else {
      console.log(logMessage)
    }

    if (entry.error) {
      console.error('Error details:', entry.error)
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(this.formatMessage('debug', message, context))
  }

  info(message: string, context?: LogContext): void {
    this.log(this.formatMessage('info', message, context))
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(this.formatMessage('warn', message, context, error))
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(this.formatMessage('error', message, context, error))
  }

  static withRequest(requestId: string, environment?: string): Logger {
    return new Logger(requestId, environment)
  }
}

// Global logger instance
export const logger = new Logger(undefined, process.env.ENVIRONMENT || 'development')
