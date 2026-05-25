/**
 * Professional Logging System for Questro CLI
 * Provides structured logging with multiple levels and output formats
 */

import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  command?: string;
  duration?: number;
  error?: Error;
}

class Logger {
  private currentLevel: LogLevel = 'info';
  private logFile?: string;
  private commandHistory: string[] = [];
  private startTime: number = Date.now();

  constructor() {
    // Set log level based on environment variables
    if (process.env.QESTRO_VERBOSE === 'true') {
      this.currentLevel = 'debug';
    } else if (process.env.QESTRO_QUIET === 'true') {
      this.currentLevel = 'error';
    }

    // Set up log file if specified
    const logDir = join(homedir(), '.qestro', 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    this.logFile = join(logDir, `qestro-cli-${timestamp}.log`);
  }

  private levelPriority: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  private colors: Record<LogLevel, (text: string) => string> = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.blue,
    debug: chalk.gray,
  };

  private symbols: Record<LogLevel, string> = {
    error: '✖',
    warn: '⚠',
    info: 'ℹ',
    debug: '○',
  };

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] <= this.levelPriority[this.currentLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const symbol = this.symbols[entry.level];
    const colorFn = this.colors[entry.level];

    let message = `${chalk.gray(timestamp)} ${colorFn(`${symbol} ${level}`)} ${entry.message}`;

    // Add command context if available
    if (entry.command) {
      message += ` ${chalk.gray(`[${entry.command}]`)}`;
    }

    // Add duration if available
    if (entry.duration) {
      message += ` ${chalk.gray(`(${entry.duration}ms)`)}`;
    }

    // Add metadata in debug mode
    if (entry.metadata && this.currentLevel === 'debug') {
      const metadataStr = JSON.stringify(entry.metadata, null, 2);
      message += `\n${chalk.gray('Metadata:')} ${chalk.cyan(metadataStr)}`;
    }

    // Add error details if available
    if (entry.error) {
      message += `\n${chalk.red('Error:')} ${entry.error.message}`;
      if (entry.error.stack && this.currentLevel === 'debug') {
        message += `\n${chalk.red('Stack:')} ${entry.error.stack}`;
      }
    }

    return message;
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.logFile) return;

    try {
      const logEntry = {
        ...entry,
        timestamp: new Date(entry.timestamp).toISOString(),
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      writeFileSync(this.logFile, logLine, { flag: 'a' });
    } catch (error) {
      // Avoid infinite recursion by not logging errors from file writes
      console.error('Failed to write to log file:', error);
    }
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Write to console
    const formattedMessage = this.formatMessage(entry);
    console.log(formattedMessage);

    // Write to file
    if (this.logFile) {
      this.writeToFile(entry);
    }
  }

  error(message: string, metadata?: Record<string, any>, error?: Error): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      metadata,
      command: this.getCurrentCommand(),
      error,
    });
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      metadata,
      command: this.getCurrentCommand(),
    });
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      metadata,
      command: this.getCurrentCommand(),
    });
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      metadata,
      command: this.getCurrentCommand(),
    });
  }

  // Command-specific logging
  startCommand(command: string, args?: Record<string, any>): void {
    this.commandHistory.push(command);
    this.info(`Starting command: ${command}`, { args });
  }

  endCommand(command: string, duration?: number): void {
    const cmdDuration = duration || Date.now() - this.startTime;
    this.info(`Completed command: ${command}`, undefined, undefined, cmdDuration);
  }

  failCommand(command: string, error: Error, duration?: number): void {
    const cmdDuration = duration || Date.now() - this.startTime;
    this.error(`Command failed: ${command}`, { command }, error, cmdDuration);
  }

  // Progress logging
  progress(current: number, total: number, message?: string): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    const msg = message || `Progress: ${current}/${total}`;

    if (this.currentLevel !== 'quiet') {
      process.stdout.write(`\r${progressBar} ${msg} ${percentage}%`);

      if (current === total) {
        process.stdout.write('\n');
      }
    }
  }

  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((width * percentage) / 100);
    const empty = width - filled;

    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.gray('░'.repeat(empty));

    return `[${filledBar}${emptyBar}]`;
  }

  // Table logging for structured data
  table(data: any[], headers?: string[]): void {
    if (process.env.NO_COLOR === 'true') {
      console.table(data);
      return;
    }

    // Custom colored table implementation
    console.log(chalk.cyan('┌' + '─'.repeat(50) + '┐'));
    if (headers) {
      const headerRow = headers.map(h => chalk.bold(h)).join(' | ');
      console.log(chalk.cyan('│') + ' ' + headerRow + ' ' + chalk.cyan('│'));
      console.log(chalk.cyan('├' + '─'.repeat(50) + '┤'));
    }

    data.forEach(row => {
      const rowData = typeof row === 'object' ? Object.values(row).join(' | ') : String(row);
      console.log(chalk.cyan('│') + ' ' + rowData + ' ' + chalk.cyan('│'));
    });
    console.log(chalk.cyan('└' + '─'.repeat(50) + '┘'));
  }

  // Utility methods
  getCurrentCommand(): string | undefined {
    return this.commandHistory[this.commandHistory.length - 1];
  }

  getCommandHistory(): string[] {
    return [...this.commandHistory];
  }

  reset(): void {
    this.commandHistory = [];
    this.startTime = Date.now();
  }

  // JSON output mode
  json(data: any): void {
    if (process.env.QESTRO_OUTPUT_FORMAT === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      this.info(JSON.stringify(data, null, 2));
    }
  }

  // YAML output mode
  yaml(data: any): void {
    const yaml = require('yaml');
    if (process.env.QESTRO_OUTPUT_FORMAT === 'yaml') {
      console.log(yaml.stringify(data));
    } else {
      this.info(yaml.stringify(data));
    }
  }

  // Success message
  success(message: string, metadata?: Record<string, any>): void {
    const successMessage = `${chalk.green('✓')} ${message}`;
    if (process.env.QESTRO_OUTPUT_FORMAT === 'json' || process.env.QESTRO_OUTPUT_FORMAT === 'yaml') {
      this.info(message, metadata);
    } else {
      console.log(successMessage);
      if (metadata && this.currentLevel === 'debug') {
        console.log(chalk.gray(JSON.stringify(metadata, null, 2)));
      }
    }
  }

  // Warning with emphasis
  emphasize(message: string): void {
    console.log(chalk.yellow.bold('⚠ ' + message));
  }

  // Error with emphasis
  critical(message: string, error?: Error): void {
    console.log(chalk.red.bold('✖ CRITICAL: ' + message));
    if (error && this.currentLevel === 'debug') {
      console.log(chalk.red(error.stack || error.message));
    }
  }
}

export const logger = new Logger();
export { LogLevel, LogEntry };