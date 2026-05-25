/**
 * Output Formatting Utilities for Questro CLI
 * Provides consistent output formatting across different formats (table, json, yaml)
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from './logger';
import { config } from './config';

export interface TableColumn {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface TableOptions {
  columns?: TableColumn[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  maxRows?: number;
  noHeaders?: boolean;
  compact?: boolean;
}

export class OutputFormatter {
  private currentFormat: 'json' | 'yaml' | 'table';

  constructor() {
    this.currentFormat = config.get('defaults.outputFormat') || 'table';
  }

  setFormat(format: 'json' | 'yaml' | 'table'): void {
    this.currentFormat = format;
  }

  getFormat(): string {
    return this.currentFormat;
  }

  // Generic output method
  output(data: any, options?: TableOptions): void {
    switch (this.currentFormat) {
      case 'json':
        this.json(data);
        break;
      case 'yaml':
        this.yaml(data);
        break;
      case 'table':
      default:
        if (Array.isArray(data)) {
          this.table(data, options);
        } else {
          this.keyValue(data, options);
        }
        break;
    }
  }

  // Table output
  table(data: any[], options: TableOptions = {}): void {
    if (!Array.isArray(data) || data.length === 0) {
      logger.info('No data to display');
      return;
    }

    let processedData = [...data];

    // Apply sorting if specified
    if (options.sortBy) {
      processedData = this.sortData(processedData, options.sortBy, options.sortOrder);
    }

    // Limit rows if specified
    if (options.maxRows && processedData.length > options.maxRows) {
      processedData = processedData.slice(0, options.maxRows);
      logger.info(`Showing ${options.maxRows} of ${data.length} items`);
    }

    // Auto-detect columns if not provided
    const columns = options.columns || this.detectColumns(processedData);

    // Create table
    const tableConfig: any = {
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        left: '│',
        'left-mid': '├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
      style: {
        head: ['bold'],
        border: [],
      },
      wordWrap: true,
      wrapOnWordBoundary: false,
    };

    if (options.compact) {
      tableConfig.chars = {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '  ',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: '  ',
      };
      tableConfig.style = { head: [], border: [] };
    }

    const table = new Table(tableConfig);

    // Add headers
    if (!options.noHeaders && columns.length > 0) {
      const headers = columns.map(col => chalk.bold(col.label || col.key));
      if (options.compact) {
        table.push(headers);
      } else {
        table.head = headers;
      }
    }

    // Add rows
    processedData.forEach(row => {
      const tableRow: string[] = [];
      columns.forEach(col => {
        let value = this.getNestedValue(row, col.key);
        value = this.formatValue(value);
        tableRow.push(value);
      });
      table.push(tableRow);
    });

    console.log(table.toString());
  }

  // Key-value output for single objects
  keyValue(data: any, options: TableOptions = {}): void {
    if (!data || typeof data !== 'object') {
      console.log(data);
      return;
    }

    const entries = Object.entries(data);

    if (options.compact) {
      entries.forEach(([key, value]) => {
        console.log(`${chalk.cyan(key)}: ${this.formatValue(value)}`);
      });
    } else {
      const table = new Table({
        chars: {
          top: '─',
          'top-mid': '┬',
          'top-left': '┌',
          'top-right': '┐',
          bottom: '─',
          'bottom-mid': '┴',
          'bottom-left': '└',
          'bottom-right': '┘',
          left: '│',
          'left-mid': '├',
          mid: '─',
          'mid-mid': '┼',
          right: '│',
          'right-mid': '┤',
          middle: '│',
        },
        style: {
          head: ['bold'],
          border: [],
        },
        colWidths: [20, 50],
        wordWrap: true,
        wrapOnWordBoundary: false,
      });

      entries.forEach(([key, value]) => {
        table.push([
          chalk.cyan(key),
          this.formatValue(value)
        ]);
      });

      console.log(table.toString());
    }
  }

  // JSON output
  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }

  // YAML output
  yaml(data: any): void {
    const yaml = require('yaml');
    console.log(yaml.stringify(data));
  }

  // List output (simple format)
  list(items: string[], options: { numbered?: boolean; bullets?: boolean } = {}): void {
    const { numbered = false, bullets = true } = options;

    items.forEach((item, index) => {
      if (numbered) {
        console.log(`${chalk.cyan((index + 1).toString())}. ${item}`);
      } else if (bullets) {
        console.log(`${chalk.cyan('•')} ${item}`);
      } else {
        console.log(item);
      }
    });
  }

  // Progress bar
  progress(current: number, total: number, message?: string): void {
    const percentage = Math.round((current / total) * 100);
    const barWidth = 30;
    const filled = Math.round((barWidth * current) / total);
    const empty = barWidth - filled;

    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.gray('░'.repeat(empty));

    const progressBar = `[${filledBar}${emptyBar}]`;
    const msg = message || `Progress: ${current}/${total}`;

    if (process.stdout.clearLine) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${progressBar} ${msg} ${percentage}%`);

      if (current === total) {
        process.stdout.write('\n');
      }
    } else {
      console.log(`${progressBar} ${msg} ${percentage}%`);
    }
  }

  // Success message
  success(message: string): void {
    console.log(chalk.green.bold('✓') + ' ' + message);
  }

  // Error message
  error(message: string): void {
    console.log(chalk.red.bold('✖') + ' ' + message);
  }

  // Warning message
  warning(message: string): void {
    console.log(chalk.yellow.bold('⚠') + ' ' + message);
  }

  // Info message
  info(message: string): void {
    console.log(chalk.blue.bold('ℹ') + ' ' + message);
  }

  // Highlight text
  highlight(text: string): void {
    console.log(chalk.yellow.bold(text));
  }

  // Separator line
  separator(char: string = '─', length: number = 50): void {
    console.log(chalk.gray(char.repeat(length)));
  }

  // Header
  header(title: string, subtitle?: string): void {
    this.separator();
    console.log(chalk.bold.white(title));
    if (subtitle) {
      console.log(chalk.gray(subtitle));
    }
    this.separator();
  }

  // Footer
  footer(message: string): void {
    this.separator();
    console.log(chalk.gray(message));
  }

  // Private helper methods
  private detectColumns(data: any[]): TableColumn[] {
    if (data.length === 0) return [];

    const sampleItem = data[0];
    const keys = typeof sampleItem === 'object' ? Object.keys(sampleItem) : [];

    return keys.map(key => ({
      key,
      label: this.formatLabel(key),
    }));
  }

  private formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : '';
    }, obj);
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return chalk.gray('N/A');
    }

    if (typeof value === 'boolean') {
      return value ? chalk.green('Yes') : chalk.red('No');
    }

    if (typeof value === 'number') {
      return value.toLocaleString();
    }

    if (typeof value === 'string') {
      // Color code status values
      if (value.toLowerCase() === 'active' || value.toLowerCase() === 'success') {
        return chalk.green(value);
      }
      if (value.toLowerCase() === 'inactive' || value.toLowerCase() === 'failed') {
        return chalk.red(value);
      }
      if (value.toLowerCase() === 'pending') {
        return chalk.yellow(value);
      }

      // Truncate long strings
      if (value.length > 50) {
        return value.substring(0, 47) + '...';
      }

      return value;
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 0);
    }

    return String(value);
  }

  private sortData(data: any[], sortBy: string, order: 'asc' | 'desc' = 'asc'): any[] {
    return data.sort((a, b) => {
      const aValue = this.getNestedValue(a, sortBy);
      const bValue = this.getNestedValue(b, sortBy);

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return order === 'desc' ? comparison * -1 : comparison;
    });
  }

  // Advanced table formatting for complex data
  advancedTable(data: any[], options: {
    groupBy?: string;
    summarize?: boolean;
    showCount?: boolean;
  } = {}): void {
    const { groupBy, summarize, showCount } = options;

    if (groupBy && data.length > 0) {
      const groups = this.groupData(data, groupBy);

      Object.entries(groups).forEach(([groupKey, groupData]) => {
        console.log(chalk.bold.white(`\n${groupKey} (${groupData.length} items)`));
        console.log(chalk.gray('─'.repeat(50)));

        if (summarize) {
          this.summaryTable(groupData);
        } else {
          this.table(groupData);
        }
      });
    } else {
      this.table(data);

      if (showCount) {
        console.log(chalk.gray(`\nTotal: ${data.length} items`));
      }
    }
  }

  private groupData(data: any[], groupBy: string): Record<string, any[]> {
    return data.reduce((groups, item) => {
      const groupKey = this.getNestedValue(item, groupBy) || 'Unknown';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, any[]>);
  }

  private summaryTable(data: any[]): void {
    // Create a summary table with key statistics
    const summary = this.calculateSummary(data);
    this.keyValue(summary);
  }

  private calculateSummary(data: any[]): Record<string, any> {
    const summary: Record<string, any> = {
      'Total Items': data.length,
    };

    // Add counts for different status values
    const statusCounts: Record<string, number> = {};
    data.forEach(item => {
      const status = this.getNestedValue(item, 'status') || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    Object.entries(statusCounts).forEach(([status, count]) => {
      summary[`${status.charAt(0).toUpperCase() + status.slice(1)} Items`] = count;
    });

    return summary;
  }
}

// Create singleton instance
export const output = new OutputFormatter();

// Export convenience functions
export const table = (data: any[], options?: TableOptions) => output.table(data, options);
export const keyValue = (data: any, options?: TableOptions) => output.keyValue(data, options);
export const json = (data: any) => output.json(data);
export const yaml = (data: any) => output.yaml(data);
export const list = (items: string[], options?: { numbered?: boolean; bullets?: boolean }) => output.list(items, options);
export const success = (message: string) => output.success(message);
export const error = (message: string) => output.error(message);
export const warning = (message: string) => output.warning(message);
export const info = (message: string) => output.info(message);
export const highlight = (text: string) => output.highlight(text);
export const separator = (char?: string, length?: number) => output.separator(char, length);
export const header = (title: string, subtitle?: string) => output.header(title, subtitle);
export const footer = (message: string) => output.footer(message);
export const progress = (current: number, total: number, message?: string) => output.progress(current, total, message);

export { OutputFormatter, TableColumn, TableOptions };