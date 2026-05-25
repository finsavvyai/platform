/**
 * Tests for Logger
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel, ErrorBoundary, createLogger } from '../logging/Logger';

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Store original console methods
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
};

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    // Mock console methods
    console.debug = mockConsole.debug;
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    logger = new Logger('TestCategory', {
      level: LogLevel.DEBUG,
      enableConsole: true,
      enableFileLogging: false,
      maxLogEntries: 100
    });
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;

    // Clear mocks
    vi.clearAllMocks();

    // Clear logger
    logger.clear();
  });

  describe('Log Levels', () => {
    it('should log messages at appropriate levels', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockConsole.debug).toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should respect log level filtering', () => {
      const filteredLogger = new Logger('Test', {
        level: LogLevel.WARN,
        enableConsole: true
      });

      filteredLogger.debug('Debug message'); // Should not appear
      filteredLogger.info('Info message'); // Should not appear
      filteredLogger.warn('Warning message'); // Should appear
      filteredLogger.error('Error message'); // Should appear

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('Message Formatting', () => {
    it('should include timestamp, level, and category', () => {
      logger.info('Test message');

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[Logger]')
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      );
    });

    it('should include correlation ID', () => {
      logger.info('Test message');

      const call = mockConsole.info.mock.calls[0][0];
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/); // ISO timestamp
      expect(call).toMatch(/\[INFO\]/);
      expect(call).toMatch(/\[Logger\]/);
      expect(call).toMatch(/\[[\d-]+-[a-z0-9]+\]/); // Correlation ID
    });

    it('should include data when provided', () => {
      const testData = { key: 'value' };
      logger.info('Test message', testData);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('Data: {"key":"value"}')
      );
    });
  });

  describe('Log Entry Management', () => {
    it('should store log entries in memory', () => {
      logger.info('Test message 1');
      logger.warn('Test message 2');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Test message 1');
      expect(logs[0].level).toBe(LogLevel.INFO);
      expect(logs[1].message).toBe('Test message 2');
      expect(logs[1].level).toBe(LogLevel.WARN);
    });

    it('should filter logs by level', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      const warnAndAbove = logger.getLogs(LogLevel.WARN);
      expect(warnAndAbove).toHaveLength(2); // WARN and ERROR

      const errorOnly = logger.getLogs(LogLevel.ERROR);
      expect(errorOnly).toHaveLength(1); // Only ERROR
    });

    it('should limit log entries', () => {
      const limitedLogger = new Logger('Test', {
        maxLogEntries: 3
      });

      limitedLogger.info('Message 1');
      limitedLogger.info('Message 2');
      limitedLogger.info('Message 3');
      limitedLogger.info('Message 4'); // Should evict Message 1

      const logs = limitedLogger.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Message 2');
      expect(logs[2].message).toBe('Message 4');
    });
  });

  describe('Statistics', () => {
    it('should provide accurate log statistics', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      logger.fatal('Fatal message');

      const stats = logger.getStats();

      expect(stats.total).toBe(5);
      expect(stats.debug).toBe(1);
      expect(stats.info).toBe(1);
      expect(stats.warn).toBe(1);
      expect(stats.error).toBe(1);
      expect(stats.fatal).toBe(1);
    });

    it('should handle empty logs gracefully', () => {
      const stats = logger.getStats();

      expect(stats.total).toBe(0);
      expect(stats.debug).toBe(0);
      expect(stats.info).toBe(0);
      expect(stats.warn).toBe(0);
      expect(stats.error).toBe(0);
      expect(stats.fatal).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle error objects', () => {
      const testError = new Error('Test error');
      logger.error('Error occurred', testError);

      expect(mockConsole.error).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
      expect(mockConsole.error).toHaveBeenCalledWith(testError);
    });

    it('should handle non-Error objects as errors', () => {
      logger.error('String error', 'This is a string error');

      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('Clear Operations', () => {
    it('should clear all log entries', () => {
      logger.info('Test message 1');
      logger.info('Test message 2');

      expect(logger.getLogs()).toHaveLength(2);

      logger.clear();

      expect(logger.getLogs()).toHaveLength(0);
    });
  });
});

describe('ErrorBoundary', () => {
  let errorBoundary: ErrorBoundary;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      error: vi.fn()
    };
    errorBoundary = new ErrorBoundary(mockLogger);
  });

  describe('Execute Method', () => {
    it('should execute successful functions', async () => {
      const result = await errorBoundary.execute(
        () => 'success',
        'test-context'
      );

      expect(result).toBe('success');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle async function errors', async () => {
      await expect(
        errorBoundary.execute(
          async () => {
            throw new Error('Async error');
          },
          'async-context'
        )
      ).rejects.toThrow('Async error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in async-context',
        expect.any(Error),
        { context: 'async-context' }
      );
    });

    it('should handle sync function errors', async () => {
      await expect(
        errorBoundary.execute(
          () => {
            throw new Error('Sync error');
          },
          'sync-context'
        )
      ).rejects.toThrow('Sync error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in sync-context',
        expect.any(Error),
        { context: 'sync-context' }
      );
    });

    it('should call custom error handler when provided', async () => {
      const customHandler = vi.fn().mockReturnValue('fallback');

      const result = await errorBoundary.execute(
        () => {
          throw new Error('Test error');
        },
        'test-context',
        customHandler
      );

      expect(result).toBe('fallback');
      expect(customHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle non-Error thrown values', async () => {
      await expect(
        errorBoundary.execute(
          () => {
            throw 'String error';
          },
          'test-context'
        )
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in test-context',
        expect.any(Error)
      );
    });
  });

  describe('Error Handlers', () => {
    it('should register and call error handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      errorBoundary.onError(handler1);
      errorBoundary.onError(handler2);

      await errorBoundary.execute(
        () => {
          throw new Error('Test error');
        },
        'test-context'
      );

      expect(handler1).toHaveBeenCalledWith(expect.any(Error), 'test-context');
      expect(handler2).toHaveBeenCalledWith(expect.any(Error), 'test-context');
    });

    it('should remove error handlers', async () => {
      const handler = vi.fn();

      errorBoundary.onError(handler);
      errorBoundary.removeErrorHandler(handler);

      await errorBoundary.execute(
        () => {
          throw new Error('Test error');
        },
        'test-context'
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in error handlers gracefully', async () => {
      const faultyHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      errorBoundary.onError(faultyHandler);

      await errorBoundary.execute(
        () => {
          throw new Error('Original error');
        },
        'test-context'
      );

      expect(faultyHandler).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error handler failed',
        expect.any(Error)
      );
    });
  });
});

describe('createLogger', () => {
  it('should create logger instances', () => {
    const logger = createLogger('TestCategory');

    expect(logger).toBeInstanceOf(Logger);
  });

  it('should accept configuration', () => {
    const logger = createLogger('TestCategory', {
      level: LogLevel.ERROR,
      enableConsole: false
    });

    logger.info('This should not appear');
    expect(mockConsole.info).not.toHaveBeenCalled();
  });
});