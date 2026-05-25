export interface LoggerContext {
  [key: string]: any;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private context: string;
  private level: LogLevel;

  constructor(context: string = "App", level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = level;
  }

  debug(message: string, context?: LoggerContext): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[${new Date().toISOString()}] [DEBUG] [${this.context}] ${message}`, context || "");
    }
  }

  info(message: string, context?: LoggerContext): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[${new Date().toISOString()}] [INFO] [${this.context}] ${message}`, context || "");
    }
  }

  warn(message: string, context?: LoggerContext): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${new Date().toISOString()}] [WARN] [${this.context}] ${message}`, context || "");
    }
  }

  error(message: string, context?: LoggerContext): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${new Date().toISOString()}] [ERROR] [${this.context}] ${message}`, context || "");
    }
  }

  withContext(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.level);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const globalLogger = new Logger("RAG-System");
