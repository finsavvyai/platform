import { describe, it, expect, vi } from 'vitest';
import { createLogger } from '../src/logging/logger.js';

describe('logger', () => {
  it('should create a logger instance', () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it('should log info messages', () => {
    const logger = createLogger();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('test message');

    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).toContain('test message');
    expect(logged).toContain('info');

    consoleSpy.mockRestore();
  });

  it('should mask sensitive fields by default', () => {
    const logger = createLogger();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('test', { password: 'secret123', username: 'john' });

    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).toContain('[REDACTED]');
    expect(logged).not.toContain('secret123');

    consoleSpy.mockRestore();
  });

  it('should mask token field', () => {
    const logger = createLogger();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('test', { token: 'abc123xyz' });

    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).toContain('[REDACTED]');

    consoleSpy.mockRestore();
  });

  it('should allow disabling sensitive field masking', () => {
    const logger = createLogger({ maskSensitiveFields: false });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('test', { apiKey: 'key123' });

    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).toContain('key123');

    consoleSpy.mockRestore();
  });

  it('should log warn level messages', () => {
    const logger = createLogger();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn('warning message');

    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).toContain('warning message');
    expect(logged).toContain('warn');

    consoleSpy.mockRestore();
  });

  it('should log error level messages', () => {
    const logger = createLogger();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('error message');

    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).toContain('error message');
    expect(logged).toContain('error');

    consoleSpy.mockRestore();
  });

  it('should include timestamp in log entries', () => {
    const logger = createLogger();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('test');

    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).toContain('timestamp');

    consoleSpy.mockRestore();
  });
});
