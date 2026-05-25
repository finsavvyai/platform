import * as vscode from "vscode";

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  source?: string;
}

export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.LogOutputChannel;
  private currentLevel: LogLevel = LogLevel.INFO;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      "Universal Dependency Platform",
      {
        log: true,
      },
    );

    // Set log level based on extension configuration
    this.updateLogLevel();

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("upm.logLevel")) {
        this.updateLogLevel();
      }
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private updateLogLevel(): void {
    const config = vscode.workspace.getConfiguration("upm");
    const logLevel = config.get<string>("logLevel", "info");

    switch (logLevel.toLowerCase()) {
      case "error":
        this.currentLevel = LogLevel.ERROR;
        break;
      case "warn":
        this.currentLevel = LogLevel.WARN;
        break;
      case "info":
        this.currentLevel = LogLevel.INFO;
        break;
      case "debug":
        this.currentLevel = LogLevel.DEBUG;
        break;
      case "trace":
        this.currentLevel = LogLevel.TRACE;
        break;
      default:
        this.currentLevel = LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level].padEnd(5);
    const prefix = `[${timestamp}] [${levelName}]`;

    let formatted = `${prefix} ${message}`;

    if (data) {
      if (typeof data === "object") {
        try {
          formatted += `\n${JSON.stringify(data, null, 2)}`;
        } catch (e) {
          formatted += `\n[Object] ${String(data)}`;
        }
      } else {
        formatted += ` ${String(data)}`;
      }
    }

    return formatted;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: any,
    source?: string,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      source,
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Format and output
    const formattedMessage = this.formatMessage(level, message, data);

    switch (level) {
      case LogLevel.ERROR:
        this.outputChannel.error(message, data);
        if (source) {
          console.error(`[UPM:${source}] ${message}`, data);
        } else {
          console.error(`[UPM] ${message}`, data);
        }
        break;
      case LogLevel.WARN:
        this.outputChannel.warn(message, data);
        if (source) {
          console.warn(`[UPM:${source}] ${message}`, data);
        } else {
          console.warn(`[UPM] ${message}`, data);
        }
        break;
      case LogLevel.INFO:
        this.outputChannel.info(message, data);
        if (source) {
          console.info(`[UPM:${source}] ${message}`, data);
        } else {
          console.info(`[UPM] ${message}`, data);
        }
        break;
      case LogLevel.DEBUG:
        this.outputChannel.debug(message, data);
        if (source) {
          console.debug(`[UPM:${source}] ${message}`, data);
        } else {
          console.debug(`[UPM] ${message}`, data);
        }
        break;
      case LogLevel.TRACE:
        this.outputChannel.trace(message, data);
        if (source) {
          console.trace(`[UPM:${source}] ${message}`, data);
        } else {
          console.trace(`[UPM] ${message}`, data);
        }
        break;
    }
  }

  public static error(message: string, data?: any): void {
    Logger.getInstance().log(LogLevel.ERROR, message, data, "Extension");
  }

  public static warn(message: string, data?: any): void {
    Logger.getInstance().log(LogLevel.WARN, message, data, "Extension");
  }

  public static info(message: string, data?: any): void {
    Logger.getInstance().log(LogLevel.INFO, message, data, "Extension");
  }

  public static debug(message: string, data?: any): void {
    Logger.getInstance().log(LogLevel.DEBUG, message, data, "Extension");
  }

  public static trace(message: string, data?: any): void {
    Logger.getInstance().log(LogLevel.TRACE, message, data, "Extension");
  }

  public static createLogger(source: string): {
    error: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    info: (message: string, data?: any) => void;
    debug: (message: string, data?: any) => void;
    trace: (message: string, data?: any) => void;
  } {
    const logger = Logger.getInstance();
    return {
      error: (message: string, data?: any) =>
        logger.log(LogLevel.ERROR, message, data, source),
      warn: (message: string, data?: any) =>
        logger.log(LogLevel.WARN, message, data, source),
      info: (message: string, data?: any) =>
        logger.log(LogLevel.INFO, message, data, source),
      debug: (message: string, data?: any) =>
        logger.log(LogLevel.DEBUG, message, data, source),
      trace: (message: string, data?: any) =>
        logger.log(LogLevel.TRACE, message, data, source),
    };
  }

  public getOutputChannel(): vscode.LogOutputChannel {
    return this.outputChannel;
  }

  public show(): void {
    this.outputChannel.show();
  }

  public hide(): void {
    this.outputChannel.hide();
  }

  public clear(): void {
    this.outputChannel.clear();
    this.logBuffer = [];
  }

  public getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  public exportLogs(): string {
    const logs = this.logBuffer.map((entry) => {
      return `${entry.timestamp} [${LogLevel[entry.level]}] ${entry.message}${entry.data ? "\n" + JSON.stringify(entry.data, null, 2) : ""}`;
    });

    return logs.join("\n");
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
