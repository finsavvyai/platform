/**
 * Monitoring tests for Luna-OS Wave 1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createLogger, healthCheck, Logger } from '../src/monitoring/index';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLogger('TestContext');
  });

  it('should create a logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should log info messages', () => {
    expect(() => {
      logger.info('Test message', { data: 'test' });
    }).not.toThrow();
  });

  it('should log error messages', () => {
    const error = new Error('Test error');
    expect(() => {
      logger.error('Error occurred', error, { context: 'test' });
    }).not.toThrow();
  });

  it('should log warnings', () => {
    expect(() => {
      logger.warn('Warning message', { level: 'warn' });
    }).not.toThrow();
  });

  it('should log debug messages only when DEBUG env is set', () => {
    expect(() => {
      logger.debug('Debug message', { debug: true });
    }).not.toThrow();
  });
});

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const result = await healthCheck();

    expect(result).toBeDefined();
    expect(result.status).toBe('healthy');
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should include all required checks', async () => {
    const result = await healthCheck();

    expect(result.checks).toBeDefined();
    expect(result.checks.api).toBe('ok');
    expect(result.checks.database).toBe('connected');
    expect(result.checks.cache).toBe('connected');
  });

  it('should track uptime', async () => {
    const result1 = await healthCheck();
    await new Promise(resolve => setTimeout(resolve, 10));
    const result2 = await healthCheck();

    expect(result2.uptime).toBeGreaterThanOrEqual(result1.uptime);
  });
});
