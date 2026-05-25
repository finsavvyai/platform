/** Structured JSON logger with requestId propagation for the ClawPipe gateway. */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  projectId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  requestId?: string;
  [key: string]: unknown;
}

export class Logger {
  private ctx: LogContext;

  constructor(ctx: LogContext = {}) {
    this.ctx = ctx;
  }

  /** Return a child logger with additional context merged in. */
  child(extra: LogContext): Logger {
    return new Logger({ ...this.ctx, ...extra });
  }

  debug(msg: string, extra?: LogContext): void { this.emit('debug', msg, extra); }
  info(msg: string, extra?: LogContext): void { this.emit('info', msg, extra); }
  warn(msg: string, extra?: LogContext): void { this.emit('warn', msg, extra); }
  error(msg: string, extra?: LogContext): void { this.emit('error', msg, extra); }

  private emit(level: LogLevel, msg: string, extra?: LogContext): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...this.ctx,
      ...extra,
    };
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}

/** Create a request-scoped logger from an incoming Request. */
export function requestLogger(request: Request): Logger {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const url = new URL(request.url);
  return new Logger({ requestId, path: url.pathname, method: request.method });
}
