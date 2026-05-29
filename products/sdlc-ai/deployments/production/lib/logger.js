/**
 * Logging and output formatting with color codes
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

// Log level configurations
const logLevels = {
  development: 'debug',
  staging: 'info',
  production: 'warn'
};

const levelPriority = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  constructor(environment = 'development') {
    this.environment = environment;
    this.logLevel = logLevels[environment] || 'info';
    this.logFile = null;
    this.enableColors = process.stdout.isTTY;
    
    // Initialize log file
    this.initializeLogFile();
  }

  /**
   * Initialize log file
   */
  initializeLogFile() {
    const logsDir = path.join(__dirname, '..', 'logs');
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logsDir, `deployment-${timestamp}.log`);
  }

  /**
   * Check if log level should be output
   * @param {string} level - Log level
   * @returns {boolean} Whether to output
   */
  shouldLog(level) {
    return levelPriority[level] >= levelPriority[this.logLevel];
  }

  /**
   * Format timestamp
   * @returns {string} Formatted timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Colorize text
   * @param {string} text - Text to colorize
   * @param {string} color - Color name
   * @returns {string} Colorized text
   */
  colorize(text, color) {
    if (!this.enableColors) {
      return text;
    }
    return `${colors[color]}${text}${colors.reset}`;
  }

  /**
   * Write to log file
   * @param {string} level - Log level
   * @param {string} message - Log message
   */
  writeToFile(level, message) {
    if (!this.logFile) {
      return;
    }

    const timestamp = this.getTimestamp();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    try {
      fs.appendFileSync(this.logFile, logEntry, 'utf8');
    } catch (error) {
      // Silently fail if we can't write to log file
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   */
  debug(message) {
    if (!this.shouldLog('debug')) {
      return;
    }

    const formatted = this.colorize(`[DEBUG] ${message}`, 'dim');
    console.log(formatted);
    this.writeToFile('debug', message);
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   */
  info(message) {
    if (!this.shouldLog('info')) {
      return;
    }

    const formatted = this.colorize(`[INFO] ${message}`, 'cyan');
    console.log(formatted);
    this.writeToFile('info', message);
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   */
  warn(message) {
    if (!this.shouldLog('warn')) {
      return;
    }

    const formatted = this.colorize(`[WARN] ${message}`, 'yellow');
    console.log(formatted);
    this.writeToFile('warn', message);
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   */
  error(message) {
    if (!this.shouldLog('error')) {
      return;
    }

    const formatted = this.colorize(`[ERROR] ${message}`, 'red');
    console.error(formatted);
    this.writeToFile('error', message);
  }

  /**
   * Log success message
   * @param {string} message - Message to log
   */
  success(message) {
    const formatted = this.colorize(`[SUCCESS] ${message}`, 'green');
    console.log(formatted);
    this.writeToFile('info', `SUCCESS: ${message}`);
  }

  /**
   * Log phase header
   * @param {string} message - Phase message
   */
  phase(message) {
    const separator = '='.repeat(60);
    const formatted = this.colorize(`\n${separator}\n${message}\n${separator}`, 'bright');
    console.log(formatted);
    this.writeToFile('info', `PHASE: ${message}`);
  }

  /**
   * Log with progress indicator
   * @param {string} message - Message to log
   */
  progress(message) {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const frame = spinner[Math.floor(Date.now() / 100) % spinner.length];
    const formatted = this.colorize(`${frame} ${message}`, 'cyan');
    
    if (process.stdout.isTTY) {
      process.stdout.write(`\r${formatted}`);
    } else {
      console.log(formatted);
    }
    
    this.writeToFile('info', message);
  }

  /**
   * Clear progress line
   */
  clearProgress() {
    if (process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K');
    }
  }

  /**
   * Log table
   * @param {Array<Object>} data - Table data
   * @param {Array<string>} columns - Column names
   */
  table(data, columns) {
    if (data.length === 0) {
      return;
    }

    // Calculate column widths
    const widths = {};
    for (const col of columns) {
      widths[col] = col.length;
      for (const row of data) {
        const value = String(row[col] || '');
        widths[col] = Math.max(widths[col], value.length);
      }
    }

    // Print header
    const header = columns.map(col => col.padEnd(widths[col])).join(' | ');
    const separator = columns.map(col => '-'.repeat(widths[col])).join('-+-');
    
    console.log(this.colorize(header, 'bright'));
    console.log(separator);

    // Print rows
    for (const row of data) {
      const line = columns.map(col => String(row[col] || '').padEnd(widths[col])).join(' | ');
      console.log(line);
    }

    console.log('');
  }

  /**
   * Log deployment summary
   * @param {Object} result - Deployment result
   */
  summary(result) {
    this.phase('Deployment Summary');
    
    const data = [
      { key: 'Deployment ID', value: result.deploymentId },
      { key: 'Environment', value: result.environment },
      { key: 'Status', value: result.success ? 'SUCCESS' : 'FAILED' },
      { key: 'Duration', value: `${(result.duration / 1000).toFixed(2)}s` },
      { key: 'Services Deployed', value: result.servicesDeployed.length }
    ];

    this.table(data, ['key', 'value']);

    if (result.servicesDeployed.length > 0) {
      this.info('Deployed Services:');
      for (const service of result.servicesDeployed) {
        this.info(`  - ${service}`);
      }
    }

    if (result.errors && result.errors.length > 0) {
      this.error('Errors:');
      for (const error of result.errors) {
        this.error(`  - ${error.message}`);
      }
    }
  }

  /**
   * Get log file path
   * @returns {string} Log file path
   */
  getLogFile() {
    return this.logFile;
  }

  /**
   * Set log level
   * @param {string} level - Log level
   */
  setLogLevel(level) {
    if (levelPriority[level] !== undefined) {
      this.logLevel = level;
    }
  }

  /**
   * Enable or disable colors
   * @param {boolean} enabled - Whether to enable colors
   */
  setColors(enabled) {
    this.enableColors = enabled;
  }
}

module.exports = { Logger };
